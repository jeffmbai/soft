from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.duty import DutyClock
from app.models.enums import ShiftStatus, UserRole
from app.models.location import Location
from app.models.shift import Shift, ShiftAssignment
from app.models.user import User
from app.schemas.duty import (
    DutyActivityItem,
    DutyFloorResponse,
    DutyLocationSummary,
    DutyShiftGroup,
    DutyStaffMember,
)
from app.services.access import get_accessible_location_ids
from app.services.redis_bus import publish_duty_update

TARDY_GRACE_MINUTES = 5
EARLY_CLOCK_IN_MINUTES = 15
BREAK_AFTER_HOURS = 4


def _initials(name: str) -> str:
    return "".join(part[0] for part in name.split() if part)[:2].upper()


def build_assignment_duty_info(
    *,
    now: datetime,
    shift: Shift,
    clock: DutyClock | None,
) -> dict:
    in_window = shift.starts_at - timedelta(minutes=EARLY_CLOCK_IN_MINUTES) <= now < shift.ends_at
    is_active = in_window or (clock is not None and clock.clocked_out_at is None)
    status = _staff_status(now=now, shift=shift, clock=clock) if is_active else None

    seconds_on_shift: int | None = None
    seconds_until_break: int | None = None
    break_available = False
    seconds_until_shift_end = max(0, int((shift.ends_at - now).total_seconds())) if now < shift.ends_at else 0

    if clock and not clock.clocked_out_at:
        elapsed = (now - clock.clocked_in_at).total_seconds()
        seconds_on_shift = max(0, int(elapsed))
        break_threshold = BREAK_AFTER_HOURS * 3600
        if elapsed >= break_threshold:
            break_available = True
            seconds_until_break = 0
        else:
            seconds_until_break = max(0, int(break_threshold - elapsed))

    can_clock_in = in_window and status in ("scheduled", "tardy")
    can_clock_out = status == "clocked_in"

    return {
        "duty_status": status,
        "clocked_in_at": clock.clocked_in_at if clock and not clock.clocked_out_at else None,
        "can_clock_in": can_clock_in,
        "can_clock_out": can_clock_out,
        "is_active": is_active,
        "seconds_on_shift": seconds_on_shift,
        "seconds_until_break": seconds_until_break,
        "break_available": break_available,
        "seconds_until_shift_end": seconds_until_shift_end,
    }


def _staff_status(
    *,
    now: datetime,
    shift: Shift,
    clock: DutyClock | None,
) -> str:
    if clock and clock.clocked_out_at:
        return "clocked_out"
    if clock and not clock.clocked_out_at:
        return "clocked_in"
    if now > shift.starts_at + timedelta(minutes=TARDY_GRACE_MINUTES):
        return "tardy"
    return "scheduled"


async def _active_shifts(db: AsyncSession, allowed: set[UUID] | None, now: datetime) -> list[Shift]:
    stmt = (
        select(Shift)
        .where(
            Shift.status == ShiftStatus.published,
            Shift.starts_at <= now + timedelta(minutes=EARLY_CLOCK_IN_MINUTES),
            Shift.ends_at > now,
        )
        .options(
            selectinload(Shift.location),
            selectinload(Shift.assignments).selectinload(ShiftAssignment.user),
        )
        .order_by(Shift.starts_at)
    )
    if allowed is not None:
        stmt = stmt.where(Shift.location_id.in_(allowed) if allowed else False)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def _active_clocks(db: AsyncSession, assignment_ids: list[UUID]) -> dict[UUID, DutyClock]:
    if not assignment_ids:
        return {}
    result = await db.execute(
        select(DutyClock)
        .where(
            DutyClock.assignment_id.in_(assignment_ids),
            DutyClock.clocked_out_at.is_(None),
        )
        .order_by(DutyClock.clocked_in_at.desc()),
    )
    clocks: dict[UUID, DutyClock] = {}
    for clock in result.scalars().all():
        clocks.setdefault(clock.assignment_id, clock)
    return clocks


async def get_floor_snapshot(db: AsyncSession, user: User) -> DutyFloorResponse:
    now = datetime.now(timezone.utc)
    allowed = await get_accessible_location_ids(user, db)
    shifts = await _active_shifts(db, allowed, now)

    assignment_ids = [a.id for s in shifts for a in s.assignments]
    clocks = await _active_clocks(db, assignment_ids)

    location_stats: dict[UUID, DutyLocationSummary] = {}
    shift_groups: list[DutyShiftGroup] = []
    total_clocked_in = 0

    for shift in shifts:
        loc = shift.location
        if loc.id not in location_stats:
            location_stats[loc.id] = DutyLocationSummary(
                location_id=loc.id,
                name=loc.name,
                timezone=loc.timezone,
                scheduled_count=0,
                clocked_in_count=0,
                tardy_count=0,
                gap_count=0,
                active_shifts=0,
            )
        summary = location_stats[loc.id]
        summary.active_shifts += 1

        staff: list[DutyStaffMember] = []
        for assignment in shift.assignments:
            clock = clocks.get(assignment.id)
            status = _staff_status(now=now, shift=shift, clock=clock)
            summary.scheduled_count += 1
            if status == "clocked_in":
                summary.clocked_in_count += 1
                total_clocked_in += 1
            elif status == "tardy":
                summary.tardy_count += 1

            in_window = shift.starts_at - timedelta(minutes=EARLY_CLOCK_IN_MINUTES) <= now < shift.ends_at
            staff.append(
                DutyStaffMember(
                    assignment_id=assignment.id,
                    user_id=assignment.user_id,
                    name=assignment.user.name,
                    initials=_initials(assignment.user.name),
                    skill=shift.required_skill.value,
                    shift_starts_at=shift.starts_at,
                    shift_ends_at=shift.ends_at,
                    status=status,
                    clocked_in_at=clock.clocked_in_at if clock else None,
                    can_clock_in=in_window and status in ("scheduled", "tardy"),
                    can_clock_out=status == "clocked_in",
                ),
            )

        gaps = max(shift.headcount - len(shift.assignments), 0)
        summary.gap_count += gaps
        shift_groups.append(
            DutyShiftGroup(
                shift_id=shift.id,
                location_id=loc.id,
                location_name=loc.name,
                skill=shift.required_skill.value,
                starts_at=shift.starts_at,
                ends_at=shift.ends_at,
                headcount=shift.headcount,
                assigned=len(shift.assignments),
                gaps=gaps,
                staff=staff,
            ),
        )

    if allowed is not None:
        loc_result = await db.execute(select(Location).where(Location.id.in_(allowed)).order_by(Location.name))
    else:
        loc_result = await db.execute(select(Location).order_by(Location.name))
    for loc in loc_result.scalars().all():
        location_stats.setdefault(
            loc.id,
            DutyLocationSummary(
                location_id=loc.id,
                name=loc.name,
                timezone=loc.timezone,
                scheduled_count=0,
                clocked_in_count=0,
                tardy_count=0,
                gap_count=0,
                active_shifts=0,
            ),
        )

    activity = await _recent_activity(db, allowed)
    locations = sorted(location_stats.values(), key=lambda l: l.name)

    return DutyFloorResponse(
        updated_at=now,
        total_clocked_in=total_clocked_in,
        locations=locations,
        shifts=shift_groups,
        activity=activity,
    )


async def _recent_activity(db: AsyncSession, allowed: set[UUID] | None) -> list[DutyActivityItem]:
    stmt = select(DutyClock).options(selectinload(DutyClock.user)).order_by(DutyClock.clocked_in_at.desc()).limit(20)
    if allowed is not None:
        stmt = stmt.where(DutyClock.location_id.in_(allowed) if allowed else False)
    result = await db.execute(stmt)
    items: list[DutyActivityItem] = []
    for clock in result.scalars().all():
        if clock.clocked_out_at:
            items.append(
                DutyActivityItem(
                    id=clock.id,
                    at=clock.clocked_out_at,
                    label=f"{clock.user.name} clocked out",
                    tone="neutral",
                ),
            )
        items.append(
            DutyActivityItem(
                id=clock.id,
                at=clock.clocked_in_at,
                label=f"{clock.user.name} clocked in",
                tone="ok",
            ),
        )
    items.sort(key=lambda i: i.at, reverse=True)
    return items[:12]


async def _load_assignment(db: AsyncSession, assignment_id: UUID) -> ShiftAssignment:
    result = await db.execute(
        select(ShiftAssignment)
        .where(ShiftAssignment.id == assignment_id)
        .options(
            selectinload(ShiftAssignment.shift).selectinload(Shift.location),
            selectinload(ShiftAssignment.user),
        ),
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


async def _ensure_access(db: AsyncSession, user: User, location_id: UUID) -> None:
    allowed = await get_accessible_location_ids(user, db)
    if allowed is not None and location_id not in allowed:
        raise HTTPException(status_code=403, detail="No access to this location")


async def clock_in(db: AsyncSession, user: User, assignment_id: UUID) -> DutyClock:
    assignment = await _load_assignment(db, assignment_id)
    shift = assignment.shift
    now = datetime.now(timezone.utc)

    if shift.status != ShiftStatus.published:
        raise HTTPException(status_code=400, detail="Shift is not published")
    if now >= shift.ends_at:
        raise HTTPException(status_code=400, detail="Shift has ended")
    if now < shift.starts_at - timedelta(minutes=EARLY_CLOCK_IN_MINUTES):
        raise HTTPException(status_code=400, detail="Too early to clock in")

    if user.role == UserRole.staff and assignment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if user.role in (UserRole.admin, UserRole.manager):
        await _ensure_access(db, user, shift.location_id)

    existing = await _active_clocks(db, [assignment_id])
    if assignment_id in existing:
        raise HTTPException(status_code=409, detail="Already clocked in")

    clock = DutyClock(
        assignment_id=assignment.id,
        user_id=assignment.user_id,
        shift_id=shift.id,
        location_id=shift.location_id,
        clocked_in_at=now,
    )
    db.add(clock)
    await db.flush()
    await publish_duty_update({"type": "clock_in", "location_id": str(shift.location_id)})
    return clock


async def clock_out(db: AsyncSession, user: User, assignment_id: UUID) -> DutyClock:
    assignment = await _load_assignment(db, assignment_id)
    shift = assignment.shift
    now = datetime.now(timezone.utc)

    if user.role == UserRole.staff and assignment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if user.role in (UserRole.admin, UserRole.manager):
        await _ensure_access(db, user, shift.location_id)

    clocks = await _active_clocks(db, [assignment_id])
    clock = clocks.get(assignment_id)
    if not clock:
        raise HTTPException(status_code=400, detail="Not clocked in")

    clock.clocked_out_at = now
    await publish_duty_update({"type": "clock_out", "location_id": str(shift.location_id)})
    return clock


async def notify_duty_change() -> None:
    await publish_duty_update({"type": "refresh"})

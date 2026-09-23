from datetime import date, datetime, time as dt_time, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.enums import ShiftStatus, UserRole
from app.models.location import Location
from app.models.audit import AuditLog
from app.models.shift import ScheduleWeek, Shift, ShiftAssignment
from app.models.user import User
from app.schemas.scheduling import (
    AssignPreviewRequest,
    AssignRequest,
    AssignResultResponse,
    AssignmentBrief,
    AuditLogResponse,
    PublishWeekResponse,
    ScheduleWeekResponse,
    ShiftCreateRequest,
    ShiftResponse,
    ShiftUpdateRequest,
    SuggestionResponse,
    ViolationResponse,
    ViolationSeverity,
)
from app.services.access import get_accessible_location_ids, require_location_access
from app.services.audit import log_change
from app.services.concurrency import count_shift_assignments, lock_shift
from app.services.constraints import suggest_alternatives, validate_assignment
from app.services.swaps import cancel_swaps_for_shift

router = APIRouter(tags=["scheduling"])


def _week_bounds(week_start: date) -> tuple[datetime, datetime]:
    start = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=7)
    return start, end


def _serialize_shift(shift: Shift) -> ShiftResponse:
    assignments = [
        AssignmentBrief(
            id=a.id,
            user_id=a.user_id,
            user_name=a.user.name if a.user else "Unknown",
            status=a.status,
        )
        for a in shift.assignments
    ]
    return ShiftResponse(
        id=shift.id,
        location_id=shift.location_id,
        starts_at=shift.starts_at,
        ends_at=shift.ends_at,
        required_skill=shift.required_skill,
        headcount=shift.headcount,
        status=shift.status,
        version=shift.version,
        assignments=assignments,
    )


def _to_assign_result(result, assignment_id=None) -> AssignResultResponse:
    return AssignResultResponse(
        success=result.valid,
        assignment_id=assignment_id,
        violations=[
            ViolationResponse(rule=v.rule, message=v.message, severity=ViolationSeverity(v.severity.value))
            for v in result.violations
        ],
        suggestions=[
            SuggestionResponse(user_id=s.user_id, name=s.name, reason=s.reason) for s in result.suggestions
        ],
    )


async def _load_shift(db: AsyncSession, shift_id: UUID) -> Shift:
    result = await db.execute(
        select(Shift)
        .where(Shift.id == shift_id)
        .options(selectinload(Shift.assignments).selectinload(ShiftAssignment.user), selectinload(Shift.location))
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift


@router.get("/locations/{location_id}/schedule", response_model=ScheduleWeekResponse)
async def get_schedule(
    location_id: UUID,
    week: date = Query(..., description="Week start date (Monday) ISO format"),
    location: Location = Depends(require_location_access),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    week_start = week - timedelta(days=week.weekday())
    _, week_end = _week_bounds(week_start)

    shifts_result = await db.execute(
        select(Shift)
        .where(
            Shift.location_id == location_id,
            Shift.starts_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            Shift.starts_at < week_end,
        )
        .options(selectinload(Shift.assignments).selectinload(ShiftAssignment.user))
        .order_by(Shift.starts_at)
    )
    shifts = shifts_result.scalars().all()

    if user.role == UserRole.staff:
        shifts = [s for s in shifts if s.status == ShiftStatus.published]

    week_row = await db.execute(
        select(ScheduleWeek).where(
            ScheduleWeek.location_id == location_id,
            ScheduleWeek.week_start == week_start,
        )
    )
    schedule_week = week_row.scalar_one_or_none()

    return ScheduleWeekResponse(
        location_id=location_id,
        week_start=week_start,
        published_at=schedule_week.published_at if schedule_week else None,
        is_published=schedule_week is not None and schedule_week.published_at is not None,
        shifts=[_serialize_shift(s) for s in shifts],
    )


@router.post(
    "/locations/{location_id}/shifts",
    response_model=ShiftResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def create_shift(
    location_id: UUID,
    body: ShiftCreateRequest,
    location: Location = Depends(require_location_access),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.local_date and body.local_start_time and body.local_end_time:
        tz = ZoneInfo(location.timezone)

        def parse_local(t: str) -> dt_time:
            h, m = t.split(":")
            return dt_time(int(h), int(m))

        starts_at = datetime.combine(body.local_date, parse_local(body.local_start_time), tzinfo=tz).astimezone(timezone.utc)
        ends_local = datetime.combine(body.local_date, parse_local(body.local_end_time), tzinfo=tz)
        if parse_local(body.local_end_time) <= parse_local(body.local_start_time):
            ends_local += timedelta(days=1)
        ends_at = ends_local.astimezone(timezone.utc)
    elif body.starts_at and body.ends_at:
        starts_at = body.starts_at
        ends_at = body.ends_at
    else:
        raise HTTPException(status_code=400, detail="Provide starts_at/ends_at or local_date with local times")

    if ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    shift = Shift(
        location_id=location_id,
        starts_at=starts_at,
        ends_at=ends_at,
        required_skill=body.required_skill,
        headcount=body.headcount,
        status=ShiftStatus.draft,
    )
    db.add(shift)
    await db.flush()
    await log_change(
        db,
        entity_type="shift",
        entity_id=shift.id,
        actor_id=user.id,
        before=None,
        after={"starts_at": starts_at.isoformat(), "skill": body.required_skill.value},
    )
    await db.commit()
    shift = await _load_shift(db, shift.id)
    return _serialize_shift(shift)


@router.patch(
    "/shifts/{shift_id}",
    response_model=ShiftResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def update_shift(
    shift_id: UUID,
    body: ShiftUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shift = await _load_shift(db, shift_id)
    await require_location_access(shift.location_id, user, db)

    if shift.version != body.version:
        raise HTTPException(status_code=409, detail="Shift was modified by another user")

    before = {"starts_at": shift.starts_at.isoformat(), "headcount": shift.headcount}
    if body.starts_at is not None:
        shift.starts_at = body.starts_at
    if body.ends_at is not None:
        shift.ends_at = body.ends_at
    if body.required_skill is not None:
        shift.required_skill = body.required_skill
    if body.headcount is not None:
        shift.headcount = body.headcount
    shift.version += 1

    await cancel_swaps_for_shift(db, shift.id, user.id)
    await log_change(db, entity_type="shift", entity_id=shift.id, actor_id=user.id, before=before, after={"version": shift.version})
    await db.commit()
    shift = await _load_shift(db, shift_id)
    return _serialize_shift(shift)


@router.delete(
    "/shifts/{shift_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def delete_shift(
    shift_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shift = await _load_shift(db, shift_id)
    await require_location_access(shift.location_id, user, db)
    if shift.status == ShiftStatus.published:
        raise HTTPException(status_code=400, detail="Cannot delete published shift; unpublish week first")
    await cancel_swaps_for_shift(db, shift_id, user.id)
    await db.execute(delete(ShiftAssignment).where(ShiftAssignment.shift_id == shift_id))
    await db.delete(shift)
    await db.commit()


@router.post(
    "/shifts/{shift_id}/assign",
    response_model=AssignResultResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def assign_staff(
    shift_id: UUID,
    body: AssignRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shift = await lock_shift(db, shift_id)
    location = shift.location
    await require_location_access(shift.location_id, user, db)

    if shift.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cannot assign staff to a shift in the past")

    assignment_count = await count_shift_assignments(db, shift.id)
    if assignment_count >= shift.headcount:
        raise HTTPException(status_code=409, detail="Shift headcount full")

    result = await validate_assignment(
        db,
        shift=shift,
        location=location,
        user_id=body.user_id,
        override_reason=body.override_reason,
        actor_is_admin=user.role == UserRole.admin,
    )
    if not result.valid:
        suggestions = await suggest_alternatives(db, shift=shift, location=location)
        result.suggestions = suggestions
        return _to_assign_result(result)

    staff = await db.get(User, body.user_id)
    assignment = ShiftAssignment(
        shift_id=shift.id,
        user_id=body.user_id,
        override_reason=body.override_reason,
    )
    db.add(assignment)
    await log_change(
        db,
        entity_type="assignment",
        entity_id=shift.id,
        actor_id=user.id,
        before=None,
        after={"user_id": str(body.user_id), "user_name": staff.name if staff else ""},
    )
    await db.commit()
    await db.refresh(assignment)
    return _to_assign_result(result, assignment.id)


@router.post(
    "/shifts/{shift_id}/assign/preview",
    response_model=AssignResultResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def preview_assign(
    shift_id: UUID,
    body: AssignPreviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shift = await _load_shift(db, shift_id)
    location = shift.location
    await require_location_access(shift.location_id, user, db)

    if shift.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cannot assign staff to a shift in the past")

    result = await validate_assignment(
        db,
        shift=shift,
        location=location,
        user_id=body.user_id,
        actor_is_admin=user.role == UserRole.admin,
    )
    if not result.valid:
        result.suggestions = await suggest_alternatives(db, shift=shift, location=location)
    return _to_assign_result(result)


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def unassign(
    assignment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShiftAssignment).where(ShiftAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    shift = await _load_shift(db, assignment.shift_id)
    await require_location_access(shift.location_id, user, db)
    await db.delete(assignment)
    await db.commit()


@router.post(
    "/locations/{location_id}/weeks/{week_start}/publish",
    response_model=PublishWeekResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def publish_week(
    location_id: UUID,
    week_start: date,
    location: Location = Depends(require_location_access),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    week_start = week_start - timedelta(days=week_start.weekday())
    _, week_end = _week_bounds(week_start)

    shifts_result = await db.execute(
        select(Shift).where(
            Shift.location_id == location_id,
            Shift.starts_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            Shift.starts_at < week_end,
        )
    )
    shifts = shifts_result.scalars().all()
    now = datetime.now(timezone.utc)
    for shift in shifts:
        shift.status = ShiftStatus.published

    week_row = await db.execute(
        select(ScheduleWeek).where(
            ScheduleWeek.location_id == location_id,
            ScheduleWeek.week_start == week_start,
        )
    )
    schedule_week = week_row.scalar_one_or_none()
    if not schedule_week:
        schedule_week = ScheduleWeek(location_id=location_id, week_start=week_start)
        db.add(schedule_week)
    schedule_week.published_at = now
    schedule_week.published_by = user.id

    await log_change(
        db,
        entity_type="schedule_week",
        entity_id=location_id,
        actor_id=user.id,
        before=None,
        after={"week_start": week_start.isoformat(), "shifts": len(shifts)},
    )
    await db.commit()
    return PublishWeekResponse(
        location_id=location_id,
        week_start=week_start,
        published_at=now,
        shifts_published=len(shifts),
    )


@router.post(
    "/locations/{location_id}/weeks/{week_start}/unpublish",
    response_model=PublishWeekResponse,
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manager))],
)
async def unpublish_week(
    location_id: UUID,
    week_start: date,
    location: Location = Depends(require_location_access),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    week_start = week_start - timedelta(days=week_start.weekday())
    _, week_end = _week_bounds(week_start)

    shifts_result = await db.execute(
        select(Shift).where(
            Shift.location_id == location_id,
            Shift.starts_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            Shift.starts_at < week_end,
        )
    )
    shifts = shifts_result.scalars().all()
    for shift in shifts:
        shift.status = ShiftStatus.draft

    week_row = await db.execute(
        select(ScheduleWeek).where(
            ScheduleWeek.location_id == location_id,
            ScheduleWeek.week_start == week_start,
        )
    )
    schedule_week = week_row.scalar_one_or_none()
    if schedule_week:
        schedule_week.published_at = None
        schedule_week.published_by = None

    await db.commit()
    return PublishWeekResponse(
        location_id=location_id,
        week_start=week_start,
        published_at=datetime.now(timezone.utc),
        shifts_published=0,
    )


@router.get("/shifts/{shift_id}/history", response_model=list[AuditLogResponse])
async def shift_history(
    shift_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.swap import SwapRequest

    shift = await _load_shift(db, shift_id)
    await require_location_access(shift.location_id, user, db)

    assignment_ids = [a.id for a in shift.assignments]
    swap_ids_result = await db.execute(select(SwapRequest.id).where(SwapRequest.shift_id == shift_id))
    swap_ids = [row[0] for row in swap_ids_result.all()]

    entity_filters = [(AuditLog.entity_type == "shift") & (AuditLog.entity_id == shift_id)]
    if assignment_ids:
        entity_filters.append(
            (AuditLog.entity_type == "assignment") & (AuditLog.entity_id.in_(assignment_ids)),
        )
    if swap_ids:
        entity_filters.append(
            (AuditLog.entity_type == "swap_request") & (AuditLog.entity_id.in_(swap_ids)),
        )

    result = await db.execute(
        select(AuditLog).where(or_(*entity_filters)).order_by(AuditLog.created_at.desc()),
    )
    return result.scalars().all()

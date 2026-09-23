"""Notifications for schedule publish, assignment, and shift changes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.location import Location
from app.models.shift import Shift, ShiftAssignment
from app.services.notifications import notify_location_managers, notify_user


async def weekly_assigned_hours(db: AsyncSession, user_id: UUID) -> float:
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    week_start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    week_end_dt = week_start_dt + timedelta(days=7)
    result = await db.scalar(
        select(func.coalesce(func.sum(func.extract("epoch", Shift.ends_at - Shift.starts_at) / 3600.0), 0))
        .select_from(ShiftAssignment)
        .join(Shift, ShiftAssignment.shift_id == Shift.id)
        .where(
            ShiftAssignment.user_id == user_id,
            Shift.starts_at >= week_start_dt,
            Shift.starts_at < week_end_dt,
        ),
    )
    return float(result or 0)


async def notify_shift_assigned(
    db: AsyncSession,
    *,
    user_id: UUID,
    shift: Shift,
    location: Location,
    actor_name: str,
) -> None:
    await notify_user(
        db,
        user_id=user_id,
        type="shift_assigned",
        title="New shift assigned",
        body=f"{actor_name} assigned you a {shift.required_skill.value.replace('_', ' ')} shift at {location.name}.",
        payload={"shift_id": str(shift.id), "location_id": str(location.id)},
    )


async def notify_shift_unassigned(
    db: AsyncSession,
    *,
    user_id: UUID,
    shift: Shift,
    location: Location,
) -> None:
    await notify_user(
        db,
        user_id=user_id,
        type="shift_unassigned",
        title="Shift removed",
        body=f"You were removed from a shift at {location.name}.",
        payload={"shift_id": str(shift.id), "location_id": str(location.id)},
    )


async def notify_shift_updated(
    db: AsyncSession,
    *,
    shift: Shift,
    location: Location,
) -> None:
    for assignment in shift.assignments:
        await notify_user(
            db,
            user_id=assignment.user_id,
            type="shift_changed",
            title="Shift updated",
            body=f"Your shift at {location.name} was updated by a manager.",
            payload={"shift_id": str(shift.id), "location_id": str(location.id)},
        )


async def notify_schedule_published(
    db: AsyncSession,
    *,
    location: Location,
    week_start,
    shift_ids: list[UUID],
) -> None:
    if not shift_ids:
        return

    result = await db.execute(
        select(ShiftAssignment.user_id)
        .join(Shift, ShiftAssignment.shift_id == Shift.id)
        .where(Shift.id.in_(shift_ids))
        .distinct(),
    )
    user_ids = {row[0] for row in result.all()}

    for user_id in user_ids:
        await notify_user(
            db,
            user_id=user_id,
            type="schedule_published",
            title="Schedule published",
            body=f"The week of {week_start.isoformat()} at {location.name} is now published.",
            payload={
                "location_id": str(location.id),
                "week_start": week_start.isoformat(),
            },
        )

    await notify_location_managers(
        db,
        location_id=location.id,
        type="schedule_published",
        title="Week published",
        body=f"You published {len(shift_ids)} shift(s) for week of {week_start.isoformat()}.",
        payload={"location_id": str(location.id), "week_start": week_start.isoformat()},
    )


async def notify_overtime_warning(
    db: AsyncSession,
    *,
    user_id: UUID,
    assigned_hours: float,
    location_id: UUID,
) -> None:
    await notify_user(
        db,
        user_id=user_id,
        type="overtime_warning",
        title="Overtime hours warning",
        body=f"You are scheduled for {assigned_hours:.1f}h this week (overtime threshold is 40h).",
        payload={"assigned_hours": assigned_hours, "location_id": str(location_id)},
    )


async def notify_managers_overtime(
    db: AsyncSession,
    *,
    location_id: UUID,
    staff_name: str,
    assigned_hours: float,
) -> None:
    await notify_location_managers(
        db,
        location_id=location_id,
        type="overtime_warning",
        title="Staff overtime risk",
        body=f"{staff_name} is scheduled for {assigned_hours:.1f}h this week.",
        payload={"assigned_hours": assigned_hours},
    )


async def load_shift_with_assignments(db: AsyncSession, shift_id: UUID) -> Shift | None:
    result = await db.execute(
        select(Shift)
        .where(Shift.id == shift_id)
        .options(selectinload(Shift.assignments)),
    )
    return result.scalar_one_or_none()

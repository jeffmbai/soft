from datetime import date, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.enums import ShiftStatus, UserRole
from app.models.shift import Shift, ShiftAssignment
from app.models.staff import AvailabilityException, AvailabilityWindow
from app.models.user import User
from app.schemas.scheduling import (
    AvailabilityExceptionInput,
    AvailabilityResponse,
    AvailabilityUpdateRequest,
    AvailabilityWindowInput,
    MyShiftResponse,
)

router = APIRouter(tags=["availability"])


def _parse_time(value: str) -> time:
    parts = value.split(":")
    return time(int(parts[0]), int(parts[1]))


@router.get("/me/availability", response_model=AvailabilityResponse)
async def get_my_availability(
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.availability_windows), selectinload(User.availability_exceptions), selectinload(User.staff_profile))
    )
    u = result.scalar_one()
    tz = u.staff_profile.availability_timezone if u.staff_profile else "America/Los_Angeles"
    return AvailabilityResponse(
        timezone=tz,
        windows=[
            AvailabilityWindowInput(
                day_of_week=w.day_of_week,
                start_time=w.start_time.strftime("%H:%M"),
                end_time=w.end_time.strftime("%H:%M"),
            )
            for w in u.availability_windows
        ],
        exceptions=[
            AvailabilityExceptionInput(
                date=e.date,
                is_available=e.is_available,
                start_time=e.start_time.strftime("%H:%M") if e.start_time else None,
                end_time=e.end_time.strftime("%H:%M") if e.end_time else None,
            )
            for e in u.availability_exceptions
        ],
    )


@router.put("/me/availability", response_model=AvailabilityResponse)
async def update_my_availability(
    body: AvailabilityUpdateRequest,
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.staff_profile)),
    )
    db_user = result.scalar_one()
    if db_user.staff_profile:
        db_user.staff_profile.availability_timezone = body.timezone

    await db.execute(delete(AvailabilityWindow).where(AvailabilityWindow.user_id == user.id))
    await db.execute(delete(AvailabilityException).where(AvailabilityException.user_id == user.id))

    for w in body.windows:
        db.add(
            AvailabilityWindow(
                user_id=user.id,
                day_of_week=w.day_of_week,
                start_time=_parse_time(w.start_time),
                end_time=_parse_time(w.end_time),
                timezone=body.timezone,
            )
        )
    for e in body.exceptions:
        db.add(
            AvailabilityException(
                user_id=user.id,
                date=e.date,
                is_available=e.is_available,
                start_time=_parse_time(e.start_time) if e.start_time else None,
                end_time=_parse_time(e.end_time) if e.end_time else None,
            )
        )
    await db.commit()
    return await get_my_availability(user=user, db=db)


@router.get("/my/shifts", response_model=list[MyShiftResponse])
async def my_shifts(
    week: date | None = None,
    upcoming: bool = False,
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta, timezone

    q = (
        select(ShiftAssignment, Shift)
        .join(Shift, ShiftAssignment.shift_id == Shift.id)
        .where(ShiftAssignment.user_id == user.id, Shift.status == ShiftStatus.published)
        .options(selectinload(Shift.location))
        .order_by(Shift.starts_at)
    )
    if upcoming:
        q = q.where(Shift.starts_at >= datetime.now(timezone.utc))
    elif week:
        week_start = week - timedelta(days=week.weekday())
        week_end = week_start + timedelta(days=7)
        q = q.where(
            Shift.starts_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            Shift.starts_at < week_end,
        )
    result = await db.execute(q)
    rows = result.all()
    return [
        MyShiftResponse(
            assignment_id=a.id,
            shift_id=s.id,
            location_id=s.location_id,
            location_name=s.location.name,
            location_timezone=s.location.timezone,
            starts_at=s.starts_at,
            ends_at=s.ends_at,
            required_skill=s.required_skill,
            status=s.status,
        )
        for a, s in rows
    ]

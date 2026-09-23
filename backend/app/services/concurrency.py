from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.shift import Shift, ShiftAssignment


async def count_shift_assignments(db: AsyncSession, shift_id: UUID) -> int:
    result = await db.scalar(
        select(func.count()).select_from(ShiftAssignment).where(ShiftAssignment.shift_id == shift_id),
    )
    return int(result or 0)


async def lock_shift(db: AsyncSession, shift_id: UUID) -> Shift:
    result = await db.execute(
        select(Shift)
        .where(Shift.id == shift_id)
        .options(
            selectinload(Shift.assignments).selectinload(ShiftAssignment.user),
            selectinload(Shift.location),
        )
        .with_for_update(),
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift

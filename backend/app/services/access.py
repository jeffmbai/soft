from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.location import Location
from app.models.user import ManagerLocation, User


async def get_accessible_location_ids(user: User, db: AsyncSession) -> set[UUID] | None:
    """None means all locations (admin)."""
    if user.role == UserRole.admin:
        return None
    if user.role == UserRole.manager:
        result = await db.execute(
            select(ManagerLocation.location_id).where(ManagerLocation.manager_id == user.id)
        )
        return {row[0] for row in result.all()}
    return set()


async def require_location_access(
    location_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Location:
    result = await db.execute(select(Location).where(Location.id == location_id))
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    allowed = await get_accessible_location_ids(user, db)
    if allowed is not None and location_id not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this location")
    return location

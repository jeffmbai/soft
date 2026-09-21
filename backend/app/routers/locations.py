from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.location import Location
from app.models.user import User

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationResponse(BaseModel):
    id: UUID
    name: str
    timezone: str
    address: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[LocationResponse])
async def list_locations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Location).order_by(Location.name))
    return result.scalars().all()

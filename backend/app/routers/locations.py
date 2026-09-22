from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.location import Location
from app.models.user import ManagerLocation, User
from app.services.access import get_accessible_location_ids

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationResponse(BaseModel):
    id: UUID
    name: str
    timezone: str
    address: str

    model_config = {"from_attributes": True}


class ManagerBrief(BaseModel):
    id: UUID
    name: str
    email: str


class LocationOverviewResponse(LocationResponse):
    managers: list[ManagerBrief]


class SetLocationManagersRequest(BaseModel):
    manager_ids: list[UUID] = Field(default_factory=list)


@router.get("/managers", response_model=list[ManagerBrief])
async def list_managers(
    user: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == UserRole.manager).order_by(User.name),
    )
    return [
        ManagerBrief(id=m.id, name=m.name, email=m.email)
        for m in result.scalars().all()
    ]


@router.get("", response_model=list[LocationResponse])
async def list_locations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = await get_accessible_location_ids(user, db)
    q = select(Location).order_by(Location.name)
    if allowed is not None:
        q = q.where(Location.id.in_(allowed)) if allowed else q.where(False)
    result = await db.execute(q)
    return result.scalars().all()


@router.get(
    "/overview",
    response_model=list[LocationOverviewResponse],
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def list_locations_overview(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Location)
        .options(selectinload(Location.managers).selectinload(ManagerLocation.manager))
        .order_by(Location.name),
    )
    locations = result.scalars().unique().all()
    return [
        LocationOverviewResponse(
            id=loc.id,
            name=loc.name,
            timezone=loc.timezone,
            address=loc.address,
            managers=[
                ManagerBrief(id=ml.manager.id, name=ml.manager.name, email=ml.manager.email)
                for ml in loc.managers
                if ml.manager is not None
            ],
        )
        for loc in locations
    ]


@router.put(
    "/{location_id}/managers",
    response_model=LocationOverviewResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def set_location_managers(
    location_id: UUID,
    body: SetLocationManagersRequest,
    db: AsyncSession = Depends(get_db),
):
    loc_result = await db.execute(select(Location).where(Location.id == location_id))
    location = loc_result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    if body.manager_ids:
        mgr_result = await db.execute(
            select(User.id).where(
                User.id.in_(body.manager_ids),
                User.role == UserRole.manager,
            ),
        )
        valid_ids = {row[0] for row in mgr_result.all()}
        if len(valid_ids) != len(set(body.manager_ids)):
            raise HTTPException(status_code=400, detail="One or more manager IDs are invalid")

    await db.execute(delete(ManagerLocation).where(ManagerLocation.location_id == location_id))
    for manager_id in body.manager_ids:
        db.add(ManagerLocation(manager_id=manager_id, location_id=location_id))
    await db.commit()

    result = await db.execute(
        select(Location)
        .where(Location.id == location_id)
        .options(selectinload(Location.managers).selectinload(ManagerLocation.manager)),
    )
    loc = result.scalar_one()
    return LocationOverviewResponse(
        id=loc.id,
        name=loc.name,
        timezone=loc.timezone,
        address=loc.address,
        managers=[
            ManagerBrief(id=ml.manager.id, name=ml.manager.name, email=ml.manager.email)
            for ml in loc.managers
            if ml.manager is not None
        ],
    )

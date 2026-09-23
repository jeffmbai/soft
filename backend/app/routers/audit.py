from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.scheduling import AuditLogListItem
from app.services.audit_list import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogListItem])
async def get_audit_logs(
    location_id: UUID | None = None,
    entity_type: str | None = Query(default=None, pattern="^(shift|assignment|swap_request|schedule_week)$"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    return await list_audit_logs(
        db,
        user=user,
        location_id=location_id,
        entity_type=entity_type,
        limit=limit,
        offset=offset,
    )

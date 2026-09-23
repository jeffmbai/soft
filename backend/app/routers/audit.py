import csv
import io
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    return await list_audit_logs(
        db,
        user=user,
        location_id=location_id,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@router.get("/export")
async def export_audit_logs(
    location_id: UUID | None = None,
    entity_type: str | None = Query(default=None, pattern="^(shift|assignment|swap_request|schedule_week)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    entries = await list_audit_logs(
        db,
        user=user,
        location_id=location_id,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
        limit=5000,
        offset=0,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "created_at",
            "entity_type",
            "location_name",
            "actor_name",
            "shift_id",
            "before_state",
            "after_state",
        ],
    )
    for entry in entries:
        writer.writerow(
            [
                entry.created_at.isoformat(),
                entry.entity_type,
                entry.location_name or "",
                entry.actor_name or "",
                str(entry.shift_id) if entry.shift_id else "",
                str(entry.before_state) if entry.before_state else "",
                str(entry.after_state) if entry.after_state else "",
            ],
        )

    filename = "audit-log.csv"
    if date_from and date_to:
        filename = f"audit-log_{date_from}_{date_to}.csv"
    elif date_from:
        filename = f"audit-log_from_{date_from}.csv"

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

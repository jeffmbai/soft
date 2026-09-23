from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.location import Location
from app.models.shift import Shift
from app.models.swap import SwapRequest
from app.models.user import User
from app.schemas.scheduling import AuditLogListItem
from app.services.access import get_accessible_location_ids


async def list_audit_logs(
    db: AsyncSession,
    *,
    user,
    location_id: UUID | None = None,
    entity_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLogListItem]:
    allowed = await get_accessible_location_ids(user, db)
    if allowed is not None and not allowed:
        return []

    if location_id is not None:
        if allowed is not None and location_id not in allowed:
            return []
        scope_locations = {location_id}
    elif allowed is None:
        scope_locations = None
    else:
        scope_locations = allowed

    conditions = []
    if scope_locations is None:
        conditions.extend([
            AuditLog.entity_type == "shift",
            AuditLog.entity_type == "assignment",
            AuditLog.entity_type == "swap_request",
            AuditLog.entity_type == "schedule_week",
        ])
    else:
        loc_list = list(scope_locations)
        shift_ids_q = select(Shift.id).where(Shift.location_id.in_(loc_list))
        swap_ids_q = (
            select(SwapRequest.id)
            .join(Shift, SwapRequest.shift_id == Shift.id)
            .where(Shift.location_id.in_(loc_list))
        )
        conditions.extend([
            (AuditLog.entity_type == "shift") & (AuditLog.entity_id.in_(shift_ids_q)),
            (AuditLog.entity_type == "assignment") & (AuditLog.entity_id.in_(shift_ids_q)),
            (AuditLog.entity_type == "swap_request") & (AuditLog.entity_id.in_(swap_ids_q)),
            (AuditLog.entity_type == "schedule_week") & (AuditLog.entity_id.in_(loc_list)),
        ])

    filters = [or_(*conditions)]
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if date_from is not None:
        filters.append(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to is not None:
        filters.append(AuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))

    query = (
        select(AuditLog, User.name.label("actor_name"))
        .outerjoin(User, AuditLog.actor_id == User.id)
        .where(*filters)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 200))
        .offset(offset)
    )

    rows = (await db.execute(query)).all()
    if not rows:
        return []

    logs = [row[0] for row in rows]
    actor_names = {row[0].id: row[1] for row in rows}

    shift_entity_ids = {
        log.entity_id
        for log in logs
        if log.entity_type in ("shift", "assignment")
    }
    swap_entity_ids = {log.entity_id for log in logs if log.entity_type == "swap_request"}
    location_entity_ids = {log.entity_id for log in logs if log.entity_type == "schedule_week"}

    shift_map: dict[UUID, Shift] = {}
    if shift_entity_ids:
        shift_rows = await db.execute(select(Shift).where(Shift.id.in_(shift_entity_ids)))
        shift_map = {s.id: s for s in shift_rows.scalars().all()}

    swap_shift_map: dict[UUID, UUID] = {}
    if swap_entity_ids:
        swap_rows = await db.execute(
            select(SwapRequest.id, SwapRequest.shift_id).where(SwapRequest.id.in_(swap_entity_ids)),
        )
        swap_shift_map = {row[0]: row[1] for row in swap_rows.all()}
        extra_shift_ids = set(swap_shift_map.values()) - set(shift_map.keys())
        if extra_shift_ids:
            extra = await db.execute(select(Shift).where(Shift.id.in_(extra_shift_ids)))
            for s in extra.scalars().all():
                shift_map[s.id] = s

    location_ids = {s.location_id for s in shift_map.values()} | location_entity_ids
    location_map: dict[UUID, Location] = {}
    if location_ids:
        loc_rows = await db.execute(select(Location).where(Location.id.in_(location_ids)))
        location_map = {loc.id: loc for loc in loc_rows.scalars().all()}

    items: list[AuditLogListItem] = []
    for log in logs:
        shift_id: UUID | None = None
        loc_id: UUID | None = None
        loc_name: str | None = None

        if log.entity_type in ("shift", "assignment"):
            shift_id = log.entity_id
            shift = shift_map.get(log.entity_id)
            if shift:
                loc_id = shift.location_id
                loc_name = location_map.get(shift.location_id).name if shift.location_id in location_map else None
        elif log.entity_type == "swap_request":
            shift_id = swap_shift_map.get(log.entity_id)
            if shift_id and shift_id in shift_map:
                loc_id = shift_map[shift_id].location_id
                loc_name = location_map.get(loc_id).name if loc_id and loc_id in location_map else None
        elif log.entity_type == "schedule_week":
            loc_id = log.entity_id
            loc = location_map.get(log.entity_id)
            loc_name = loc.name if loc else None

        items.append(
            AuditLogListItem(
                id=log.id,
                entity_type=log.entity_type,
                actor_id=log.actor_id,
                before_state=log.before_state,
                after_state=log.after_state,
                created_at=log.created_at,
                actor_name=actor_names.get(log.id),
                location_id=loc_id,
                location_name=loc_name,
                shift_id=shift_id,
            ),
        )

    return items

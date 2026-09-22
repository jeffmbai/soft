from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def log_change(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: UUID,
    actor_id: UUID | None,
    before: dict | None,
    after: dict | None,
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            before_state=before,
            after_state=after,
        )
    )

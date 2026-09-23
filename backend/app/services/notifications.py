from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import EmailOutbox, Notification, NotificationPreference
from app.models.user import ManagerLocation, User


async def get_or_create_preferences(db: AsyncSession, user_id: UUID) -> NotificationPreference:
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id),
    )
    pref = result.scalar_one_or_none()
    if pref:
        return pref
    pref = NotificationPreference(user_id=user_id, in_app=True, email_sim=False)
    db.add(pref)
    await db.flush()
    return pref


async def notify_location_managers(
    db: AsyncSession,
    *,
    location_id: UUID,
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
) -> None:
    result = await db.execute(
        select(ManagerLocation.manager_id).where(ManagerLocation.location_id == location_id),
    )
    for (manager_id,) in result.all():
        await notify_user(
            db,
            user_id=manager_id,
            type=type,
            title=title,
            body=body,
            payload=payload,
        )


async def notify_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
) -> None:
    pref = await get_or_create_preferences(db, user_id)
    user = await db.get(User, user_id)

    if pref.in_app:
        db.add(
            Notification(
                user_id=user_id,
                type=type,
                title=title,
                body=body,
                payload=payload,
            ),
        )

    if pref.email_sim and user:
        db.add(
            EmailOutbox(
                to_email=user.email,
                subject=title,
                body=body,
            ),
        )

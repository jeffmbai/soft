from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notifications import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
)
from app.services.notifications import get_or_create_preferences

router = APIRouter(tags=["notifications"])


@router.get("/me/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50),
    )
    return result.scalars().all()


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        ),
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/me/notification-preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = await get_or_create_preferences(db, user.id)
    await db.commit()
    return NotificationPreferenceResponse(in_app=pref.in_app, email_sim=pref.email_sim)


@router.patch("/me/notification-preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    body: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = await get_or_create_preferences(db, user.id)
    if body.in_app is not None:
        pref.in_app = body.in_app
    if body.email_sim is not None:
        pref.email_sim = body.email_sim
    await db.commit()
    await db.refresh(pref)
    return NotificationPreferenceResponse(in_app=pref.in_app, email_sim=pref.email_sim)

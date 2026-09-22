from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    payload: dict | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceResponse(BaseModel):
    in_app: bool
    email_sim: bool


class NotificationPreferenceUpdate(BaseModel):
    in_app: bool | None = None
    email_sim: bool | None = None

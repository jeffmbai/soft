from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import SwapStatus, SwapType


class SwapCreateRequest(BaseModel):
    assignment_id: UUID
    type: SwapType
    target_user_id: UUID | None = None
    counterpart_assignment_id: UUID | None = None


class SwapUserBrief(BaseModel):
    id: UUID
    name: str


class SwapShiftBrief(BaseModel):
    shift_id: UUID
    location_id: UUID
    location_name: str
    location_timezone: str
    starts_at: datetime
    ends_at: datetime
    required_skill: str


class SwapRequestResponse(BaseModel):
    id: UUID
    type: SwapType
    status: SwapStatus
    expires_at: datetime | None
    created_at: datetime
    requester: SwapUserBrief
    target: SwapUserBrief | None
    shift: SwapShiftBrief
    can_accept: bool = False
    can_approve: bool = False
    can_cancel: bool = False
    can_claim: bool = False
    claim_block_reason: str | None = None

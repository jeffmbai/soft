from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DutyStaffMember(BaseModel):
    assignment_id: UUID
    user_id: UUID
    name: str
    initials: str
    skill: str
    shift_starts_at: datetime
    shift_ends_at: datetime
    status: str  # scheduled | clocked_in | tardy | clocked_out
    clocked_in_at: datetime | None = None
    can_clock_in: bool = False
    can_clock_out: bool = False


class DutyShiftGroup(BaseModel):
    shift_id: UUID
    location_id: UUID
    location_name: str
    skill: str
    starts_at: datetime
    ends_at: datetime
    headcount: int
    assigned: int
    gaps: int
    staff: list[DutyStaffMember]


class DutyLocationSummary(BaseModel):
    location_id: UUID
    name: str
    timezone: str
    scheduled_count: int
    clocked_in_count: int
    tardy_count: int
    gap_count: int
    active_shifts: int


class DutyActivityItem(BaseModel):
    id: UUID
    at: datetime
    label: str
    tone: str  # ok | warn | error | neutral


class DutySummaryResponse(BaseModel):
    total_clocked_in: int
    total_scheduled: int
    total_tardy: int
    total_gaps: int
    active_shifts: int


class DutyFloorResponse(BaseModel):
    updated_at: datetime
    total_clocked_in: int
    locations: list[DutyLocationSummary]
    shifts: list[DutyShiftGroup]
    activity: list[DutyActivityItem]


class ClockActionRequest(BaseModel):
    assignment_id: UUID


class WsTokenResponse(BaseModel):
    token: str
    expires_in: int

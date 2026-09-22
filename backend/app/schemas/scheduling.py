from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import AssignmentStatus, ShiftStatus, Skill


class ViolationSeverity(str, Enum):
    error = "error"
    warning = "warning"


class ViolationResponse(BaseModel):
    rule: str
    message: str
    severity: ViolationSeverity


class SuggestionResponse(BaseModel):
    user_id: UUID
    name: str
    reason: str


class ShiftCreateRequest(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    local_date: date | None = None
    local_start_time: str | None = None  # HH:MM in location timezone
    local_end_time: str | None = None
    required_skill: Skill
    headcount: int = Field(default=1, ge=1, le=20)


class ShiftUpdateRequest(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    required_skill: Skill | None = None
    headcount: int | None = Field(default=None, ge=1, le=20)
    version: int


class AssignmentBrief(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    status: AssignmentStatus


class ShiftResponse(BaseModel):
    id: UUID
    location_id: UUID
    starts_at: datetime
    ends_at: datetime
    required_skill: Skill
    headcount: int
    status: ShiftStatus
    version: int
    assignments: list[AssignmentBrief] = []


class ScheduleWeekResponse(BaseModel):
    location_id: UUID
    week_start: date
    published_at: datetime | None
    is_published: bool
    shifts: list[ShiftResponse]


class AssignRequest(BaseModel):
    user_id: UUID
    override_reason: str | None = None


class AssignPreviewRequest(BaseModel):
    user_id: UUID


class AssignResultResponse(BaseModel):
    success: bool
    assignment_id: UUID | None = None
    violations: list[ViolationResponse] = []
    suggestions: list[SuggestionResponse] = []


class PublishWeekResponse(BaseModel):
    location_id: UUID
    week_start: date
    published_at: datetime
    shifts_published: int


class MyShiftResponse(BaseModel):
    assignment_id: UUID
    shift_id: UUID
    location_id: UUID
    location_name: str
    location_timezone: str
    starts_at: datetime
    ends_at: datetime
    required_skill: Skill
    status: ShiftStatus


class AvailabilityWindowInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityExceptionInput(BaseModel):
    date: date
    is_available: bool = True
    start_time: str | None = None
    end_time: str | None = None


class AvailabilityUpdateRequest(BaseModel):
    timezone: str
    windows: list[AvailabilityWindowInput]
    exceptions: list[AvailabilityExceptionInput] = []


class AvailabilityResponse(BaseModel):
    timezone: str
    windows: list[AvailabilityWindowInput]
    exceptions: list[AvailabilityExceptionInput]

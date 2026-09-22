from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Skill, UserRole


class StaffLocationBrief(BaseModel):
    id: UUID
    name: str
    timezone: str

    model_config = {"from_attributes": True}


class StaffMemberResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: UserRole
    desired_hours_per_week: int | None
    assigned_hours: float
    skills: list[str]
    locations: list[StaffLocationBrief]
    availability_summary: str
    availability_hours: str
    availability_timezone: str

    model_config = {"from_attributes": True}


class StaffCreateRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(default="password123", min_length=6)
    desired_hours_per_week: int = Field(default=32, ge=0, le=80)
    availability_timezone: str = "America/Los_Angeles"
    skills: list[Skill] = Field(min_length=1)
    location_ids: list[UUID] = Field(min_length=1)


class StaffUpdateRequest(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    desired_hours_per_week: int | None = Field(default=None, ge=0, le=80)
    availability_timezone: str | None = None
    skills: list[Skill] | None = None
    location_ids: list[UUID] | None = None

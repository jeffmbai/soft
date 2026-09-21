import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import AssignmentStatus, ShiftStatus, Skill


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    required_skill: Mapped[Skill] = mapped_column(Enum(Skill, name="shift_skill"), nullable=False)
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[ShiftStatus] = mapped_column(Enum(ShiftStatus, name="shift_status"), default=ShiftStatus.draft)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    location: Mapped["Location"] = relationship(back_populates="shifts")
    assignments: Mapped[list["ShiftAssignment"]] = relationship(back_populates="shift")


class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus, name="assignment_status"), default=AssignmentStatus.assigned
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    override_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    shift: Mapped["Shift"] = relationship(back_populates="assignments")
    user: Mapped["User"] = relationship(back_populates="shift_assignments")


class ScheduleWeek(Base):
    __tablename__ = "schedule_weeks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    location: Mapped["Location"] = relationship(back_populates="schedule_weeks")

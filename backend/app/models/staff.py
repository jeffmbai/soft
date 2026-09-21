import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import Skill


class StaffProfile(Base):
    __tablename__ = "staff_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    desired_hours_per_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    availability_timezone: Mapped[str] = mapped_column(String(64), default="America/Los_Angeles")

    user: Mapped["User"] = relationship(back_populates="staff_profile")


class StaffLocationCert(Base):
    __tablename__ = "staff_location_certs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    certified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decertified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="location_certs")
    location: Mapped["Location"] = relationship(back_populates="staff_certs")


class StaffSkill(Base):
    __tablename__ = "staff_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill: Mapped[Skill] = mapped_column(Enum(Skill, name="skill"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="skills")


class AvailabilityWindow(Base):
    __tablename__ = "availability_windows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon .. 6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)

    user: Mapped["User"] = relationship(back_populates="availability_windows")


class AvailabilityException(Base):
    __tablename__ = "availability_exceptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    user: Mapped["User"] = relationship(back_populates="availability_exceptions")

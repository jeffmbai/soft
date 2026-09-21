import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    staff_profile: Mapped["StaffProfile | None"] = relationship(back_populates="user", uselist=False)
    manager_locations: Mapped[list["ManagerLocation"]] = relationship(back_populates="manager")
    location_certs: Mapped[list["StaffLocationCert"]] = relationship(back_populates="user")
    skills: Mapped[list["StaffSkill"]] = relationship(back_populates="user")
    availability_windows: Mapped[list["AvailabilityWindow"]] = relationship(back_populates="user")
    availability_exceptions: Mapped[list["AvailabilityException"]] = relationship(back_populates="user")
    shift_assignments: Mapped[list["ShiftAssignment"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    notification_preference: Mapped["NotificationPreference | None"] = relationship(back_populates="user", uselist=False)


class ManagerLocation(Base):
    __tablename__ = "manager_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manager_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)

    manager: Mapped["User"] = relationship(back_populates="manager_locations")
    location: Mapped["Location"] = relationship(back_populates="managers")

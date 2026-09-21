import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    address: Mapped[str] = mapped_column(String(512), nullable=False)
    schedule_cutoff_hours: Mapped[int] = mapped_column(default=48)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    managers: Mapped[list["ManagerLocation"]] = relationship(back_populates="location")
    shifts: Mapped[list["Shift"]] = relationship(back_populates="location")
    schedule_weeks: Mapped[list["ScheduleWeek"]] = relationship(back_populates="location")
    staff_certs: Mapped[list["StaffLocationCert"]] = relationship(back_populates="location")

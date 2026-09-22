"""Seed Coastal Eats demo data."""
import asyncio
import uuid
from datetime import time

from sqlalchemy import select

from app.database import async_session
from app.models.enums import Skill, UserRole
from app.models.location import Location
from app.models.notification import NotificationPreference
from app.models.staff import AvailabilityWindow, StaffLocationCert, StaffProfile, StaffSkill
from app.models.user import ManagerLocation, User
from app.models.shift import ScheduleWeek, Shift, ShiftAssignment
from app.security import hash_password

DEMO_PASSWORD = "password123"


async def seed() -> None:
    async with async_session() as db:
        existing = await db.execute(select(User).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded, skipping.")
            return

        # --- Locations ---
        locations = [
            Location(name="Pier House", timezone="America/Los_Angeles", address="100 Pier Ave, Santa Monica, CA"),
            Location(name="Harbor Grill", timezone="America/Los_Angeles", address="200 Harbor Blvd, San Diego, CA"),
            Location(name="Boardwalk Bistro", timezone="America/New_York", address="50 Boardwalk, Atlantic City, NJ"),
            Location(name="Lighthouse Cafe", timezone="America/New_York", address="12 Lighthouse Rd, Charleston, SC"),
        ]
        db.add_all(locations)
        await db.flush()

        pier, harbor, boardwalk, lighthouse = locations

        # --- Admin ---
        admin = User(
            email="admin@coastaleats.com",
            password_hash=hash_password(DEMO_PASSWORD),
            name="Alex Corporate",
            role=UserRole.admin,
        )
        db.add(admin)

        # --- Managers ---
        mgr_west = User(
            email="manager.west@coastaleats.com",
            password_hash=hash_password(DEMO_PASSWORD),
            name="Jordan West",
            role=UserRole.manager,
        )
        mgr_east = User(
            email="manager.east@coastaleats.com",
            password_hash=hash_password(DEMO_PASSWORD),
            name="Taylor East",
            role=UserRole.manager,
        )
        db.add_all([mgr_west, mgr_east])
        await db.flush()

        db.add_all([
            ManagerLocation(manager_id=mgr_west.id, location_id=pier.id),
            ManagerLocation(manager_id=mgr_west.id, location_id=harbor.id),
            ManagerLocation(manager_id=mgr_east.id, location_id=boardwalk.id),
            ManagerLocation(manager_id=mgr_east.id, location_id=lighthouse.id),
        ])

        # --- Staff ---
        staff_data = [
            ("sam@coastaleats.com", "Sam Rivera", [Skill.server, Skill.host], [pier, harbor], "America/Los_Angeles", 32),
            ("maria@coastaleats.com", "Maria Chen", [Skill.bartender], [pier, boardwalk], "America/Los_Angeles", 40),
            ("john@coastaleats.com", "John Okonkwo", [Skill.line_cook, Skill.server], [harbor, lighthouse], "America/New_York", 36),
            ("sarah@coastaleats.com", "Sarah Kim", [Skill.bartender, Skill.server], [pier], "America/Los_Angeles", 28),
            ("devon@coastaleats.com", "Devon Patel", [Skill.host], [boardwalk, lighthouse], "America/New_York", 25),
            ("casey@coastaleats.com", "Casey Morgan", [Skill.line_cook], [harbor], "America/Los_Angeles", 40),
            ("riley@coastaleats.com", "Riley Brooks", [Skill.server], [pier, boardwalk], "America/Los_Angeles", 30),
            ("alex.staff@coastaleats.com", "Alex Nguyen", [Skill.bartender], [harbor, lighthouse], "America/New_York", 35),
        ]

        for email, name, skills, locs, tz, desired in staff_data:
            user = User(
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                name=name,
                role=UserRole.staff,
            )
            db.add(user)
            await db.flush()

            db.add(StaffProfile(user_id=user.id, desired_hours_per_week=desired, availability_timezone=tz))
            for skill in skills:
                db.add(StaffSkill(user_id=user.id, skill=skill))
            for loc in locs:
                db.add(StaffLocationCert(user_id=user.id, location_id=loc.id))
            # Mon-Fri 9am-5pm availability
            for day in range(5):
                db.add(AvailabilityWindow(
                    user_id=user.id,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                    timezone=tz,
                ))
            db.add(NotificationPreference(user_id=user.id, in_app=True, email_sim=True))

        db.add(NotificationPreference(user_id=admin.id, in_app=True, email_sim=False))
        db.add(NotificationPreference(user_id=mgr_west.id, in_app=True, email_sim=True))
        db.add(NotificationPreference(user_id=mgr_east.id, in_app=True, email_sim=True))

        await db.commit()
        print("Seed complete!")
        print("Demo password for all users:", DEMO_PASSWORD)
        print("Admin: admin@coastaleats.com")
        print("Manager (West): manager.west@coastaleats.com")
        print("Manager (East): manager.east@coastaleats.com")
        print("Staff example: sam@coastaleats.com")


async def seed_scheduling() -> None:
    """Add demo shifts if none exist."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from app.models.enums import ShiftStatus, Skill
    from app.models.shift import ScheduleWeek, Shift, ShiftAssignment

    async with async_session() as db:
        existing = await db.execute(select(Shift).limit(1))
        if existing.scalar_one_or_none():
            print("Scheduling data already seeded, skipping.")
            return

        loc_result = await db.execute(select(Location))
        locations = {l.name: l for l in loc_result.scalars().all()}
        pier = locations["Pier House"]
        harbor = locations["Harbor Grill"]

        staff_result = await db.execute(select(User).where(User.role == UserRole.staff))
        staff = {u.email: u for u in staff_result.scalars().all()}

        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=today.weekday())

        def shift_at(loc, day_offset, hour, duration, skill, headcount=1):
            d = week_start + timedelta(days=day_offset)
            start = datetime(d.year, d.month, d.day, hour, 0, tzinfo=timezone.utc)
            end = start + timedelta(hours=duration)
            return Shift(
                location_id=loc.id,
                starts_at=start,
                ends_at=end,
                required_skill=skill,
                headcount=headcount,
                status=ShiftStatus.draft,
            )

        shifts = [
            shift_at(pier, 0, 14, 8, Skill.server, 2),
            shift_at(pier, 1, 14, 8, Skill.bartender, 1),
            shift_at(pier, 2, 17, 6, Skill.bartender, 1),
            shift_at(pier, 4, 17, 7, Skill.server, 2),
            shift_at(pier, 5, 17, 8, Skill.bartender, 1),
            shift_at(harbor, 0, 15, 8, Skill.line_cook, 1),
            shift_at(harbor, 3, 14, 10, Skill.line_cook, 1),
        ]
        db.add_all(shifts)
        await db.flush()

        s0, s1, s2, s3, s4, s5, s6 = shifts

        db.add_all([
            ShiftAssignment(shift_id=s0.id, user_id=staff["sam@coastaleats.com"].id),
            ShiftAssignment(shift_id=s0.id, user_id=staff["riley@coastaleats.com"].id),
            ShiftAssignment(shift_id=s1.id, user_id=staff["maria@coastaleats.com"].id),
            ShiftAssignment(shift_id=s2.id, user_id=staff["sarah@coastaleats.com"].id),
            ShiftAssignment(shift_id=s4.id, user_id=staff["maria@coastaleats.com"].id),
            ShiftAssignment(shift_id=s5.id, user_id=staff["casey@coastaleats.com"].id),
            ShiftAssignment(shift_id=s6.id, user_id=staff["casey@coastaleats.com"].id),
        ])

        # Publish pier house week partially
        for s in [s0, s1, s2, s3]:
            s.status = ShiftStatus.published
        db.add(
            ScheduleWeek(
                location_id=pier.id,
                week_start=week_start,
                published_at=datetime.now(timezone.utc),
            )
        )

        await db.commit()
        print("Scheduling seed complete!")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "scheduling":
        asyncio.run(seed_scheduling())
    else:
        asyncio.run(seed())

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


if __name__ == "__main__":
    asyncio.run(seed())

import csv
import io
from datetime import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_roles
from app.models.enums import Skill, UserRole
from app.models.location import Location
from app.models.notification import NotificationPreference
from app.models.staff import AvailabilityException, AvailabilityWindow, StaffLocationCert, StaffProfile, StaffSkill
from app.models.user import User
from app.schemas.staff import StaffCreateRequest, StaffLocationBrief, StaffMemberResponse, StaffUpdateRequest
from app.security import hash_password

router = APIRouter(prefix="/staff", tags=["staff"])

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SKILL_LABELS = {
    Skill.bartender: "Bartender",
    Skill.line_cook: "Line Cook",
    Skill.server: "Server",
    Skill.host: "Host",
}


def _format_availability(windows: list[AvailabilityWindow]) -> tuple[str, str]:
    if not windows:
        return "Not set", "—"
    days = sorted({w.day_of_week for w in windows})
    if days == list(range(5)):
        day_label = "Mon–Fri"
    elif len(days) == 1:
        day_label = DAY_LABELS[days[0]]
    else:
        day_label = f"{DAY_LABELS[days[0]]}–{DAY_LABELS[days[-1]]}"
    start = min(w.start_time for w in windows)
    end = max(w.end_time for w in windows)
    hours = f"{start.strftime('%H:%M')} – {end.strftime('%H:%M')}"
    tz = windows[0].timezone.split("/")[-1].replace("_", " ")
    return f"{day_label} • {tz}", hours


def _serialize_user(user: User) -> StaffMemberResponse:
    profile = user.staff_profile
    loc_briefs = [
        StaffLocationBrief(id=c.location.id, name=c.location.name, timezone=c.location.timezone)
        for c in sorted(user.location_certs, key=lambda x: x.certified_at)
        if c.decertified_at is None and c.location is not None
    ]
    summary, hours = _format_availability(user.availability_windows)
    return StaffMemberResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        desired_hours_per_week=profile.desired_hours_per_week if profile else None,
        assigned_hours=0.0,
        skills=[SKILL_LABELS.get(s.skill, s.skill.value) for s in user.skills],
        locations=loc_briefs,
        availability_summary=summary,
        availability_hours=hours,
        availability_timezone=profile.availability_timezone if profile else "America/Los_Angeles",
    )


def _load_staff_query():
    return (
        select(User)
        .where(User.role == UserRole.staff)
        .options(
            selectinload(User.staff_profile),
            selectinload(User.skills),
            selectinload(User.location_certs).selectinload(StaffLocationCert.location),
            selectinload(User.availability_windows),
        )
        .order_by(User.name)
    )


def _apply_filters(
    stmt,
    q: str | None,
    skill: Skill | None,
    location_id: UUID | None,
    certification: str | None,
):
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like)))
    if skill:
        stmt = stmt.where(User.skills.any(StaffSkill.skill == skill))
    if location_id:
        stmt = stmt.where(
            User.location_certs.any(
                StaffLocationCert.location_id == location_id,
                StaffLocationCert.decertified_at.is_(None),
            )
        )
    if certification == "multi":
        multi_ids = (
            select(StaffLocationCert.user_id)
            .where(StaffLocationCert.decertified_at.is_(None))
            .group_by(StaffLocationCert.user_id)
            .having(func.count(StaffLocationCert.id) > 1)
        )
        stmt = stmt.where(User.id.in_(multi_ids))
    elif certification == "single":
        single_ids = (
            select(StaffLocationCert.user_id)
            .where(StaffLocationCert.decertified_at.is_(None))
            .group_by(StaffLocationCert.user_id)
            .having(func.count(StaffLocationCert.id) == 1)
        )
        stmt = stmt.where(User.id.in_(single_ids))
    return stmt


@router.get("", response_model=list[StaffMemberResponse])
async def list_staff(
    q: str | None = Query(None),
    skill: Skill | None = Query(None),
    location_id: UUID | None = Query(None),
    certification: str | None = Query(None, pattern="^(single|multi)$"),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    stmt = _apply_filters(_load_staff_query(), q, skill, location_id, certification)
    result = await db.execute(stmt)
    return [_serialize_user(u) for u in result.scalars().unique().all()]


@router.get("/export")
async def export_staff(
    q: str | None = Query(None),
    skill: Skill | None = Query(None),
    location_id: UUID | None = Query(None),
    certification: str | None = Query(None, pattern="^(single|multi)$"),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    stmt = _apply_filters(_load_staff_query(), q, skill, location_id, certification)
    result = await db.execute(stmt)
    rows = [_serialize_user(u) for u in result.scalars().unique().all()]

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Name", "Email", "Skills", "Locations", "Desired Hours", "Availability"])
    for row in rows:
        writer.writerow([
            row.name,
            row.email,
            "; ".join(row.skills),
            "; ".join(loc.name for loc in row.locations),
            row.desired_hours_per_week or "",
            row.availability_summary,
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="staff-roster.csv"'},
    )


@router.get("/{staff_id}", response_model=StaffMemberResponse)
async def get_staff(
    staff_id: UUID,
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    stmt = _load_staff_query().where(User.id == staff_id)
    result = await db.execute(stmt)
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return _serialize_user(staff)


@router.post("", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_staff(
    body: StaffCreateRequest,
    user: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    loc_result = await db.execute(select(Location).where(Location.id.in_(body.location_ids)))
    locations = loc_result.scalars().all()
    if len(locations) != len(body.location_ids):
        raise HTTPException(status_code=400, detail="One or more locations not found")

    new_user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
        role=UserRole.staff,
    )
    db.add(new_user)
    await db.flush()

    db.add(StaffProfile(
        user_id=new_user.id,
        desired_hours_per_week=body.desired_hours_per_week,
        availability_timezone=body.availability_timezone,
    ))
    for skill in body.skills:
        db.add(StaffSkill(user_id=new_user.id, skill=skill))
    for loc_id in body.location_ids:
        db.add(StaffLocationCert(user_id=new_user.id, location_id=loc_id))
    for day in range(5):
        db.add(AvailabilityWindow(
            user_id=new_user.id,
            day_of_week=day,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone=body.availability_timezone,
        ))
    db.add(NotificationPreference(user_id=new_user.id, in_app=True, email_sim=True))

    await db.commit()

    stmt = _load_staff_query().where(User.id == new_user.id)
    result = await db.execute(stmt)
    return _serialize_user(result.scalar_one())


@router.patch("/{staff_id}", response_model=StaffMemberResponse)
async def update_staff(
    staff_id: UUID,
    body: StaffUpdateRequest,
    user: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    stmt = _load_staff_query().where(User.id == staff_id)
    result = await db.execute(stmt)
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    if body.email and body.email != staff.email:
        dup = await db.execute(select(User).where(User.email == body.email, User.id != staff_id))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        staff.email = body.email
    if body.name is not None:
        staff.name = body.name

    if staff.staff_profile:
        if body.desired_hours_per_week is not None:
            staff.staff_profile.desired_hours_per_week = body.desired_hours_per_week
        if body.availability_timezone is not None:
            staff.staff_profile.availability_timezone = body.availability_timezone

    if body.skills is not None:
        await db.execute(delete(StaffSkill).where(StaffSkill.user_id == staff_id))
        for skill in body.skills:
            db.add(StaffSkill(user_id=staff_id, skill=skill))

    if body.location_ids is not None:
        loc_result = await db.execute(select(Location).where(Location.id.in_(body.location_ids)))
        if len(loc_result.scalars().all()) != len(body.location_ids):
            raise HTTPException(status_code=400, detail="One or more locations not found")
        await db.execute(delete(StaffLocationCert).where(StaffLocationCert.user_id == staff_id))
        for loc_id in body.location_ids:
            db.add(StaffLocationCert(user_id=staff_id, location_id=loc_id))

    await db.commit()

    result = await db.execute(_load_staff_query().where(User.id == staff_id))
    return _serialize_user(result.scalar_one())


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    staff_id: UUID,
    user: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == staff_id, User.role == UserRole.staff))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    await db.execute(delete(AvailabilityException).where(AvailabilityException.user_id == staff_id))
    await db.execute(delete(AvailabilityWindow).where(AvailabilityWindow.user_id == staff_id))
    await db.execute(delete(StaffSkill).where(StaffSkill.user_id == staff_id))
    await db.execute(delete(StaffLocationCert).where(StaffLocationCert.user_id == staff_id))
    await db.execute(delete(StaffProfile).where(StaffProfile.user_id == staff_id))
    await db.execute(delete(NotificationPreference).where(NotificationPreference.user_id == staff_id))
    await db.delete(staff)
    await db.commit()

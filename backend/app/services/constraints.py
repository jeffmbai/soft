"""Central constraint validation for shift assignments."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ShiftStatus, Skill, SwapStatus, UserRole
from app.models.location import Location
from app.models.shift import Shift, ShiftAssignment
from app.models.staff import (
    AvailabilityException,
    AvailabilityWindow,
    StaffLocationCert,
    StaffSkill,
)
from app.models.swap import SwapRequest
from app.models.user import User

REST_GAP_HOURS = 10
DAILY_WARN_HOURS = 8
DAILY_BLOCK_HOURS = 12
WEEKLY_WARN_HOURS = 35
WEEKLY_OT_HOURS = 40


class ViolationSeverity(str, Enum):
    error = "error"
    warning = "warning"


@dataclass
class Violation:
    rule: str
    message: str
    severity: ViolationSeverity


@dataclass
class Suggestion:
    user_id: UUID
    name: str
    reason: str


@dataclass
class ValidationResult:
    valid: bool
    violations: list[Violation] = field(default_factory=list)
    suggestions: list[Suggestion] = field(default_factory=list)

    @property
    def blocking(self) -> list[Violation]:
        return [v for v in self.violations if v.severity == ViolationSeverity.error]


def _hours_between(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _combine_local(d: date, t: time, tz: ZoneInfo) -> datetime:
    return datetime(d.year, d.month, d.day, t.hour, t.minute, t.second, tzinfo=tz)


def _shift_overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def _local_date(dt: datetime, tz_name: str) -> date:
    return dt.astimezone(ZoneInfo(tz_name)).date()


async def _load_user_context(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id, User.role == UserRole.staff)
        .options(
            selectinload(User.skills),
            selectinload(User.location_certs),
            selectinload(User.availability_windows),
            selectinload(User.availability_exceptions),
            selectinload(User.staff_profile),
        )
    )
    return result.scalar_one_or_none()


async def _load_assignments_for_user(
    db: AsyncSession,
    user_id: UUID,
    exclude_assignment_id: UUID | None = None,
) -> list[tuple[ShiftAssignment, Shift, Location]]:
    q = (
        select(ShiftAssignment, Shift, Location)
        .join(Shift, ShiftAssignment.shift_id == Shift.id)
        .join(Location, Shift.location_id == Location.id)
        .where(ShiftAssignment.user_id == user_id)
    )
    if exclude_assignment_id:
        q = q.where(ShiftAssignment.id != exclude_assignment_id)
    result = await db.execute(q)
    return list(result.all())


def _is_available(
    user: User,
    shift_start: datetime,
    shift_end: datetime,
    location_tz: str,
) -> tuple[bool, str]:
    loc_tz = ZoneInfo(location_tz)
    local_start = shift_start.astimezone(loc_tz)
    local_end = shift_end.astimezone(loc_tz)
    shift_date = local_start.date()
    dow = local_start.weekday()

    for exc in user.availability_exceptions:
        if exc.date == shift_date:
            if not exc.is_available:
                return False, f"Unavailable on {shift_date} (exception)"
            if exc.start_time and exc.end_time:
                exc_start = _combine_local(shift_date, exc.start_time, loc_tz)
                exc_end = _combine_local(shift_date, exc.end_time, loc_tz)
                if exc_end <= exc_start:
                    exc_end += timedelta(days=1)
                if shift_start >= exc_start and shift_end <= exc_end:
                    return True, "Available via exception"
                return False, f"Outside exception window on {shift_date}"

    windows = [w for w in user.availability_windows if w.day_of_week == dow]
    if not windows:
        return False, f"No availability on {local_start.strftime('%A')}"

    for w in windows:
        w_tz = ZoneInfo(w.timezone)
        w_start = _combine_local(local_start.date(), w.start_time, w_tz).astimezone(timezone.utc)
        w_end = _combine_local(local_start.date(), w.end_time, w_tz).astimezone(timezone.utc)
        if w.end_time <= w.start_time:
            w_end += timedelta(days=1)
        if shift_start >= w_start and shift_end <= w_end:
            return True, "Within recurring availability"

    return False, f"Shift {local_start.strftime('%H:%M')}–{local_end.strftime('%H:%M')} outside availability windows"


async def validate_assignment(
    db: AsyncSession,
    *,
    shift: Shift,
    location: Location,
    user_id: UUID,
    exclude_assignment_id: UUID | None = None,
    override_reason: str | None = None,
    actor_is_admin: bool = False,
) -> ValidationResult:
    violations: list[Violation] = []
    user = await _load_user_context(db, user_id)
    if not user:
        violations.append(Violation("staff_exists", "Staff member not found", ViolationSeverity.error))
        return ValidationResult(valid=False, violations=violations)

    # Certification
    certified = any(
        c.location_id == shift.location_id and c.decertified_at is None for c in user.location_certs
    )
    if not certified:
        violations.append(
            Violation(
                "certification",
                f"{user.name} is not certified for {location.name}",
                ViolationSeverity.error,
            )
        )

    # Skill
    user_skills = {s.skill for s in user.skills}
    if shift.required_skill not in user_skills:
        violations.append(
            Violation(
                "skill_match",
                f"{user.name} does not have skill '{shift.required_skill.value}'",
                ViolationSeverity.error,
            )
        )

    # Availability
    avail_ok, avail_msg = _is_available(user, shift.starts_at, shift.ends_at, location.timezone)
    if not avail_ok:
        violations.append(Violation("availability", avail_msg, ViolationSeverity.error))

    existing = await _load_assignments_for_user(db, user_id, exclude_assignment_id)

    # Double booking + rest gap
    for assignment, other_shift, other_loc in existing:
        if _shift_overlaps(shift.starts_at, shift.ends_at, other_shift.starts_at, other_shift.ends_at):
            violations.append(
                Violation(
                    "double_booking",
                    f"Overlaps with shift at {other_loc.name} "
                    f"({other_shift.starts_at.isoformat()} – {other_shift.ends_at.isoformat()})",
                    ViolationSeverity.error,
                )
            )
        gap_after = _hours_between(other_shift.ends_at, shift.starts_at)
        gap_before = _hours_between(shift.ends_at, other_shift.starts_at)
        if 0 <= gap_after < REST_GAP_HOURS:
            violations.append(
                Violation(
                    "rest_gap",
                    f"Only {gap_after:.1f}h after shift at {other_loc.name}; minimum {REST_GAP_HOURS}h required",
                    ViolationSeverity.error,
                )
            )
        if 0 <= gap_before < REST_GAP_HOURS:
            violations.append(
                Violation(
                    "rest_gap",
                    f"Only {gap_before:.1f}h before shift at {other_loc.name}; minimum {REST_GAP_HOURS}h required",
                    ViolationSeverity.error,
                )
            )

    # Hours in location TZ
    loc_tz = location.timezone
    day_shifts = [
        (s, l)
        for _, s, l in existing
        if _local_date(s.starts_at, loc_tz) == _local_date(shift.starts_at, loc_tz)
    ]
    day_hours = sum(_hours_between(s.starts_at, s.ends_at) for s, _ in day_shifts)
    day_hours += _hours_between(shift.starts_at, shift.ends_at)
    if day_hours > DAILY_BLOCK_HOURS:
        violations.append(
            Violation(
                "daily_hours",
                f"Would work {day_hours:.1f}h on {_local_date(shift.starts_at, loc_tz)}; max {DAILY_BLOCK_HOURS}h",
                ViolationSeverity.error,
            )
        )
    elif day_hours > DAILY_WARN_HOURS:
        violations.append(
            Violation(
                "daily_hours",
                f"Would work {day_hours:.1f}h on {_local_date(shift.starts_at, loc_tz)} (warning at {DAILY_WARN_HOURS}h)",
                ViolationSeverity.warning,
            )
        )

    week_start = _week_start(_local_date(shift.starts_at, loc_tz))
    week_end = week_start + timedelta(days=7)
    week_hours = 0.0
    for _, s, l in existing:
        ld = _local_date(s.starts_at, l.timezone)
        if week_start <= ld < week_end:
            week_hours += _hours_between(s.starts_at, s.ends_at)
    week_hours += _hours_between(shift.starts_at, shift.ends_at)
    if week_hours >= WEEKLY_OT_HOURS:
        violations.append(
            Violation(
                "weekly_hours",
                f"Would reach {week_hours:.1f}h this week (overtime at {WEEKLY_OT_HOURS}h)",
                ViolationSeverity.warning,
            )
        )
    elif week_hours >= WEEKLY_WARN_HOURS:
        violations.append(
            Violation(
                "weekly_hours",
                f"Would reach {week_hours:.1f}h this week (warning at {WEEKLY_WARN_HOURS}h)",
                ViolationSeverity.warning,
            )
        )

    # Consecutive days
    work_days: set[date] = {_local_date(shift.starts_at, loc_tz)}
    for _, s, l in existing:
        if _hours_between(s.starts_at, s.ends_at) >= 1:
            work_days.add(_local_date(s.starts_at, l.timezone))
    sorted_days = sorted(work_days)
    max_streak = 1
    streak = 1
    for i in range(1, len(sorted_days)):
        if (sorted_days[i] - sorted_days[i - 1]).days == 1:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1
    if max_streak >= 7:
        if not override_reason:
            violations.append(
                Violation(
                    "consecutive_days",
                    f"7th consecutive day worked; manager override with reason required",
                    ViolationSeverity.error,
                )
            )
    elif max_streak >= 6:
        violations.append(
            Violation(
                "consecutive_days",
                "6th consecutive day worked (warning)",
                ViolationSeverity.warning,
            )
        )

    # Cutoff for published shifts
    if shift.status == ShiftStatus.published:
        cutoff = timedelta(hours=location.schedule_cutoff_hours)
        if shift.starts_at - datetime.now(timezone.utc) < cutoff and not actor_is_admin:
            violations.append(
                Violation(
                    "cutoff",
                    f"Shift starts within {location.schedule_cutoff_hours}h; only admin can modify",
                    ViolationSeverity.error,
                )
            )

    # Pending swap limit
    pending = await db.execute(
        select(SwapRequest)
        .join(ShiftAssignment, SwapRequest.requester_assignment_id == ShiftAssignment.id)
        .where(
            ShiftAssignment.user_id == user_id,
            SwapRequest.status.in_([SwapStatus.pending_counterparty, SwapStatus.pending_manager]),
        )
    )
    if len(pending.scalars().all()) >= 3:
        violations.append(
            Violation(
                "swap_limit",
                "Staff has 3 pending swap/drop requests",
                ViolationSeverity.error,
            )
        )

    blocking = [v for v in violations if v.severity == ViolationSeverity.error]
    return ValidationResult(valid=len(blocking) == 0, violations=violations)


async def suggest_alternatives(
    db: AsyncSession,
    *,
    shift: Shift,
    location: Location,
    limit: int = 3,
) -> list[Suggestion]:
    certs = await db.execute(
        select(StaffLocationCert.user_id).where(
            StaffLocationCert.location_id == shift.location_id,
            StaffLocationCert.decertified_at.is_(None),
        )
    )
    cert_ids = {row[0] for row in certs.all()}

    skills = await db.execute(
        select(StaffSkill.user_id).where(StaffSkill.skill == shift.required_skill)
    )
    skill_ids = {row[0] for row in skills.all()}

    candidate_ids = cert_ids & skill_ids
    if not candidate_ids:
        return []

    users = await db.execute(select(User).where(User.id.in_(candidate_ids)))
    suggestions: list[Suggestion] = []
    for user in users.scalars().all():
        result = await validate_assignment(db, shift=shift, location=location, user_id=user.id)
        if result.valid:
            suggestions.append(Suggestion(user_id=user.id, name=user.name, reason="Available and qualified"))
        elif not any(v.rule == "double_booking" for v in result.blocking):
            warn = ", ".join(v.rule for v in result.violations if v.severity == ViolationSeverity.warning)
            if warn:
                suggestions.append(Suggestion(user_id=user.id, name=user.name, reason=f"Warnings only: {warn}"))

    return suggestions[:limit]

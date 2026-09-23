# Assumptions & Ambiguity Decisions

This document records how ShiftSync handles requirements that were deliberately unspecified in the Coastal Eats assessment brief.

---

## De-certification and historical data

**Decision:** Location certifications use soft-delete via `decertified_at`. When an admin updates a staff member's locations, existing cert rows are **replaced** (delete + re-insert) rather than soft-decertified individually.

**Historical assignments:** Past shift assignments are **never modified** when a staff member loses certification. They remain visible in audit history and My Schedule for past weeks. New assignments to that location are blocked by the constraint engine.

**Rationale:** Preserves audit integrity; certification is enforced at assignment time, not retroactively.

---

## Desired hours vs availability

**Decision:** These are **independent** fields.

| Field | Purpose |
| --- | --- |
| `desired_hours_per_week` | Planning target for fairness reporting and roster dashboards |
| Availability windows | Hard constraint for assignment validation |

A staff member may desire 40h but only be available Mon–Fri 9–5. Managers see both; only availability blocks assignment.

---

## Consecutive work days

**Decision:** Any calendar day with at least **one shift of 1 hour or longer** counts as a work day toward the consecutive-day streak.

**7th day:** Requires a documented `override_reason` on the assignment (manager-entered in the assign modal).

---

## Shift edited after swap approval

**Decision:** If a manager edits shift times, skill, or headcount **after** a swap is approved but **before** the shift occurs:

- The approved assignment stands (swap is not re-opened).
- Assigned staff receive a `shift_changed` notification.
- If the edit makes the assignment invalid (e.g. skill change), the manager must manually unassign and re-assign; the system does not auto-revert swaps.

---

## Location spanning a timezone boundary

**Decision:** Each location has a **single IANA timezone** (e.g. `America/Los_Angeles`). We do not model split-TZ sites near state lines.

---

## Premium / desirable shifts

**Decision:** Premium shifts are defined as **Friday or Saturday**, with a local start time of **5:00 PM or later**, evaluated in the **shift location's timezone**.

Fairness score measures how evenly premium shift assignments are distributed among staff (coefficient-of-variation based, 0–100).

---

## Overtime cost projection

**Decision:** Dashboard labor cost uses **demo rates** only ($18/h base, 1.5× for hours over 40/week). This is illustrative, not payroll-accurate.

---

## Real-time updates

**Decision:** We use **WebSocket** only for the manager/admin Live Floor page. Schedules, swaps, and notifications use **TanStack Query polling** (30–60s). This is documented as an intentional trade-off for demo scale; staff see updates within one poll interval without manual refresh.

| View | Mechanism | Interval |
| --- | --- | --- |
| Live floor | WebSocket + Redis pub/sub | Sub-second |
| Open shifts / swaps / notifications | HTTP polling | 30s |
| Weekly schedule | HTTP polling | 60s |
| Staff My Schedule (duty) | HTTP polling | 10s |

---

## Drop request expiry

**Decision:** Drop requests store `expires_at = shift_start − 24 hours`. On each list fetch (`/swap-requests`, `/open-shifts`), stale drops are marked `expired` (check-on-read). No background cron is required for the demo environment.

---

## Email delivery

**Decision:** Email is **simulated** via the `email_outbox` table. User preferences still control whether a simulated email row is written.

---

## Audit export

**Decision:** Admins may export audit logs as CSV with optional `date_from`, `date_to`, `location_id`, and `entity_type` filters. Managers may view but not export.

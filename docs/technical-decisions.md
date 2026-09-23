# Technical Decisions

This document records the major architectural and implementation choices in ShiftSync, with rationale and trade-offs. Decisions are numbered for reference but are not sequential delivery milestones.

---

## TD-01: Monorepo with separate frontend and backend

**Decision:** Keep Next.js and FastAPI as independent services in one repository, orchestrated by Docker Compose.

**Rationale:**
- Clear separation of concerns (UI vs API)
- Each stack uses its native tooling (npm, pip, Alembic)
- BFF pattern in Next.js avoids CORS complexity for authenticated requests

**Trade-off:** Two runtime processes in development; WebSocket connects directly to the backend URL (`NEXT_PUBLIC_WS_URL`), not through the BFF.

---

## TD-02: BFF with httpOnly cookie auth

**Decision:** JWT access and refresh tokens are stored in httpOnly cookies set by Next.js API routes. The browser client calls `/api/proxy/*`, which injects the Bearer token server-side.

**Rationale:**
- Prevents XSS from reading tokens in JavaScript
- Enables silent refresh on 401 without exposing refresh tokens to the client
- Matches modern SPA security best practices

**Implementation:**
- `frontend/app/api/auth/login/route.ts` — sets cookies after FastAPI login
- `frontend/app/api/proxy/[...path]/route.ts` — forwards requests with Authorization header
- `backend/app/security.py` — issues access (60 min), refresh (7 days), and WS (5 min) tokens

**Trade-off:** WebSocket cannot use cookie auth easily; managers obtain a short-lived WS token via REST first.

---

## TD-03: Role + location scoping (not multi-tenant)

**Decision:** Single organization (Coastal Eats). Authorization combines **role** (admin/manager/staff) with **location access** (manager_locations join table).

**Rationale:**
- Admin: `get_accessible_location_ids()` returns `None` (all locations)
- Manager: restricted to assigned locations
- Staff: own data + certified locations for assignment validation

**File:** `backend/app/services/access.py`

**Trade-off:** `GET /api/staff` returns all staff for managers, not filtered by location — acceptable for demo scale but would need scoping at enterprise size.

---

## TD-04: UTC storage, local display

**Decision:** Persist all shift timestamps in UTC. Accept local date/time on write; convert using the location's IANA timezone.

**Rationale:**
- Correct behavior across Pier House (Pacific) and Lighthouse Cafe (Eastern)
- Avoids daylight-saving bugs from storing naive local times

**Implementation:**
- Backend: `ZoneInfo(location.timezone)` in scheduling router
- Frontend: `formatShiftRange()`, `utcToLocalDate()` in `lib/shift-time.ts`

---

## TD-05: Centralized constraint engine

**Decision:** All assignment validation (manual assign, claim open shift, preview) flows through `services/constraints.py`.

**Rationale:**
- Single source of truth for labor rules
- Violations return structured `{ rule, message, severity }` for UI display
- Warnings (35h+, 6th day) do not block; errors do

**Key constants:**

| Constant | Value |
| --- | --- |
| `REST_GAP_HOURS` | 10 |
| `DAILY_BLOCK_HOURS` | 12 |
| `WEEKLY_WARN_HOURS` | 35 |
| Default schedule cutoff | 48 hours (`locations.schedule_cutoff_hours`) |

---

## TD-06: Hybrid concurrency control

**Decision:** Combine **optimistic locking** (shift `version` field) with **pessimistic row locks** (`SELECT … FOR UPDATE`) for high-contention operations.

| Operation | Mechanism |
| --- | --- |
| Edit shift | Optimistic — client sends `version`; 409 on mismatch |
| Assign staff | Pessimistic — lock shift row before headcount check |
| Claim open shift | Pessimistic — lock swap + shift rows |

**Rationale:**
- Shift edits are infrequent but need conflict detection across managers
- Assign/claim are race-prone when multiple staff claim the same open slot

**File:** `backend/app/services/concurrency.py`

---

## TD-07: Polling + WebSocket (not polling-only, not WS-everywhere)

**Decision:** Use TanStack Query polling for most views; WebSocket only for the manager Live Floor page.

**Rationale:**
- Open shifts, swaps, and schedules change on human time scales — 30–60s polling is sufficient
- Live floor needs sub-minute freshness for clock events across managers viewing the same site
- Staff duty UI uses 10s polling on My Schedule — simpler than WS for a single user

**Polling config:** `frontend/lib/live-query.ts`

| View | Interval |
| --- | --- |
| High-churn (open shifts, swaps, duty summary) | 30s |
| Schedules | 60s |
| Active staff shift | 10s |

---

## TD-08: Redis pub/sub for duty broadcasts

**Decision:** On any duty-affecting change, publish to Redis channel `duty:updates`. A background listener in the FastAPI lifespan rebroadcasts fresh snapshots to all WebSocket clients.

**Rationale:**
- Supports multiple uvicorn workers or future horizontal scaling
- Decouples HTTP handlers from WebSocket fan-out
- Single channel keeps the design simple

**Files:**
- `backend/app/services/redis_bus.py` — publish/subscribe
- `backend/app/services/ws_manager.py` — per-client snapshot (location-scoped)
- `backend/app/main.py` — lifespan starts/stops listener

**Trade-off:** Requires Redis in all environments; `/health` reports degraded if Redis is down.

---

## TD-09: Audit log as append-only JSONB

**Decision:** Store `before_state` and `after_state` as JSONB on `audit_logs`. No separate event-type tables.

**Rationale:**
- Flexible schema as scheduling features evolve
- Sufficient for demo and internal compliance review
- Enriched at read time with actor name, location, shift context

**Entity types:** `shift`, `assignment`, `swap_request`, `schedule_week`

**Known inconsistency:** Assignment logs use `entity_id = shift.id`, while per-shift history also queries by assignment IDs — some assignment events may not appear in shift history depending on query path.

---

## TD-10: Simulated email

**Decision:** Write to `email_outbox` table instead of sending SMTP mail.

**Rationale:**
- Assessment/demo environment should not require mail credentials
- Notification flow is still exercised end-to-end in code

---

## TD-11: Break timer as computed value

**Decision:** Break availability is calculated from `clocked_in_at + 4 hours`. No `break_started_at` column.

**Rationale:**
- Meets demo requirement for "break due" indicator without full break tracking UX
- Reduces schema and clock-state complexity

**Trade-off:** Cannot report actual break duration taken.

---

## TD-12: Dashboard charts with client-side aggregation

**Decision:** No dedicated analytics API. Dashboards aggregate data from existing schedule, staff, duty, and swap endpoints using TanStack Query. Charts use Recharts with click-to-drill panels.

**Rationale:**
- Avoids premature analytics infrastructure for demo data volumes
- Drill-down reuses shift/staff lists already available in memory

**Files:**
- `frontend/lib/dashboard-metrics.ts` — chart data transforms
- `frontend/lib/chart-drill.ts` — drill filter helpers
- `frontend/components/charts/` — Recharts wrappers

---

## TD-13: Next.js App Router with client components for interactivity

**Decision:** Pages are thin server wrappers; feature views are `"use client"` components with React Query for data fetching.

**Rationale:**
- Scheduling UI requires rich client interactivity (drawers, modals, drag-free grid)
- React Query handles caching, polling, and invalidation consistently

**Global providers:** `AuthProvider`, `QueryProvider` in `app/providers.tsx`

---

## TD-14: Alembic for schema migrations

**Decision:** All schema changes go through Alembic revision files. Docker startup runs `alembic upgrade head` automatically.

**Rationale:**
- Reproducible schema across developer machines and CI
- Versioned history of enum and table changes

**Migrations:**
- `001_initial.py` — core schema
- `002_swap_shift_id.py` — swap ↔ shift linkage
- `003_duty_clock.py` — duty_clocks table

---

## TD-15: Seed script as demo bootstrap

**Decision:** `backend/scripts/seed.py` with subcommands (`scheduling`, `swaps`, `duty`) populates realistic demo data idempotently.

**Rationale:**
- Fresh `docker compose up` yields a usable demo without manual setup
- `seed duty` creates shifts spanning **now** so Live Floor always has active data

---

## Decision summary matrix

| Area | Choice | Alternative considered |
| --- | --- | --- |
| Auth | httpOnly JWT + BFF | localStorage tokens |
| Real-time | Polling + selective WS | WebSocket everywhere |
| Broadcast | Redis pub/sub | In-process only |
| Concurrency | Optimistic + row locks | Last-write-wins |
| Time | UTC + location TZ | Store local times |
| Email | Simulated outbox | SendGrid/SMTP |
| Analytics | Client-side charts | Dedicated BI API |
| Breaks | Computed timer | Persisted break records |

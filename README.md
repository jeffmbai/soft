# ShiftSync — Coastal Eats Staff Scheduling

Multi-location shift scheduling platform for the Priority Soft assessment.

**Current phase:** Phase 2 complete (scheduling core). Phase 3 (swaps, notifications) is next.

## Stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, TanStack Query, Zustand
- **Backend:** FastAPI, SQLAlchemy 2.0 (async), Alembic, JWT auth (httpOnly cookies via BFF)
- **Database:** PostgreSQL 16

## Quick Start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

On first startup, migrations run automatically and seed data is loaded (including demo shifts).

## Demo Credentials

All accounts use password: **`password123`**

| Role | Email | Notes |
| --- | --- | --- |
| Admin | admin@coastaleats.com | All locations, staff roster, manager assignment |
| Manager (Pacific) | manager.west@coastaleats.com | Pier House + Harbor Grill |
| Manager (Eastern) | manager.east@coastaleats.com | Boardwalk Bistro + Lighthouse Cafe |
| Staff | sam@coastaleats.com | Example staff account |

## Phase 2 Features

| Area | Route | Who |
| --- | --- | --- |
| Operations dashboard | `/dashboard` | Admin, Manager |
| Weekly schedule | `/schedule` | Admin, Manager |
| Staff roster | `/users` | Admin |
| Locations + managers | `/locations` | Admin |
| My schedule | `/my-schedule` | Staff |
| Availability | `/availability` | Staff |

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql+asyncpg://shiftsync:shiftsync@localhost:5432/shiftsync
alembic upgrade head
python -m scripts.seed
python -m scripts.seed scheduling
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
soft/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routers/       # auth, locations, staff, scheduling, availability
│   │   ├── services/      # constraints, access, audit
│   │   └── schemas/
│   ├── alembic/
│   └── scripts/seed.py
├── frontend/
│   ├── app/               # Next.js routes
│   ├── components/pages/  # ScheduleView, DashboardView, UsersView, …
│   ├── stores/            # Zustand (scheduleUiStore)
│   └── lib/api.ts
├── docs/
│   ├── phase-1-decisions.md
│   ├── phase-2-decisions.md
│   └── role-permissions.md
└── docker-compose.yml
```

## Documentation

- [Phase 1 decisions](docs/phase-1-decisions.md)
- [Phase 2 decisions](docs/phase-2-decisions.md)
- [Role permissions](docs/role-permissions.md)

## Known Limitations

- Email is simulated (not real SMTP)
- Swaps/notifications not yet implemented (Phase 3)
- No WebSocket live updates yet (Phase 4)
- Clock-in / on-duty uses shift time windows only

# ShiftSync — Coastal Eats Staff Scheduling

Multi-location shift scheduling platform for the Priority Soft assessment.

## Stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, TanStack Query, Recharts, Zustand
- **Backend:** FastAPI, SQLAlchemy 2.0 (async), Alembic, JWT auth (httpOnly cookies via BFF)
- **Database:** PostgreSQL 16
- **Cache / pub-sub:** Redis 7 (live floor WebSocket broadcasts)

## Quick Start (Docker)

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

On first startup, migrations run automatically and seed data is loaded (users, shifts, swaps, live floor duty demo).

## Demo Credentials

All accounts use password: **`password123`**

| Role | Email | Notes |
| --- | --- | --- |
| Admin | admin@coastaleats.com | All locations, staff roster, manager assignment |
| Manager (Pacific) | manager.west@coastaleats.com | Pier House + Harbor Grill |
| Manager (Eastern) | manager.east@coastaleats.com | Boardwalk Bistro + Lighthouse Cafe |
| Staff | sam@coastaleats.com | Clock in from My Schedule; live floor demo has Sam on duty |
| Staff | riley@coastaleats.com | Tardy on live floor demo shift |

### Try it

1. Log in as **manager.west@coastaleats.com** → **Live Floor & Duty** — clocked-in staff, tardy, and gaps (live WebSocket).
2. Log in as **sam@coastaleats.com** → **My Schedule** — clock in/out with shift and break timers.
3. Log in as **admin@coastaleats.com** → **Dashboard** — click chart segments to drill down.

## Features

| Area | Route | Who |
| --- | --- | --- |
| Dashboard (charts + drill-down) | `/dashboard` | Admin, Manager, Staff |
| Live floor & duty | `/on-duty` | Admin, Manager |
| Weekly schedule | `/schedule` | Admin, Manager |
| Open shifts / swaps | `/open-shifts` | Admin, Manager, Staff |
| Audit log | `/audit` | Admin, Manager |
| Staff roster | `/users` | Admin |
| Locations + managers | `/locations` | Admin |
| My schedule | `/my-schedule` | Staff |
| Availability | `/availability` | Staff |
| Settings (notifications) | `/settings` | All |

## Documentation

Full project documentation is in [`docs/`](docs/README.md):

| Document | Contents |
| --- | --- |
| [Project Specification](docs/specification.md) | Domain model, requirements, non-goals |
| [Architecture](docs/architecture.md) | System topology, layers, deployment diagrams |
| [Technical Decisions](docs/technical-decisions.md) | Auth, concurrency, live updates, and other ADRs |
| [Workflows](docs/workflows.md) | Flowcharts for scheduling, swaps, duty, audit |
| [Role Permissions](docs/role-permissions.md) | Route and API access matrix |
| [API Reference](docs/api-reference.md) | Endpoint summary |
| [Development Guide](docs/development.md) | Local setup, migrations, seed data |
| [Contabo Deployment](docs/deployment-contabo.md) | Shared VPS production deploy and CI/CD |

## Local Development (without Docker)

See [Development Guide](docs/development.md) for full instructions.

```bash
# Backend
cd backend && pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://shiftsync:shiftsync@localhost:5432/shiftsync
export REDIS_URL=redis://localhost:6379/0
alembic upgrade head && python -m scripts.seed && python -m scripts.seed scheduling && python -m scripts.seed swaps && python -m scripts.seed duty
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install
export NEXT_PUBLIC_WS_URL=ws://localhost:8000
npm run dev
```

## Project Structure

```
soft/
├── backend/
│   ├── app/
│   │   ├── models/        # shift, duty, swap, audit, …
│   │   ├── routers/       # auth, scheduling, duty, ws, swaps, audit, …
│   │   ├── services/      # duty, redis_bus, swaps, concurrency, …
│   │   └── schemas/
│   ├── alembic/
│   └── scripts/seed.py
├── frontend/
│   ├── app/
│   ├── components/pages/  # OnDutyView, DashboardView, ScheduleView, AuditLogView, …
│   ├── components/charts/
│   ├── hooks/             # useDutyFloor, useDutySummary
│   └── lib/               # api.ts, ws.ts, live-query.ts, chart-drill.ts
├── docs/                  # Full documentation
└── docker-compose.yml
```

## Known Limitations

- Email is simulated (not real SMTP)
- Break timer is computed (4h rule); break start/end is not persisted
- Live floor WebSocket is admin/manager only; staff use My Schedule polling
- Swap `expired` status exists but no auto-expire job runs
- `GET /health` checks Redis only, not PostgreSQL

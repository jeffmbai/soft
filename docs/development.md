# Development Guide

## Prerequisites

| Tool | Version |
| --- | --- |
| Docker + Docker Compose | Latest |
| Node.js | 20+ (for local frontend dev) |
| Python | 3.11+ (for local backend dev) |
| PostgreSQL | 16 (if not using Docker for DB) |
| Redis | 7 (if not using Docker for Redis) |

---

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

On first startup the backend automatically:

1. Runs Alembic migrations (`alembic upgrade head`)
2. Seeds base data, scheduling, swaps, and live duty demo
3. Starts uvicorn with hot reload

### Demo logins

Password for all accounts: **`password123`**

| Email | Role |
| --- | --- |
| admin@coastaleats.com | Admin |
| manager.west@coastaleats.com | Manager (Pacific sites) |
| manager.east@coastaleats.com | Manager (Eastern sites) |
| sam@coastaleats.com | Staff |
| riley@coastaleats.com | Staff |

---

## Local development (without Docker)

### PostgreSQL and Redis

```bash
# Example with Homebrew
brew services start postgresql@16
brew services start redis

createdb shiftsync
createuser shiftsync -P   # password: shiftsync
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql+asyncpg://shiftsync:shiftsync@localhost:5432/shiftsync
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=dev-secret-key-change-in-production
export CORS_ORIGINS=http://localhost:3000

alembic upgrade head
python -m scripts.seed
python -m scripts.seed scheduling
python -m scripts.seed swaps
python -m scripts.seed duty

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

export NEXT_PUBLIC_API_URL=http://localhost:8000
export NEXT_PUBLIC_WS_URL=ws://localhost:8000
export BACKEND_URL=http://localhost:8000

npm run dev
```

---

## Environment variables

### Backend (`backend/app/config.py`)

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL async connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for duty pub/sub |
| `SECRET_KEY` | — | JWT signing key |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 60 | Access JWT TTL |

### Frontend

| Variable | Default | Description |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:8000` | Server-side proxy target (Docker: `http://backend:8000`) |
| `NEXT_PUBLIC_API_URL` | — | Public API URL (fallback) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` | WebSocket base URL for browser |

---

## Database migrations

Create a new migration after model changes:

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

Existing migrations:

| File | Contents |
| --- | --- |
| `001_initial.py` | Users, locations, shifts, assignments, swaps, audit, notifications |
| `002_swap_shift_id.py` | `swap_requests.shift_id`, nullable requester assignment |
| `003_duty_clock.py` | `duty_clocks` table |

---

## Seed data

Script: `backend/scripts/seed.py`

```bash
python -m scripts.seed              # Users, locations, staff profiles
python -m scripts.seed scheduling     # Draft/published shifts + assignments
python -m scripts.seed swaps          # Pending swap, approved drop, notifications
python -m scripts.seed duty           # Active shifts spanning NOW + clock states
```

All subcommands are **idempotent** — safe to re-run.

### Locations seeded

| Name | Timezone |
| --- | --- |
| Pier House | America/Los_Angeles |
| Harbor Grill | America/Los_Angeles |
| Boardwalk Bistro | America/New_York |
| Lighthouse Cafe | America/New_York |

### Live duty demo (`seed duty`)

Creates published shifts that span the current time:

- Pier House server: Sam clocked in, Riley tardy
- Pier House bartender: Maria clocked in
- Harbor Grill line cook: Casey tardy, 1 roster gap

Re-run if Live Floor appears empty after a long idle period:

```bash
docker compose exec backend python -m scripts.seed duty
```

---

## Project scripts

### Frontend

```bash
npm run dev      # Development server :3000
npm run build    # Production build
npm run lint     # ESLint
```

### Backend

```bash
uvicorn app.main:app --reload   # Dev server :8000
alembic upgrade head            # Apply migrations
python -m scripts.seed duty     # Refresh live floor demo
```

---

## Testing the main flows

### Live floor (manager)

- [ ] Login: `manager.west@coastaleats.com`
- [ ] Open Live Floor and Duty — verify WebSocket connection (staff cards, activity feed)
- [ ] Clock a tardy staff member in from the floor view

### Staff clock-in

- [ ] Login: `sam@coastaleats.com`
- [ ] Open My Schedule — active shift panel with timers
- [ ] Clock out when done

### Scheduling

- [ ] Login as manager
- [ ] Weekly Matrix — click a shift to edit or assign
- [ ] Audit history tab in the edit drawer

### Open shifts

- [ ] Login as staff with matching skill/cert
- [ ] Open Shifts Pool — claim an approved drop
- [ ] Login as manager — approve a pending drop in the activity tab

### Dashboard drill-down

- [ ] Login as admin or manager
- [ ] Dashboard — click any chart bar or donut segment
- [ ] Verify drill panel lists matching records

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Port 3000 in use | Stop other Next.js processes or change port |
| Live Floor empty | Run `python -m scripts.seed duty` |
| `/health` shows degraded | Ensure Redis is running |
| WebSocket fails | Check `NEXT_PUBLIC_WS_URL` points to backend host |
| 401 on API calls | Clear cookies, re-login; check `SECRET_KEY` matches |
| Migration errors | `alembic upgrade head` on fresh DB or reset volume |

### Reset database (Docker)

```bash
docker compose down -v
docker compose up --build
```

This removes the `postgres_data` volume and re-seeds from scratch.

---

## Code conventions

| Area | Convention |
| --- | --- |
| Backend models | SQLAlchemy 2.0 async, `Mapped[]` annotations |
| API schemas | Pydantic v2 in `app/schemas/` |
| Frontend data | TanStack Query + `lib/api.ts` client |
| Styling | Tailwind CSS v4, design tokens in `globals.css` |
| Auth | Never import tokens in client JS; use BFF proxy |
| Live data | `liveQueryOptions()` from `lib/live-query.ts` |

---

## Documentation diagrams

Architecture and workflow diagrams are stored as PNG files under `docs/images/`. Each image is generated from a Mermaid source file in `docs/sources/`.

To rebuild all diagrams after editing a `.mmd` file:

```bash
cd docs
npm install          # first time only
npm run build:diagrams
```

The build script (`docs/scripts/build-diagrams.mjs`) runs `@mermaid-js/mermaid-cli` for every file in `sources/` and writes matching PNGs to `images/`.

---

## Further reading

- [Project Specification](specification.md)
- [Architecture](architecture.md)
- [Technical Decisions](technical-decisions.md)
- [Workflows](workflows.md)
- [Role Permissions](role-permissions.md)
- [Contabo Deployment](deployment-contabo.md)

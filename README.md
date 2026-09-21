# ShiftSync — Coastal Eats Staff Scheduling

Multi-location shift scheduling platform for the Priority Soft assessment.

## Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, TanStack Query
- **Backend:** FastAPI, SQLAlchemy 2.0 (async), Alembic, JWT auth
- **Database:** PostgreSQL 16

## Quick Start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

On first startup, migrations run automatically and seed data is loaded.

## Demo Credentials

All accounts use password: **`password123`**

| Role | Email |
| --- | --- |
| Admin | admin@coastaleats.com |
| Manager (Pacific) | manager.west@coastaleats.com |
| Manager (Eastern) | manager.east@coastaleats.com |
| Staff | sam@coastaleats.com |

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start Postgres locally, then:
export DATABASE_URL=postgresql+asyncpg://shiftsync:shiftsync@localhost:5432/shiftsync
alembic upgrade head
python -m scripts.seed
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
│   │   ├── models/      # SQLAlchemy models
│   │   ├── routers/     # API routes
│   │   ├── schemas/     # Pydantic schemas
│   │   └── security.py  # JWT + bcrypt
│   ├── alembic/         # DB migrations
│   └── scripts/seed.py  # Demo data
├── frontend/
│   └── src/
│       ├── app/           # App Router pages
│       ├── providers/     # Auth + Query providers
│       └── lib/api.ts     # API client
└── docker-compose.yml
```

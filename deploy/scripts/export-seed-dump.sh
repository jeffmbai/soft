#!/usr/bin/env bash
# Export current local demo data from the running ShiftSync Postgres container.
set -euo pipefail

CONTAINER="${SEED_DUMP_CONTAINER:-soft-db-1}"
DB_USER="${POSTGRES_USER:-shiftsync}"
DB_NAME="${POSTGRES_DB:-shiftsync}"
OUTPUT="${1:-deploy/sql/001_seed_demo_data.sql}"
TMP="$(mktemp /tmp/soft-seed-dump.XXXXXX.sql)"

if ! docker inspect "${CONTAINER}" >/dev/null 2>&1; then
  echo "ERROR: container not found: ${CONTAINER}" >&2
  echo "Start local stack first: docker compose up -d db" >&2
  exit 1
fi

counts="$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "
SELECT json_build_object(
  'users', (SELECT count(*) FROM users),
  'locations', (SELECT count(*) FROM locations),
  'shifts', (SELECT count(*) FROM shifts),
  'shift_assignments', (SELECT count(*) FROM shift_assignments),
  'swap_requests', (SELECT count(*) FROM swap_requests),
  'duty_clocks', (SELECT count(*) FROM duty_clocks),
  'notifications', (SELECT count(*) FROM notifications),
  'audit_logs', (SELECT count(*) FROM audit_logs),
  'schedule_weeks', (SELECT count(*) FROM schedule_weeks)
);")"

docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  --exclude-table=alembic_version \
  --exclude-table=email_outbox \
  > "${TMP}"

{
  cat <<EOF
-- ShiftSync demo seed data (generated from local database)
-- Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
-- Source container: ${CONTAINER}
-- Source database: ${DB_NAME}
-- Row counts: ${counts}
--
-- Regenerate:
--   bash deploy/scripts/export-seed-dump.sh
--
-- Demo password for seeded users: password123
-- Includes local changes (extra shifts, audit logs, Jeff Mbai staff user, etc.)

BEGIN;
SET session_replication_role = replica;

EOF
  rg -v '^(\\restrict|\\unrestrict|-- PostgreSQL database dump|^--$|^-- Dumped |^SET |^SELECT pg_catalog|^SET check_function|^SET xmloption|^SET client_min|^SET row_security|^-- PostgreSQL database dump complete)' "${TMP}" || true
  cat <<'EOF'

SET session_replication_role = DEFAULT;
COMMIT;
EOF
} > "${OUTPUT}"

rm -f "${TMP}"
echo "Wrote ${OUTPUT} ($(wc -l < "${OUTPUT}") lines)"

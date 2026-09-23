#!/usr/bin/env bash
# Deploy ShiftSync on shared Contabo VPS (serverops-gateway for public TLS/routing).
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE=(docker compose -f "${COMPOSE_FILE}")
GATEWAY_ENABLED="${GATEWAY_ENABLED:-true}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=docker-env.sh
. "${SCRIPT_DIR}/docker-env.sh"
# shellcheck source=certbot-project.sh
. "${SCRIPT_DIR}/certbot-project.sh"

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: ${name} must be set." >&2
    exit 1
  fi
}

require_var DOMAIN
require_var API_DOMAIN
require_var POSTGRES_USER
require_var POSTGRES_PASSWORD
require_var POSTGRES_DB
require_var SECRET_KEY
require_var CORS_ORIGINS
require_var NEXT_PUBLIC_WS_URL
require_var IMAGE_TAG

BACKEND_URL="${BACKEND_URL:-http://soft-backend:8000}"
GHCR_IMAGE_OWNER="${GHCR_IMAGE_OWNER:-jeffmbai}"
GATEWAY_SITE_NAME="${GATEWAY_SITE_NAME:-soft}"
SHARED_PROXY_NETWORK_NAME="${SHARED_PROXY_NETWORK_NAME:-serverops_proxy}"
SSL_CERT_DOMAINS="${SSL_CERT_DOMAINS:-${DOMAIN},${API_DOMAIN}}"
CERT_DOMAIN="${CERT_DOMAIN:-${DOMAIN}}"

{
  echo "IMAGE_TAG=${IMAGE_TAG}"
  echo "GHCR_IMAGE_OWNER=${GHCR_IMAGE_OWNER}"
  echo "DOMAIN=${DOMAIN}"
  echo "API_DOMAIN=${API_DOMAIN}"
  echo "SSL_CERT_DOMAINS=${SSL_CERT_DOMAINS}"
  echo "CERT_DOMAIN=${CERT_DOMAIN}"
  echo "POSTGRES_USER=${POSTGRES_USER}"
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  echo "POSTGRES_DB=${POSTGRES_DB}"
  echo "NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}"
  echo "BACKEND_URL=${BACKEND_URL}"
  echo "GATEWAY_SITE_NAME=${GATEWAY_SITE_NAME}"
  echo "SHARED_PROXY_NETWORK_NAME=${SHARED_PROXY_NETWORK_NAME}"
  echo "CERTBOT_EMAIL=${CERTBOT_EMAIL:-}"
} > .env

{
  echo "DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
  echo "REDIS_URL=redis://redis:6379/0"
  echo "SECRET_KEY=${SECRET_KEY}"
  echo "CORS_ORIGINS=${CORS_ORIGINS}"
} > backend/.env.prod

if [ -z "${GHCR_USERNAME:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
  echo "ERROR: GHCR_USERNAME and GHCR_TOKEN must be set."
  exit 1
fi

echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
"${COMPOSE[@]}" pull backend frontend

ensure_shared_proxy_network() {
  local network_name="${SHARED_PROXY_NETWORK_NAME}"
  if ! docker network inspect "${network_name}" >/dev/null 2>&1; then
    echo "Creating shared Docker proxy network: ${network_name}"
    docker network create "${network_name}" >/dev/null
  fi
}

render_gateway_config() {
  local target_file="$1"
  local frontend_upstream="${FRONTEND_UPSTREAM:-soft-frontend:3000}"
  local backend_upstream="${BACKEND_UPSTREAM:-soft-backend:8000}"

  sed \
    -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__API_DOMAIN__|${API_DOMAIN}|g" \
    -e "s|__CERT_DOMAIN__|${CERT_DOMAIN}|g" \
    -e "s|__FRONTEND_UPSTREAM__|${frontend_upstream}|g" \
    -e "s|__BACKEND_UPSTREAM__|${backend_upstream}|g" \
    deploy/nginx/soft.conf.template > "${target_file}"
}

gateway_cert_exists() {
  local cert_domain="${1:-${CERT_DOMAIN}}"
  local gateway_root="${GATEWAY_ROOT:-/opt/serverops-gateway}"

  [ -d "${gateway_root}" ] || return 1

  (
    cd "${gateway_root}"
    "${DOCKER}" compose exec -T nginx test -f "/etc/letsencrypt/live/${cert_domain}/fullchain.pem"
  ) 2>/dev/null
}

reload_gateway_nginx() {
  local gateway_root="${GATEWAY_ROOT:-/opt/serverops-gateway}"

  (
    cd "${gateway_root}"
    "${DOCKER}" compose exec -T nginx nginx -s reload 2>/dev/null || "${DOCKER}" compose restart nginx
  )
}

ensure_gateway_tls() {
  if [ "${GATEWAY_ENABLED}" != "true" ]; then
    return 0
  fi

  local gateway_root="${GATEWAY_ROOT:-/opt/serverops-gateway}"

  if gateway_cert_exists "${CERT_DOMAIN}"; then
    echo "TLS certificate already present for ${CERT_DOMAIN}."
    return 0
  fi

  echo "No TLS certificate for ${CERT_DOMAIN}; bootstrapping ACME routing and issuing cert..."
  bash deploy/scripts/promote-gateway-acme.sh
  reload_gateway_nginx

  export DEPLOY_PATH="${DEPLOY_PATH:-/opt/soft}"
  if [ -z "${CERTBOT_EMAIL:-}" ]; then
    echo "ERROR: Set CERTBOT_EMAIL for first TLS issue." >&2
    return 1
  fi

  if [ ! -d "${gateway_root}" ]; then
    echo "ERROR: Gateway directory not found: ${gateway_root}" >&2
    return 1
  fi

  (
    cd "${gateway_root}"
    run_project_cert_issue "${CERT_DOMAIN}"
  )

  if ! gateway_cert_exists "${CERT_DOMAIN}"; then
    echo "ERROR: Certificate issue completed but ${CERT_DOMAIN} cert files are still missing." >&2
    return 1
  fi

  reload_gateway_nginx
  echo "TLS certificate issued for ${CERT_DOMAIN}."
}

promote_gateway_config() {
  if [ "${GATEWAY_ENABLED}" != "true" ]; then
    echo "GATEWAY_ENABLED is not true; skipping gateway config promotion."
    return 0
  fi

  local promote_script="${GATEWAY_PROMOTE_SCRIPT:-/opt/serverops-gateway/scripts/promote-site.sh}"
  local site_name="${GATEWAY_SITE_NAME}"
  local candidate_file

  if [ ! -x "${promote_script}" ]; then
    echo "ERROR: gateway promotion script is missing or not executable: ${promote_script}" >&2
    return 1
  fi

  ensure_gateway_tls

  candidate_file="$(mktemp /tmp/soft-gateway.XXXXXX.conf)"
  render_gateway_config "${candidate_file}"
  if ! "${promote_script}" "${site_name}" "${candidate_file}"; then
    rm -f "${candidate_file}"
    return 1
  fi
  rm -f "${candidate_file}"
  reload_gateway_nginx
}

wait_for_backend_health() {
  local attempts="${1:-90}"
  local sleep_seconds="${2:-2}"
  local i
  local response

  echo "Waiting for backend health via docker exec ..."
  sleep 10

  for i in $(seq 1 "${attempts}"); do
    response="$("${COMPOSE[@]}" exec -T backend python -c \
      "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read().decode())" \
      2>/dev/null || true)"
    if printf '%s' "${response}" | grep -q '"status"'; then
      echo "Backend health check passed after ${i} attempt(s)."
      return 0
    fi
    if [ -n "${response}" ]; then
      echo "Attempt ${i}/${attempts}: backend responded but is not healthy yet: ${response}"
    else
      echo "Attempt ${i}/${attempts}: backend not reachable yet."
    fi
    sleep "${sleep_seconds}"
  done
  return 1
}

export SHARED_PROXY_NETWORK_NAME
ensure_shared_proxy_network

echo "Removing stale ShiftSync containers from previous deploy attempts..."
docker rm -f soft-postgres soft-redis soft-backend soft-frontend 2>/dev/null || true

"${COMPOSE[@]}" --profile all up -d --remove-orphans postgres redis

echo "Running Alembic migrations..."
"${COMPOSE[@]}" run --rm --no-deps backend alembic upgrade head

pending_sql_file_list="/tmp/soft-pending-sql-files.txt"
: > "${pending_sql_file_list}"

if [ -d deploy/sql ]; then
  find deploy/sql -maxdepth 1 -type f -name '*.sql' | sort >> "${pending_sql_file_list}"
fi

if [ -s "${pending_sql_file_list}" ]; then
  postgres_cid="$("${COMPOSE[@]}" ps -q postgres)"
  if [ -z "${postgres_cid}" ]; then
    echo "ERROR: postgres container ID not found."
    "${COMPOSE[@]}" ps
    exit 1
  fi

  docker exec "${postgres_cid}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SET client_min_messages TO WARNING"
  docker exec "${postgres_cid}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "CREATE TABLE IF NOT EXISTS deployment_sql_runs (filename TEXT PRIMARY KEY, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"

  while IFS= read -r file; do
    [ -z "${file}" ] && continue

    base="$(basename "${file}")"
    escaped="$(printf "%s" "${base}" | sed "s/'/''/g")"

    if [ ! -f "${file}" ]; then
      echo "ERROR: SQL file not found: ${file}"
      exit 1
    fi

    already="$(docker exec "${postgres_cid}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT 1 FROM deployment_sql_runs WHERE filename='${escaped}' LIMIT 1")"
    if [ "${already}" = "1" ]; then
      echo "Skipping already applied SQL: ${base}"
      continue
    fi

    echo "Applying SQL seed: ${base}"
    docker cp "${file}" "${postgres_cid}:/tmp/${base}"
    docker exec "${postgres_cid}" psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -a -e -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "/tmp/${base}"
    docker exec "${postgres_cid}" rm -f "/tmp/${base}"
    docker exec "${postgres_cid}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "INSERT INTO deployment_sql_runs (filename) VALUES ('${escaped}')"
  done < "${pending_sql_file_list}"
elif [ "${RUN_SEED:-true}" = "true" ]; then
  echo "No deploy/sql/*.sql found; running Python seed scripts..."
  "${COMPOSE[@]}" run --rm --no-deps backend python -m scripts.seed
  "${COMPOSE[@]}" run --rm --no-deps backend python -m scripts.seed scheduling
  "${COMPOSE[@]}" run --rm --no-deps backend python -m scripts.seed swaps
  "${COMPOSE[@]}" run --rm --no-deps backend python -m scripts.seed duty
fi

echo "Starting backend and frontend..."
"${COMPOSE[@]}" --profile all up -d --force-recreate backend frontend

if ! wait_for_backend_health 90 2; then
  echo "ERROR: backend failed to become healthy."
  "${COMPOSE[@]}" ps backend frontend redis postgres || true
  "${COMPOSE[@]}" logs --tail=120 backend || true
  "${COMPOSE[@]}" logs --tail=120 frontend || true
  exit 1
fi

promote_gateway_config

"${COMPOSE[@]}" ps
docker image prune -f

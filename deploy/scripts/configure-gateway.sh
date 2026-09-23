#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/soft}"
GATEWAY_ENABLED="${GATEWAY_ENABLED:-true}"

if [ -f "${DEPLOY_PATH}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${DEPLOY_PATH}/.env"
  set +a
fi

DOMAIN="${DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"
GATEWAY_PROMOTE_SCRIPT="${GATEWAY_PROMOTE_SCRIPT:-/opt/serverops-gateway/scripts/promote-site.sh}"
GATEWAY_SITE_NAME="${GATEWAY_SITE_NAME:-soft}"

if [ "${GATEWAY_ENABLED}" != "true" ]; then
  echo "GATEWAY_ENABLED is not true; skipping gateway config promotion."
  exit 0
fi

if [ -z "${DOMAIN}" ] || [ -z "${API_DOMAIN}" ]; then
  echo "DOMAIN or API_DOMAIN is not set; skipping gateway config promotion."
  exit 0
fi

if [ ! -x "${GATEWAY_PROMOTE_SCRIPT}" ]; then
  echo "Gateway promotion script is missing or not executable: ${GATEWAY_PROMOTE_SCRIPT}" >&2
  exit 1
fi

render_gateway_config() {
  local target_file="$1"
  local cert_domain="${CERT_DOMAIN:-${DOMAIN}}"
  local frontend_upstream="${FRONTEND_UPSTREAM:-soft-frontend:3000}"
  local backend_upstream="${BACKEND_UPSTREAM:-soft-backend:8000}"

  sed \
    -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__API_DOMAIN__|${API_DOMAIN}|g" \
    -e "s|__CERT_DOMAIN__|${cert_domain}|g" \
    -e "s|__FRONTEND_UPSTREAM__|${frontend_upstream}|g" \
    -e "s|__BACKEND_UPSTREAM__|${backend_upstream}|g" \
    "${DEPLOY_PATH}/deploy/nginx/soft.conf.template" > "${target_file}"
}

candidate_file="$(mktemp /tmp/soft-gateway.XXXXXX.conf)"
render_gateway_config "${candidate_file}"
if ! "${GATEWAY_PROMOTE_SCRIPT}" "${GATEWAY_SITE_NAME}" "${candidate_file}"; then
  rm -f "${candidate_file}"
  exit 1
fi
rm -f "${candidate_file}"

echo "ShiftSync gateway config promoted as ${GATEWAY_SITE_NAME}."

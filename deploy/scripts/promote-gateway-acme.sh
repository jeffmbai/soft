#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=docker-env.sh
. "${SCRIPT_DIR}/docker-env.sh"

GATEWAY_ROOT="${GATEWAY_ROOT:-/opt/serverops-gateway}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/soft}"
GATEWAY_PROMOTE_SCRIPT="${GATEWAY_PROMOTE_SCRIPT:-${GATEWAY_ROOT}/scripts/promote-site.sh}"
GATEWAY_ACME_SITE_NAME="${GATEWAY_ACME_SITE_NAME:-00-acme}"

acme_conf="${DEPLOY_PATH}/deploy/nginx/gateway-acme-catchall.conf"
if [ ! -f "${acme_conf}" ]; then
  echo "ACME catch-all config not found: ${acme_conf}" >&2
  exit 1
fi

if [ ! -x "${GATEWAY_PROMOTE_SCRIPT}" ]; then
  echo "Gateway promotion script is missing or not executable: ${GATEWAY_PROMOTE_SCRIPT}" >&2
  exit 1
fi

if ! "${GATEWAY_PROMOTE_SCRIPT}" "${GATEWAY_ACME_SITE_NAME}" "${acme_conf}"; then
  exit 1
fi

echo "Promoted gateway ACME catch-all as site ${GATEWAY_ACME_SITE_NAME}."

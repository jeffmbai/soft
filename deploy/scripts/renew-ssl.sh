#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=docker-env.sh
. "${SCRIPT_DIR}/docker-env.sh"
# shellcheck source=certbot-project.sh
. "${SCRIPT_DIR}/certbot-project.sh"

GATEWAY_ROOT="${GATEWAY_ROOT:-/opt/serverops-gateway}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/soft}"
CERT_NAME="${CERT_DOMAIN:-${DOMAIN:-}}"
RENEW_ALL="${RENEW_ALL_CERTS:-false}"

if [ ! -d "${GATEWAY_ROOT}" ]; then
  echo "Gateway directory not found: ${GATEWAY_ROOT}" >&2
  exit 1
fi

cd "${GATEWAY_ROOT}"

echo "Ensuring gateway ACME HTTP routing..."
"${DEPLOY_PATH}/deploy/scripts/promote-gateway-acme.sh"

echo "Refreshing ShiftSync gateway config before renewal..."
"${DEPLOY_PATH}/deploy/scripts/configure-gateway.sh"

"${DOCKER}" compose exec -T nginx nginx -s reload || "${DOCKER}" compose restart nginx

echo "Renewing TLS certificates via gateway certbot..."
if [ "${RENEW_ALL}" = "true" ] || [ -z "${CERT_NAME}" ]; then
  "${DOCKER}" compose run --rm certbot renew --webroot -w /var/www/certbot --no-random-sleep-on-renew
else
  run_project_certonly "${CERT_NAME}"
fi

"${DOCKER}" compose exec -T nginx nginx -s reload || "${DOCKER}" compose restart nginx

echo "Re-promoting ShiftSync gateway config after renewal..."
"${DEPLOY_PATH}/deploy/scripts/configure-gateway.sh"

echo "ShiftSync SSL renewal completed."

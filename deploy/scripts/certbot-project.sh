#!/usr/bin/env sh
# Shared certbot invocation for project-scoped SSL.

load_certbot_email() {
  if [ -n "${CERTBOT_EMAIL:-}" ]; then
    return 0
  fi
  if [ -f "${DEPLOY_PATH}/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "${DEPLOY_PATH}/.env"
    set +a
  fi
}

run_project_certonly() {
  cert_name="$1"
  load_certbot_email
  if [ -z "${CERTBOT_EMAIL:-}" ]; then
    echo "CERTBOT_EMAIL is required for certificate renewal." >&2
    exit 1
  fi

  set -- certonly --webroot -w /var/www/certbot --cert-name "${cert_name}" \
    --force-renewal --non-interactive --agree-tos --no-eff-email \
    -m "${CERTBOT_EMAIL}"

  if [ -n "${SSL_CERT_DOMAINS:-}" ]; then
    OLDIFS=${IFS:-}
    IFS=,
    for host in ${SSL_CERT_DOMAINS}; do
      host=$(echo "${host}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      [ -z "${host}" ] && continue
      set -- "$@" -d "${host}"
    done
    IFS=${OLDIFS}
  else
    [ -n "${DOMAIN:-}" ] && set -- "$@" -d "${DOMAIN}"
    [ -n "${API_DOMAIN:-}" ] && set -- "$@" -d "${API_DOMAIN}"
  fi

  domain_count=0
  for arg in "$@"; do
    if [ "${arg}" = "-d" ]; then
      domain_count=$((domain_count + 1))
    fi
  done
  if [ "${domain_count}" -eq 0 ]; then
    echo "No domains configured for certificate renewal." >&2
    exit 1
  fi

  echo "Reissuing certificate ${cert_name} for ${domain_count} domain(s)."
  "${DOCKER}" compose run --rm certbot "$@"
}

run_project_cert_issue() {
  cert_name="$1"
  load_certbot_email
  if [ -z "${CERTBOT_EMAIL:-}" ]; then
    echo "CERTBOT_EMAIL is required to issue a new certificate." >&2
    exit 1
  fi

  set -- certonly --webroot -w /var/www/certbot --cert-name "${cert_name}" \
    --non-interactive --agree-tos --no-eff-email \
    -m "${CERTBOT_EMAIL}"

  if [ -n "${SSL_CERT_DOMAINS:-}" ]; then
    OLDIFS=${IFS:-}
    IFS=,
    for host in ${SSL_CERT_DOMAINS}; do
      host=$(echo "${host}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      [ -z "${host}" ] && continue
      set -- "$@" -d "${host}"
    done
    IFS=${OLDIFS}
  else
    [ -n "${DOMAIN:-}" ] && set -- "$@" -d "${DOMAIN}"
    [ -n "${API_DOMAIN:-}" ] && set -- "$@" -d "${API_DOMAIN}"
  fi

  domain_count=0
  for arg in "$@"; do
    if [ "${arg}" = "-d" ]; then
      domain_count=$((domain_count + 1))
    fi
  done
  if [ "${domain_count}" -eq 0 ]; then
    echo "No domains configured for certificate issue." >&2
    exit 1
  fi

  echo "Issuing certificate ${cert_name} for ${domain_count} domain(s)."
  "${DOCKER}" compose run --rm certbot "$@"
}

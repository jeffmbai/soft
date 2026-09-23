#!/usr/bin/env sh
# Shared Docker CLI resolution for ServerOps project operations.

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

if [ -z "${DOCKER:-}" ]; then
  if command -v docker >/dev/null 2>&1; then
    DOCKER=docker
  elif [ -x /usr/bin/docker ]; then
    DOCKER=/usr/bin/docker
  elif [ -x /usr/local/bin/docker ]; then
    DOCKER=/usr/local/bin/docker
  elif [ -x /usr/sbin/docker ]; then
    DOCKER=/usr/sbin/docker
  else
    echo "docker CLI not found. Install Docker on the host." >&2
    exit 127
  fi
fi

export DOCKER

if ! "${DOCKER}" compose version >/dev/null 2>&1; then
  echo "docker compose is not available (install the Compose v2 CLI plugin)." >&2
  exit 127
fi

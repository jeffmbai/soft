# Deploying to Shared Contabo VPS

ShiftSync production runs on a **shared Contabo VPS** alongside other projects. Public HTTPS and routing are handled by **serverops-gateway** (a shared Nginx reverse proxy with Let's Encrypt). The application stack itself is defined in `docker-compose.prod.yml`.

---

## Overview

| Layer | Component | Notes |
| --- | --- | --- |
| Public edge | serverops-gateway | TLS termination, HTTP → HTTPS, routes to containers |
| Frontend | `soft-frontend` | Next.js production image from GHCR |
| Backend | `soft-backend` | FastAPI + uvicorn from GHCR |
| Data | `soft-postgres`, `soft-redis` | Bound to loopback ports on the host |

Typical URLs (replace with your domains):

| Service | Example URL |
| --- | --- |
| Frontend | `https://soft.serverops.co.ke` |
| API + WebSocket | `https://softapi.serverops.co.ke` |
| Health check | `https://softapi.serverops.co.ke/health` |

Both frontend and backend containers join the external Docker network `serverops_proxy` so the gateway can reach them by container name (`soft-frontend:3000`, `soft-backend:8000`).

---

## Server prerequisites

On the Contabo VPS:

1. **Docker** with the Compose v2 plugin (`docker compose`)
2. **serverops-gateway** installed at `/opt/serverops-gateway` with:
   - `scripts/promote-site.sh` (executable)
   - Nginx + Certbot services running
3. External Docker network **`serverops_proxy`** (created automatically on first deploy if missing)
4. **DNS A records** pointing both `DOMAIN` and `API_DOMAIN` to the VPS public IP
5. Deploy directory (default **`/opt/soft`**) writable by the deploy user

---

## Deployment paths

### Automated (recommended)

Pushes to `main` trigger the GitHub Actions job **Deploy to production** (`.github/workflows/ci.yml`):

1. Build and push Docker images to GHCR (`soft-backend`, `soft-frontend`)
2. Rsync project files to the VPS (excluding `.git`, local env files, `node_modules`, etc.)
3. SSH into the server and run `deploy/scripts/deploy-contabo.sh`

You can also trigger a deploy manually from the Actions tab (**workflow_dispatch**).

### Manual

From your machine (with SSH access to the VPS):

```bash
# Sync source (adjust user/host/path)
rsync -az --delete \
  -e "ssh -p 22" \
  --exclude ".git/" --exclude ".env" --exclude "backend/.env.prod" \
  ./ user@your-vps:/opt/soft/

# SSH in and deploy
ssh user@your-vps
cd /opt/soft

export IMAGE_TAG=latest
export GHCR_IMAGE_OWNER=your-github-user
export GHCR_USERNAME=your-github-user
export GHCR_TOKEN=ghp_...          # PAT with read:packages, or use GITHUB_TOKEN on CI

export DOMAIN=soft.example.com
export API_DOMAIN=softapi.example.com
export SSL_CERT_DOMAINS=soft.example.com,softapi.example.com
export NEXT_PUBLIC_WS_URL=wss://softapi.example.com
export CORS_ORIGINS=https://soft.example.com
export BACKEND_URL=http://soft-backend:8000

export POSTGRES_USER=shiftsync
export POSTGRES_PASSWORD=...
export POSTGRES_DB=shiftsync
export SECRET_KEY=...              # long random string
export CERTBOT_EMAIL=admin@example.com

bash deploy/scripts/deploy-contabo.sh
```

---

## GitHub configuration

Configure the **`production`** environment in the repository.

### Secrets

| Secret | Description |
| --- | --- |
| `CONTABO_HOST` | VPS hostname or IP |
| `CONTABO_USER` | SSH user (e.g. `deploy`) |
| `CONTABO_SSH_KEY` | Private key for SSH (PEM) |
| `CONTABO_SSH_PORT` | SSH port (optional, default `22`) |
| `SECRET_KEY` | JWT signing key (production) |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `CERTBOT_EMAIL` | Email for Let's Encrypt |

### Variables

| Variable | Example | Description |
| --- | --- | --- |
| `DEPLOY_PATH` | `/opt/soft` | Remote project directory |
| `DOMAIN` | `soft.serverops.co.ke` | Frontend hostname |
| `API_DOMAIN` | `softapi.serverops.co.ke` | API / WebSocket hostname |
| `SSL_CERT_DOMAINS` | `soft.serverops.co.ke,softapi.serverops.co.ke` | SAN list for TLS cert |
| `NEXT_PUBLIC_WS_URL` | `wss://softapi.serverops.co.ke` | Browser WebSocket URL (baked into frontend image at build) |
| `CORS_ORIGINS` | `https://soft.serverops.co.ke` | Allowed CORS origin(s) |
| `BACKEND_URL` | `http://soft-backend:8000` | Internal URL for Next.js BFF |
| `POSTGRES_USER` | `shiftsync` | Database user |
| `POSTGRES_DB` | `shiftsync` | Database name |
| `POSTGRES_HOST_PORT` | `127.0.0.1:5436` | Loopback bind for Postgres |
| `REDIS_HOST_PORT` | `127.0.0.1:6383` | Loopback bind for Redis |
| `BACKEND_HOST_PORT` | `127.0.0.1:8004` | Loopback bind for backend |
| `FRONTEND_HOST_PORT` | `127.0.0.1:3005` | Loopback bind for frontend |
| `GATEWAY_SITE_NAME` | `soft` | Site name in serverops-gateway |
| `SHARED_PROXY_NETWORK_NAME` | `serverops_proxy` | External Docker network |
| `RUN_SEED` | `false` | Run Python seed scripts when no `deploy/sql/*.sql` (set `true` for first deploy) |

On CI, `IMAGE_TAG` is set to the commit SHA and `GHCR_TOKEN` uses `GITHUB_TOKEN` to pull images on the server.

---

## What `deploy-contabo.sh` does

Script: `deploy/scripts/deploy-contabo.sh`

1. Validates required environment variables
2. Writes `.env` and `backend/.env.prod` on the server
3. Logs into GHCR and pulls backend/frontend images
4. Ensures the `serverops_proxy` Docker network exists
5. Starts **postgres** and **redis**
6. Runs **Alembic migrations** (`alembic upgrade head`)
7. Seeds data:
   - If `deploy/sql/*.sql` files exist → applies each once (tracked in `deployment_sql_runs`)
   - Else if `RUN_SEED=true` → runs Python seed scripts
8. Starts **backend** and **frontend** with health checks
9. Waits for backend health on the loopback port
10. **Promotes gateway config** — renders `deploy/nginx/soft.conf.template`, issues TLS on first run if needed, registers site with serverops-gateway
11. Prunes unused Docker images

Gateway template: `deploy/nginx/soft.conf.template`  
- `DOMAIN` → proxies to `soft-frontend:3000`  
- `API_DOMAIN` → proxies to `soft-backend:8000` (includes WebSocket upgrade headers)

---

## Production compose file

`docker-compose.prod.yml` differs from local `docker-compose.yml`:

| Aspect | Local | Production |
| --- | --- | --- |
| Images | Built locally, dev target | Pre-built GHCR images |
| Hot reload | Yes | No |
| Port binding | `0.0.0.0` | Loopback (`127.0.0.1:…`) on shared VPS |
| Networks | Default only | Default + `serverops_proxy` (external) |
| Env file | `backend/.env` | `backend/.env.prod` (generated on deploy) |
| Seed on start | Always | Controlled by deploy script / SQL dumps |

Start manually on the server (after `.env` exists):

```bash
docker compose -f docker-compose.prod.yml --profile all up -d
```

---

## TLS and SSL renewal

First deploy: if no certificate exists for `CERT_DOMAIN` (defaults to `DOMAIN`), the script:

1. Promotes the ACME catch-all config (`deploy/nginx/gateway-acme-catchall.conf`)
2. Issues a certificate via the gateway's Certbot container
3. Promotes the full ShiftSync site config

Renewal script: `deploy/scripts/renew-ssl.sh`  
Registered with serverops via compose labels (`serverops.commands.ssl`).

Run manually on the server:

```bash
cd /opt/soft
bash deploy/scripts/renew-ssl.sh
```

Or re-promote gateway config only:

```bash
bash deploy/scripts/configure-gateway.sh
```

---

## Database seeding in production

**Option A — SQL dump (preferred for reproducible prod data)**

```bash
# On a machine with a seeded database
bash deploy/scripts/export-seed-dump.sh deploy/sql/001_seed_demo_data.sql
```

Commit the SQL file. On deploy, each file in `deploy/sql/` runs once.

**Option B — Python seed scripts**

Set GitHub variable `RUN_SEED=true` for the first deploy, then set back to `false`. Scripts are idempotent but slower than a SQL dump.

---

## Shared VPS port allocation

On a shared host, services bind to **loopback** ports to avoid collisions. Defaults in `deploy-contabo.sh`:

| Service | Default bind |
| --- | --- |
| PostgreSQL | `127.0.0.1:5436` |
| Redis | `127.0.0.1:6383` |
| Backend | `127.0.0.1:8004` |
| Frontend | `127.0.0.1:3005` |

Only the gateway exposes ports 80/443 publicly. Adjust via environment variables if another project uses the same loopback ports.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Deploy fails at GHCR pull | Missing or expired token | Ensure `GHCR_USERNAME` / `GHCR_TOKEN` on manual deploy; CI uses `GITHUB_TOKEN` |
| Backend health timeout | DB migration error or bad env | `docker compose -f docker-compose.prod.yml logs backend` |
| 502 from gateway | Containers not on `serverops_proxy` | `docker network inspect serverops_proxy`; redeploy |
| WebSocket fails in browser | Wrong `NEXT_PUBLIC_WS_URL` | Must be `wss://API_DOMAIN`; rebuild frontend image after change |
| CORS errors | `CORS_ORIGINS` mismatch | Set to exact frontend origin (`https://DOMAIN`) |
| TLS issue on first deploy | DNS not propagated | Verify A records; ensure `CERTBOT_EMAIL` is set |
| Certificate renewal fails | ACME path blocked | Run `renew-ssl.sh`; check gateway nginx logs |
| Live Floor empty | Demo duty data expired | Re-run duty seed or refresh SQL dump |

Useful commands on the server:

```bash
cd /opt/soft

# Service status
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f backend frontend

# Health (loopback)
curl -s http://127.0.0.1:8004/health

# Re-run gateway config only
GATEWAY_ENABLED=true bash deploy/scripts/configure-gateway.sh
```

---

## File reference

| Path | Purpose |
| --- | --- |
| `docker-compose.prod.yml` | Production stack definition |
| `deploy/scripts/deploy-contabo.sh` | Main deploy orchestration |
| `deploy/scripts/configure-gateway.sh` | Re-render and promote Nginx site config |
| `deploy/scripts/renew-ssl.sh` | TLS renewal via gateway Certbot |
| `deploy/scripts/promote-gateway-acme.sh` | ACME HTTP-01 catch-all for cert issuance |
| `deploy/scripts/export-seed-dump.sh` | Export DB to `deploy/sql/` |
| `deploy/nginx/soft.conf.template` | Gateway vhost template |
| `deploy/sql/` | One-time SQL seed files |
| `.github/workflows/ci.yml` | CI, image publish, Contabo deploy job |
| `.env.example` | Example variable names and defaults |

---

## Related documentation

- [Architecture](architecture.md) — system topology and Docker layout
- [Development Guide](development.md) — local setup and migrations

# Cloud Deployment Plan

Deploy DerbyTimer to the public internet so the race could be run from the cloud and parents can view standings and certificates after the event — not just on the local network at the venue.

## Goal

- Share standings and certificates via a public URL (e.g., `derby.pack152.org`)
- Keep the app cheap to run (< $6/month)
- Preserve race data reliably with automated backups
- Admin actions remain protected; public gets read-only access
- Continue to allow the local-first race-day workflow (deploy is a post-event concern)

## Status: Not Started

## Platform Decision: Fly.io

After evaluating Fly.io, Render, Turso, and managed Postgres:

| Option | Monthly Cost | SQLite Compatible | Persistent Storage | Verdict |
|--------|-------------|-------------------|-------------------|---------|
| **Fly.io + Volume** | **~$0.50–2.50** | Yes (bun:sqlite) | Volume mount | **Winner** |
| Render Starter + Disk | ~$7.25 | Yes | Persistent disk | Too expensive |
| Render Free | $0 | No | Data lost on deploy | Not viable |
| Turso (libSQL) | $0 free tier | Requires migration | Managed | Overkill |
| Fly.io + Postgres | ~$4+ | Requires migration | Managed | Overkill |

**Why Fly.io wins:**
- Volume-backed SQLite works with zero code changes (`bun:sqlite` stays as-is)
- Auto-stop machines mean you only pay when parents are actually viewing results
- Litestream backup to Tigris (Fly's S3) is free and automatic
- Bun is natively supported via Docker

**Why not Render:** Free tier loses data on every deploy (no persistent disk). Minimum viable plan is $7.25/month.

**Why not Turso/Postgres:** Both require migrating from `bun:sqlite`'s synchronous API to async clients — touching every DB call in every model file. Not worth it for a low-traffic results viewer.

## Architecture

```
┌───────────────────────────────────────────┐
│            Fly.io Machine                  │
│  ┌─────────────────────────────────────┐  │
│  │          Bun Server                  │  │
│  │   API + React SPA + WebSocket        │  │
│  │   (same process, same as local)      │  │
│  └────────────┬────────────────────────┘  │
│               │                            │
│        ┌──────┴──────┐                     │
│        │   /data/    │  ← Fly Volume       │
│        │  derby.db   │                     │
│        └──────┬──────┘                     │
│               │                            │
│        ┌──────┴──────┐                     │
│        │ Litestream  │  → Tigris (S3)      │
│        │  (backup)   │    continuous WAL    │
│        └─────────────┘    replication       │
└───────────────────────────────────────────┘
```

## Fly.io Configuration

### fly.toml

```toml
app = "derby-timer"
primary_region = "ewr"  # US East — adjust to your area

[build]

[env]
  DERBY_DB_PATH = "/data/derby.db"
  NODE_ENV = "production"
  # DERBY_ADMIN_KEY set via `fly secrets set`

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "derby_data"
  destination = "/data"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

### Dockerfile

```dockerfile
ARG BUN_VERSION=1.2
FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build frontend
FROM base AS build
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production image
FROM base AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./

RUN mkdir -p /data && chown app:app /data

ENV NODE_ENV=production
ENV DERBY_DB_PATH=/data/derby.db

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/events || exit 1

CMD ["bun", "run", "src/index.ts"]
```

### .dockerignore

```
node_modules
.git
screenshots
e2e
tests
*.md
.env*
derby.db*
test-*.db
screenshot.db
```

## SQLite Production Hardening

The current `src/db/connection.ts` only sets `PRAGMA foreign_keys = ON`. For production, add WAL mode and concurrency settings:

```typescript
export function getDb(): Database {
  if (!db) {
    db = new Database(dbPath);
    db.exec("PRAGMA journal_mode = WAL");      // concurrent readers + writer
    db.exec("PRAGMA synchronous = NORMAL");     // safe with WAL, faster writes
    db.exec("PRAGMA busy_timeout = 5000");      // 5s wait on lock contention
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA cache_size = -20000");      // 20MB in-memory cache
  }
  return db;
}
```

**WAL mode** is the single most important change — it allows concurrent reads while writing, which matters when multiple parents are viewing standings simultaneously.

## Backup Strategy: Litestream

[Litestream](https://litestream.io/) continuously replicates SQLite WAL changes to S3-compatible storage with sub-second RPO. Fly.io offers [Tigris](https://fly.io/docs/tigris/) as free built-in S3.

### Setup

1. Create a Tigris bucket: `fly storage create`
2. Add `litestream.yml` to the project root:

```yaml
dbs:
  - path: /data/derby.db
    replicas:
      - type: s3
        bucket: derby-timer-backups
        path: litestream/derby.db
        endpoint: ${AWS_ENDPOINT_URL_S3}
        access-key-id: ${AWS_ACCESS_KEY_ID}
        secret-access-key: ${AWS_SECRET_ACCESS_KEY}
```

3. Update the Dockerfile CMD to run Litestream as the process supervisor:

```dockerfile
CMD ["litestream", "replicate", "-exec", "bun run src/index.ts"]
```

### Restore from Backup

```bash
litestream restore -o /data/derby.db \
  -config /app/litestream.yml \
  /data/derby.db
```

## Deployment Workflow

### First Deploy

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app (creates fly.toml if needed)
fly launch --name derby-timer --region ewr

# Create persistent volume (1GB is plenty)
fly volumes create derby_data --size 1 --region ewr

# Set admin key as a secret (not in fly.toml)
fly secrets set DERBY_ADMIN_KEY=your-secret-key-here

# Deploy
fly deploy

# Verify
fly status
fly logs
```

### Upload Local Database

After a race event, copy the local `derby.db` to the Fly volume:

```bash
# Option A: Use fly ssh to copy the file
fly ssh sftp shell
> put derby.db /data/derby.db

# Option B: Use the Fly proxy + scp
fly proxy 10022:22 &
scp -P 10022 derby.db root@localhost:/data/derby.db
```

### Subsequent Deploys

```bash
fly deploy  # Volume data persists across deploys
```

## Cost Estimate

| Resource | Cost/Month |
|----------|-----------|
| shared-cpu-1x, 256MB (auto-stop) | ~$0.50–2.00 |
| 1GB Volume | $0.15 |
| Tigris backup storage | Free (included) |
| Outbound bandwidth | ~$0.02/GB |
| **Total** | **~$0.65–2.15** |

With auto-stop, the machine hibernates when no one is viewing and wakes on the next HTTP request (~2–5 second cold start). For post-event certificate viewing, this is fine.

## Auth on Fly.io

See [Auth Plan](./auth.md) for the full authentication design. Key deployment-specific notes:

- Set `DERBY_ADMIN_KEY` via `fly secrets set` (not in fly.toml or Dockerfile)
- Optionally set `DERBY_VIEWER_KEY` to require a password for all viewers (privacy mode for families who don't want public access)
- The `auto` admin key mode writes to `/data/.derby_admin_key` on the volume — it persists across deploys
- Force HTTPS is enabled in fly.toml; cookies should set `Secure` flag in production
- Rate limiting on `/admin/login` and `/viewer/login` is important when publicly accessible

## Custom Domain

```bash
fly certs add derby.pack152.org
# Then add a CNAME record: derby.pack152.org → derby-timer.fly.dev
```

Fly.io provides free TLS certificates via Let's Encrypt.

## Pre-Deployment Checklist

1. [ ] Add WAL mode and production PRAGMAs to `connection.ts`
2. [ ] Implement auth (see [Auth Plan](./auth.md)) — at minimum, protect mutation routes
3. [ ] Create `Dockerfile` and `.dockerignore`
4. [ ] Create `fly.toml`
5. [ ] Add a `build` script to `package.json` (frontend bundle)
6. [ ] `fly launch` + `fly volumes create`
7. [ ] `fly secrets set DERBY_ADMIN_KEY=...` (and optionally `DERBY_VIEWER_KEY=...`)
8. [ ] `fly deploy` and verify
9. [ ] (Optional) Set up Litestream for backup
10. [ ] (Optional) Add custom domain

## Future: Race-Day Deploy to Fly.io

Today, race day runs locally (laptop on venue WiFi). In the future, the same Fly.io deployment could serve as the race-day server — volunteers connect to the public URL instead of a local IP. This requires:

- Reliable internet at the venue (not guaranteed)
- Lower latency tolerance for race control operations
- Fallback to local mode if internet drops

This is a stretch goal — local-first remains the priority for race day.

## Related Plans

- [Auth Plan](./auth.md) — admin key, cookie sessions, route protection
- [Remote Access Plan](./remote-access.md) — tunneling local server to the internet (alternative to full deploy)
- [Hosted Service Plan](./hosted-service.md) — fully managed cloud for non-technical packs
- [Pi Deployment Plan](./pi-deployment.md) — dedicated hardware for local race-day use

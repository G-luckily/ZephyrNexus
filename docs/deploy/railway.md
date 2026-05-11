---
title: Railway
summary: Deploy Zephyr Nexus on Railway with Dockerfile and Railway Postgres
---

This deployment runs Zephyr Nexus as a Railway web service backed by Railway PostgreSQL.

## Services

Create two Railway services:

1. `zephyr-web`: GitHub repository service using the repository root.
2. `Postgres`: Railway PostgreSQL database service.

The web service uses the repository `Dockerfile` through `railway.toml`. Do not use the embedded PostgreSQL mode on Railway.

## Required Variables

Set these on the `zephyr-web` service:

```env
DATABASE_URL=${{ Postgres.DATABASE_URL }}
HOST=0.0.0.0
SERVE_UI=true
ZEPHYR_DEPLOYMENT_MODE=authenticated
ZEPHYR_DEPLOYMENT_EXPOSURE=public
ZEPHYR_AUTH_BASE_URL_MODE=explicit
ZEPHYR_PUBLIC_URL=https://<your-railway-domain>
ZEPHYR_AUTH_PUBLIC_BASE_URL=https://<your-railway-domain>
BETTER_AUTH_URL=https://<your-railway-domain>
BETTER_AUTH_SECRET=<random-strong-secret>
ZEPHYR_AGENT_JWT_SECRET=<random-strong-secret>
ZEPHYR_SECRETS_MASTER_KEY=<fixed-32-byte-base64-or-hex-key>
ZEPHYR_SECRETS_STRICT_MODE=true
ZEPHYR_DB_BACKUP_ENABLED=false
HEARTBEAT_SCHEDULER_ENABLED=false
```

Replace `<your-railway-domain>` with the Railway public domain for the web service. Keep `BETTER_AUTH_SECRET`, `ZEPHYR_AGENT_JWT_SECRET`, and `ZEPHYR_SECRETS_MASTER_KEY` stable across redeploys.

## Health Check

Railway is configured to check:

```text
/api/health
```

A successful first authenticated deployment may return `bootstrapStatus: "bootstrap_pending"` until the first admin is created.

## First Admin

After the web service is deployed and the database migrations have run, create the first admin invite from an environment that has access to the Railway database:

```sh
ZEPHYR_DEPLOYMENT_MODE=authenticated \
DATABASE_URL="<railway-postgres-url>" \
ZEPHYR_PUBLIC_URL="https://<your-railway-domain>" \
pnpm --filter @zephyr-nexus/cli dev -- auth bootstrap-ceo
```

Open the printed invite URL, create/sign in to the first account, and finish the instance bootstrap.

## Phase 2 Runtime

Keep `HEARTBEAT_SCHEDULER_ENABLED=false` for the first deploy. Once the control plane is stable, connect agents through a separate worker, OpenClaw gateway, or another long-running execution host.

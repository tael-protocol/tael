#!/usr/bin/env bash
# Tael — Cloud Agent start (runs on every boot). Brings PostgreSQL back up and
# reconciles per-boot state. Must be idempotent and must return (the dev servers
# themselves run as terminals, not here).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Ensuring PostgreSQL is running"
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi
for _ in $(seq 1 30); do pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break; sleep 1; done

echo "==> Ensuring the local .env and per-app links exist"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres|" .env
  sed -i "s|^DIRECT_URL=.*|DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres|" .env
fi
for app in web dashboard chat; do
  ln -sfn ../../.env "apps/$app/.env"
done

echo "==> Applying any new database migrations"
pnpm --filter @tael/database db:migrate || true

echo "==> Start complete"

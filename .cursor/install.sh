#!/usr/bin/env bash
# Tael — Cloud Agent install (runs once; baked into the environment snapshot).
# Idempotent: installs deps + PostgreSQL, prepares the local .env, applies
# Drizzle migrations, and seeds a little demo data so the gateway + catalog have
# something to serve. Per-boot service startup lives in start.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

DEMO_WALLET="GDEMOPUBLISHER00000000000000000000000000000000000000000A"
USDC_ISSUER="GBCDXWBEN7YMCBI3DPIWQ5QBGG2NE7G5REZLNJI2E57VVNVDQM7PF7RA"

echo "==> Enabling corepack + installing workspace dependencies"
corepack enable 2>/dev/null || true
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm install --frozen-lockfile

echo "==> Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Starting PostgreSQL for setup"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break; sleep 1; done

echo "==> Setting the postgres role password (local dev only)"
sudo -u postgres psql -tAc "ALTER USER postgres PASSWORD 'postgres';" >/dev/null

echo "==> Preparing the root .env (only if missing)"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres|" .env
  sed -i "s|^DIRECT_URL=.*|DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres|" .env
fi

echo "==> Linking per-app .env for the Next.js apps (they don't read the repo-root .env)"
for app in web dashboard chat; do
  ln -sfn ../../.env "apps/$app/.env"
done

echo "==> Applying database migrations"
pnpm --filter @tael/database db:migrate

echo "==> Seeding demo capabilities (idempotent)"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 \
  -v wallet="$DEMO_WALLET" -v issuer="$USDC_ISSUER" <<'SQL'
INSERT INTO users (wallet_address, display_name)
VALUES (:'wallet', 'Tael Demo Publisher')
ON CONFLICT (wallet_address) DO NOTHING;

INSERT INTO capabilities
  (slug, name, description, kind, visibility, status, price, pay_to, upstream_url, upstream_auth, spec, publisher_id)
SELECT 'fx-rates', 'FX Rates',
       'Live foreign-exchange rates for 150+ currency pairs. Pay-per-lookup.',
       'api', 'public', 'verified', 0.0200, :'issuer',
       'https://api.example.com/fx',
       '{"scheme":"none"}'::jsonb,
       '{"method":"GET","operations":[]}'::jsonb,
       u.id
FROM users u WHERE u.wallet_address = :'wallet'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO capabilities
  (slug, name, description, kind, visibility, status, price, pay_to, upstream_url, upstream_auth, spec, publisher_id)
SELECT 'text-extract', 'Text Extract',
       'Extract clean text and structured data from any PDF or webpage.',
       'api', 'public', 'verified', 0.0500, :'issuer',
       'https://api.example.com/extract',
       '{"scheme":"none"}'::jsonb,
       '{"method":"POST","operations":[]}'::jsonb,
       u.id
FROM users u WHERE u.wallet_address = :'wallet'
ON CONFLICT (slug) DO NOTHING;
SQL

echo "==> Install complete"

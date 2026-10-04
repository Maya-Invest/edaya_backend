#!/usr/bin/env bash
set -euo pipefail

cd /app

export EDAYA_TEST_OTP_FILE="$(mktemp /tmp/edaya-image-otp-XXXXXX)"
cleanup() {
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
  rm -f "$EDAYA_TEST_OTP_FILE"
}
trap cleanup EXIT


echo "> Starting API + local file server for seed bake..."
bun tooling/repo/dev/local-files.ts &
NODE_ENV=test EDAYA_TEST_PORT=9999 EDAYA_TEST_AUTH_DATABASE_URL=pglite:/app/.data/identity \
  bun --no-env-file apps/api/src/identity/entries/testing.ts &

bash tooling/api-dev-container/wait-for-url.sh http://127.0.0.1:9999/reference 120

echo "> Running full demo seed..."
bun repo seed

touch .data/.seed-complete
echo "> Seeded database baked into image."

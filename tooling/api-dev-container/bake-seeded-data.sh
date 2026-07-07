#!/usr/bin/env bash
set -euo pipefail

cd /app

cleanup() {
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

echo "> Starting API + local file server for seed bake..."
bun --filter @edaya/local-files-server start &
bun apps/api/src/entries/local.ts &

bash tooling/api-dev-container/wait-for-url.sh http://127.0.0.1:9999/reference 120

echo "> Running full demo seed..."
bun seed

touch .data/.seed-complete
echo "> Seeded database baked into image."

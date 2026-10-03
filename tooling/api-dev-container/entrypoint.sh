#!/usr/bin/env bash
set -euo pipefail

cd /app

cleanup() {
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup SIGTERM SIGINT EXIT


echo "> Starting local file server on :9200"
bun tooling/repo/dev/local-files.ts &

echo "> Starting API on :9999 (pre-seeded PGlite at .data/school)"
bun apps/api/src/entries/local.ts &

wait -n

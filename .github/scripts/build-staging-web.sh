#!/usr/bin/env bash
set -euo pipefail
ROOT="${RELEASE_ROOT:?RELEASE_ROOT is required}"
export PUBLIC_API_URL=https://staging.api.edayaplus.com PUBLIC_APP_ENV=staging PUBLIC_TEST_OTP_ACCESS=false
export WRANGLER_SEND_METRICS=false CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false
cd "$ROOT/edaya_frontend"
bun --filter @edaya/webapp deploy:staging:dry-run
bun --filter @edaya/webadmin deploy:staging:dry-run
mkdir -p "$ROOT/release/builds"
for app in webapp webadmin; do
  tar -czf "$ROOT/release/builds/$app.tar.gz" -C "apps/$app" build
done

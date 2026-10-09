#!/usr/bin/env bash
# Run only against three clean candidate checkouts, without live credentials.
set -euo pipefail
ROOT="${RELEASE_ROOT:?RELEASE_ROOT is required}"
export VALIDATE_ONLY=true RESET_DATA=false RELEASE_TARGET=staging REPOSITORY_READINESS=true
export CI=true TURBO_FORCE=true WRANGLER_SEND_METRICS=false CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false
node "$ROOT/edaya_backend/.github/scripts/readiness-guard.mjs"
mkdir -p "$ROOT/release"
node "$ROOT/edaya_backend/.github/scripts/staging-manifest.mjs"
bash "$ROOT/edaya_backend/.github/scripts/qualify-staging.sh"
bash "$ROOT/edaya_backend/.github/scripts/build-staging-web.sh"
(cd "$ROOT/edaya_mobile" && bash scripts/build-staging-apks.sh)
node "$ROOT/edaya_mobile/scripts/verify-staging-apks.mjs"
node "$ROOT/edaya_backend/.github/scripts/staging-apk-reuse.mjs" record
node "$ROOT/edaya_backend/.github/scripts/readiness-guard.mjs"
RELEASE_STATUS=qualified node "$ROOT/edaya_backend/.github/scripts/staging-manifest.mjs"

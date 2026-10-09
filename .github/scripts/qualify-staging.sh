#!/usr/bin/env bash
set -euo pipefail
ROOT="${RELEASE_ROOT:?RELEASE_ROOT must contain the three product checkouts}"
BACKEND="$ROOT/edaya_backend"
WEB="$ROOT/edaya_frontend"
MOBILE="$ROOT/edaya_mobile"
mkdir -p "$ROOT/release/builds"
export WRANGLER_SEND_METRICS=false CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false
test "$(bun --version)" = 1.3.14
for repo in "$BACKEND" "$WEB"; do
  (cd "$repo" && bun install --frozen-lockfile && node "$BACKEND/.github/scripts/readiness-guard.mjs" --lint-dependencies "$repo" && bash .github/scripts/lint-workflows.sh && bun run verify)
done
export PATH="$(pg_config --bindir):$PATH"
(cd "$BACKEND" && bun repo openapi generate && git diff --exit-code -- package/api-client/src tooling/repo/fixtures && bun run test:integration && bun run test:integration:seed && bun run test:integration:native)
node "$BACKEND/.github/scripts/rehearse-staging.mjs"
(cd "$MOBILE" && dart pub get --enforce-lockfile && melos bootstrap && git diff --exit-code -- pubspec.lock && bash .github/scripts/lint-workflows.sh && dart run melos run verify)
(cd "$MOBILE" && python3 scripts/staging-smoke.py --validate-runner)
# Browser PRs and releases use the same suite inventory and execution validator.
export CI_BACKEND_SHA="$(git -C "$BACKEND" rev-parse HEAD)"
bash "$WEB/.github/scripts/run-browser-integration.sh"
(cd "$WEB" && python3 .github/scripts/ci_support.py evidence --role web)
cp "$WEB/.ci-evidence/results.json" "$ROOT/release/browser-integration.json"

# Native suites get a fresh disposable fixture, without sharing browser state.
export EDAYA_CI_API_PORT=11999 EDAYA_CI_FILES_PORT=19200
export EDAYA_CI_WEBAPP_ORIGIN=http://127.0.0.1:14173
export EDAYA_CI_API_PID_DIR="$ROOT/.release-private/mobile-apis"
export EDAYA_TEST_API_URL=http://127.0.0.1:11999
cleanup() { GITHUB_WORKSPACE="$WEB" bash "$WEB/.github/scripts/ci-start-local-apis.sh" stop; }
trap cleanup EXIT
GITHUB_WORKSPACE="$WEB" GITHUB_ENV='' bash "$WEB/.github/scripts/ci-start-local-apis.sh" start
export SEED_ENV_FILE="$EDAYA_CI_API_PID_DIR/school.env"
export SEED_API_URL="$EDAYA_TEST_API_URL"
export EDAYA_TEST_OTP_FILE="$EDAYA_CI_API_PID_DIR/otp.jsonl"
export EDAYA_TEST_CLOCK_FILE="$EDAYA_CI_API_PID_DIR/clock-offset"
export EDAYA_TEST_POLICY_FILE="$EDAYA_CI_API_PID_DIR/privileged-accounts.json"
(cd "$BACKEND" && bun --no-env-file repo seed --skip-profile-photos --skip-attachments)
(cd "$MOBILE" && EDAYA_API_URL="$EDAYA_TEST_API_URL" python3 scripts/integration-runner.py && python3 .github/scripts/ci_support.py evidence --role mobile)
cp "$MOBILE/.ci-evidence/results.json" "$ROOT/release/mobile-integration.json"
(cd "$BACKEND/apps/api" && ./node_modules/.bin/wrangler deploy --env staging --dry-run --outdir "$ROOT/release/builds/api")
date -u +%FT%TZ > "$ROOT/release/qualification-passed.txt"

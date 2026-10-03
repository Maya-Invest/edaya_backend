#!/usr/bin/env bash
set -euo pipefail
ROOT="${RELEASE_ROOT:?RELEASE_ROOT must contain the three product checkouts}"
BACKEND="$ROOT/edaya_backend"
WEB="$ROOT/edaya_frontend"
MOBILE="$ROOT/edaya_mobile"
mkdir -p "$ROOT/release"
test "$(bun --version)" = 1.3.14
for repo in "$BACKEND" "$WEB"; do
  (cd "$repo" && bun install --frozen-lockfile && bun run verify)
done
(cd "$BACKEND" && bun repo openapi generate && git diff --exit-code -- package/api-client/src tooling/repo/fixtures && bun test ./.github/scripts/*.test.mjs && bun run test:integration && bun run test:integration:native)
node "$BACKEND/.github/scripts/rehearse-staging.mjs"
(cd "$MOBILE" && dart pub get --enforce-lockfile && EDAYA_OPENAPI_SPEC="$BACKEND/tooling/repo/fixtures/openapi.json" bash scripts/generate-api-bindings.sh && git diff --exit-code -- packages/edaya_api_client/spec packages/edaya_api_client/lib/src/generated && dart run melos run verify)

# Only these release-owned process IDs are stopped. Ports are isolated from normal development.
export EDAYA_CI_API_PORT=11999 EDAYA_CI_FILES_PORT=19200
export EDAYA_CI_WEBAPP_ORIGIN=http://127.0.0.1:14173
export EDAYA_CI_API_PID_DIR="$ROOT/.release-private/local-apis"
export EDAYA_TEST_API_URL=http://127.0.0.1:11999
WEB_PID=""
DEMO_PID=""
cleanup() {
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
  if [ -n "$DEMO_PID" ]; then kill "$DEMO_PID" 2>/dev/null || true; fi
  GITHUB_WORKSPACE="$WEB" bash "$WEB/.github/scripts/ci-start-local-apis.sh" stop
}
trap cleanup EXIT
# Keep local fixture credentials and clocks out of later live-release steps.
GITHUB_WORKSPACE="$WEB" GITHUB_ENV="" bash "$WEB/.github/scripts/ci-start-local-apis.sh" start
export API_URL="$EDAYA_TEST_API_URL"
export EDAYA_TEST_OTP_FILE="$EDAYA_CI_API_PID_DIR/otp.jsonl"
export EDAYA_TEST_CLOCK_FILE="$EDAYA_CI_API_PID_DIR/clock-offset"
export EDAYA_TEST_POLICY_FILE="$EDAYA_CI_API_PID_DIR/privileged-accounts.json"
export SEED_ENV_FILE="$EDAYA_CI_API_PID_DIR/school.env"
(cd "$BACKEND" && bun run test:integration:seed)
(cd "$WEB/apps/webapp" && bunx playwright install --with-deps chromium)
(cd "$WEB" && PUBLIC_API_URL="$EDAYA_TEST_API_URL" PUBLIC_APP_ENV=staging PUBLIC_TEST_OTP_ACCESS=true bun --filter @edaya/webapp build)
(cd "$WEB/apps/webapp" && exec ./node_modules/.bin/wrangler dev --local --port 14173 --ip 127.0.0.1 > "$EDAYA_CI_API_PID_DIR/web.log" 2>&1) &
WEB_PID=$!
bash "$WEB/.github/scripts/ci-wait-for-url.sh" "$EDAYA_CI_WEBAPP_ORIGIN/login"
(cd "$WEB/apps/webapp" && WEBAPP_URL="$EDAYA_CI_WEBAPP_ORIGIN" WEBAPP_READINESS_PATH=/login bun run test:integration:availability && WEBAPP_URL="$EDAYA_CI_WEBAPP_ORIGIN" WEBAPP_READINESS_PATH=/login bun run test:integration:onboarding && WEBAPP_URL="$EDAYA_CI_WEBAPP_ORIGIN" WEBAPP_READINESS_PATH=/login INTEGRATION_FAIL_ON=not_ok bun run test:integration:provisioned && bun run test:integration:webadmin && bun run test:integration:coverage)
node "$BACKEND/.github/scripts/staging-evidence.mjs" browser
(cd "$BACKEND" && SEED_API_URL="$EDAYA_TEST_API_URL" SEED_APP_ORIGIN="$EDAYA_CI_WEBAPP_ORIGIN" bun repo seed --skip-profile-photos --skip-attachments)
# Demo journeys exercise the development URL picker on the same disposable fixture stack.
(cd "$WEB/apps/webapp" && PUBLIC_APP_ENV=development PUBLIC_API_URL="$API_URL" PUBLIC_TEST_OTP_ACCESS=true exec bun run dev --host 127.0.0.1 --port 14174 --strictPort > "$EDAYA_CI_API_PID_DIR/demo-web.log" 2>&1) &
DEMO_PID=$!
bash "$WEB/.github/scripts/ci-wait-for-url.sh" "http://127.0.0.1:14174/login"
(cd "$WEB/apps/webapp" && WEBAPP_URL=http://127.0.0.1:14174 DEMO_DRY_RUN_OUT_DIR="$ROOT/release/demo-browser" bun test tests/integration/demo-dry-run/demo-dry-run.test.ts)
(cd "$MOBILE" && EDAYA_INTEGRATION_TESTS=1 EDAYA_API_URL="$EDAYA_TEST_API_URL" dart run melos run test:integration)

for app in "$BACKEND/apps/api"; do
  (cd "$app" && ./node_modules/.bin/wrangler deploy --env staging --dry-run)
done
date -u +%FT%TZ > "$ROOT/release/qualification-passed.txt"

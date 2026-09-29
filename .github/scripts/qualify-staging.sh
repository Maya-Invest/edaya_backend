#!/usr/bin/env bash
set -euo pipefail
ROOT="${RELEASE_ROOT:?RELEASE_ROOT must contain the three product checkouts}"
BACKEND="$ROOT/edaya_backend"
IDENTITY="$BACKEND"
WEB="$ROOT/edaya_frontend"
MOBILE="$ROOT/edaya_mobile"
mkdir -p "$ROOT/release"
test "$(bun --version)" = 1.3.14
for repo in "$BACKEND" "$WEB"; do
  (cd "$repo" && bun install --frozen-lockfile && bun run verify)
done
(cd "$BACKEND" && bun repo openapi generate && git diff --exit-code -- package/api-client/src tooling/repo/fixtures && bun test ./.github/scripts/staging-target.test.mjs ./.github/scripts/observe-staging.test.mjs && bun run test:integration && bun run test:integration:native)
node "$BACKEND/.github/scripts/rehearse-staging.mjs"
(cd "$MOBILE" && dart pub get --enforce-lockfile && EDAYA_OPENAPI_SPEC="$BACKEND/tooling/repo/fixtures/openapi.json" bash scripts/generate-api-bindings.sh && git diff --exit-code -- packages/edaya_api_client/spec packages/edaya_api_client/lib/src/generated && dart run melos run verify)

# Only these release-owned process IDs are stopped. Ports are isolated from normal development.
export EDAYA_CI_AUTH_PORT=11990 EDAYA_CI_API_PORT=11999 EDAYA_CI_FILES_PORT=19200
export EDAYA_CI_WEBAPP_ORIGIN=http://127.0.0.1:14173
export EDAYA_CI_API_PID_DIR="$ROOT/.release-private/local-apis"
export EDAYA_TEST_IDENTITY_URL=http://127.0.0.1:11990 EDAYA_TEST_API_URL=http://127.0.0.1:11999
WEB_PID=""
cleanup() {
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
  GITHUB_WORKSPACE="$WEB" bash "$WEB/.github/scripts/ci-start-local-apis.sh" stop
}
trap cleanup EXIT
GITHUB_WORKSPACE="$WEB" bash "$WEB/.github/scripts/ci-start-local-apis.sh" start
(cd "$BACKEND" && bun run test:integration:seed)
(cd "$WEB/apps/webapp" && bunx playwright install --with-deps chromium)
(cd "$WEB" && PUBLIC_AUTH_URL="$EDAYA_TEST_IDENTITY_URL" PUBLIC_API_URL="$EDAYA_TEST_API_URL" PUBLIC_APP_ENV=staging bun --filter @edaya/webapp build)
(cd "$WEB/apps/webapp" && exec ./node_modules/.bin/wrangler dev --local --port 14173 --ip 127.0.0.1 > "$EDAYA_CI_API_PID_DIR/web.log" 2>&1) &
WEB_PID=$!
bash "$WEB/.github/scripts/ci-wait-for-url.sh" "$EDAYA_CI_WEBAPP_ORIGIN/login"
(cd "$WEB/apps/webapp" && AUTH_URL="$EDAYA_TEST_IDENTITY_URL" API_URL="$EDAYA_TEST_API_URL" WEBAPP_URL="$EDAYA_CI_WEBAPP_ORIGIN" WEBAPP_READINESS_PATH=/login INTEGRATION_FAIL_ON=not_ok bun run test:integration:provisioned)
node "$BACKEND/.github/scripts/staging-evidence.mjs" browser
(cd "$BACKEND" && SEED_API_URL="$EDAYA_TEST_API_URL" SEED_AUTH_URL="$EDAYA_TEST_IDENTITY_URL" SEED_APP_ORIGIN="$EDAYA_CI_WEBAPP_ORIGIN" bun repo seed --skip-profile-photos --skip-attachments)
(cd "$MOBILE" && EDAYA_INTEGRATION_TESTS=1 EDAYA_AUTH_URL="$EDAYA_TEST_IDENTITY_URL" EDAYA_API_URL="$EDAYA_TEST_API_URL" dart run melos run test:integration)

for app in "$IDENTITY/apps/identity" "$BACKEND/apps/api"; do
  (cd "$app" && ./node_modules/.bin/wrangler deploy --env staging --dry-run)
done
date -u +%FT%TZ > "$ROOT/release/qualification-passed.txt"

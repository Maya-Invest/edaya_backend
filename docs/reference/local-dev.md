# Local development

Run the **Edaya Core API** on your machine. Web frontends (`@edaya/webapp`, `@edaya/webadmin`) live in the sibling **[edaya_frontend](../../edaya_frontend/README.MD)** repo.

The webapp is a **static SPA** (`ssr = false`) that calls the API from the browser via `@maya-invest/edaya-api-client`. Identity login targets the backend’s separate identity service; school requests carry its access JWT as a Bearer token.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (repo `packageManager`: `bun@1.3.14`)
- Run `bun install` in this backend workspace (includes identity)
- **edaya_frontend** checked out as a sibling directory for the webapp UI

## First-time setup

```sh
# API — persisted school PGlite under repo-root `.data/`
cp apps/api/.env.example apps/api/.env

# Ops & seeding (remote URLs, Neon connection strings, smoke credentials)
cp .env.example .env

# Webapp — in edaya_frontend
cd ../edaya_frontend
cp apps/webapp/.env.example apps/webapp/.env
```

## Start identity + API + webapp

```sh
# Terminal 1 — Unified API :9999, files :9200
cd edaya_backend && bun dev

# Terminal 2 — Webapp :5173
cd edaya_frontend && bun --filter @edaya/webapp dev
```

## URLs

| Service | URL |
|---------|-----|
| Webapp | http://localhost:5173 |
| School API | http://localhost:9999 |
| Account authentication | http://localhost:9999 |
| OpenAPI reference | http://localhost:9999/reference |
| GraphiQL (entity API) | http://localhost:9999/graphiql |

## How the webapp reaches the API

- **Browser client** — Identity login runs against `PUBLIC_API_URL` (`http://localhost:9999`); school requests use the returned Bearer JWT and never use identity cookies.
- **API base URL** — `PUBLIC_API_URL` targets the school API (`http://localhost:9999` locally).
- **Bootstrap** — The webapp obtains an identity access token, then loads `/core/authorization/effective-grants`.

See [webapp-migration-plan.md](../sprints/archive/webapp-migration-plan.md) for the completed mock → API migration (edaya_frontend).

## API runtimes

The API uses explicit **profiles** (`local`, `in-memory`, `worker`). See [runtime-boundaries.md](./runtime-boundaries.md) for the adapter contract.

| Profile | Command | School DB |
|---------|---------|-----------|
| **local** | `bun repo dev` | PGlite `.data/school` |
| **worker** | `bun --filter @edaya/api dev:worker` | Postgres via school Hyperdrive |

Central Identity is a separate process/Worker with its own database. Tests use `RUNTIME=in-memory` programmatically (ephemeral school PGlite). Workers use `wrangler.jsonc` + `.dev.vars` (not loaded by `bun repo dev`). See [api-runtimes.md](./api-runtimes.md).

## API database (local profile)

`RUNTIME=local` uses `DATABASE_URL=pglite:.data/school`. Account authentication shares the API process and uses its separate database.

## File storage (local dev)

`bun repo dev` starts identity, the school API, and the local file server together. Uploads persist under repo-root `.data/files/` (gitignored).

| Variable | Default |
|----------|---------|
| `LOCAL_FILES_URL` | `http://localhost:9200` |
| `LOCAL_FILES_ROOT` | `.data/files` |
| `LOCAL_FILES_PORT` | `9200` (service only) |
| `LOCAL_FILES_SECRET` | Explicit local file-service shared secret |

Profile photos and uploads use the presigned-URL flow: `/core/files/{attachmentId}/content`. The browser PUTs to `LOCAL_FILES_URL` (CORS allows origins from `TRUSTED_ORIGINS`).

### worker smoke (R2, Hyperdrive)

Optional — exercises the same adaptors as deployed workers. Requires `apps/api/.dev.vars` (Wrangler secrets; **not** read by `bun repo dev`).

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun --filter @edaya/api dev:worker
```

Point `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.dev.vars` at the **staging** Neon branch. Production is deploy-only; use `wrangler dev --env prod` manually only when required.

See [api-runtimes.md](./api-runtimes.md).

## Environment credentials matrix

| Concern | Local dev (`bun repo dev`) | Staging | Production |
|---------|----------------------|---------|------------|
| **Env file** | `apps/api/.env` | `wrangler.jsonc` `[env.staging]` + Wrangler secrets | `wrangler.jsonc` `[env.production]` + Wrangler secrets |
| **Database** | PGlite `.data/school` | Neon branch via Hyperdrive `c6b9a94e…` | Neon branch via Hyperdrive `c65edec7…` |
| **File storage** | `bun tooling/repo/dev/local-files.ts` (:9200) | R2 `edaya-files-staging` | R2 `edaya-files-production` |
| **Notify** | In-process `@edaya/adaptor-notify` (API injects log email + log SMS) | Cloudflare Email + unimplemented SMS + optional FCM on the API Worker | Same as staging |
| **Documents** | In-process `@edaya/adaptor-docs` (Chrome if installed, Gotenberg if `GOTENBERG_URL`, else stub) | API Worker `BROWSER` binding (Browser Run); optional `GOTENBERG_URL` for `wrangler dev` | Same as staging |

**Wrangler secret templates** (from `apps/api/`):

```sh
cp secrets.json.example secrets.staging.json   # fill staging R2
cp secrets.json.example secrets.prod.json         # fill production R2
bunx wrangler secret bulk secrets.staging.json --env staging
bunx wrangler secret bulk secrets.prod.json --env prod
```

**Neon connection strings** (migrations only — not in Wrangler): add `STAGING_DATABASE_URL` / `PRODUCTION_DATABASE_URL` to repo root `.env` (gitignored) or pass inline.

**Hyperdrive local origin** (worker smoke only): `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `apps/api/.dev.vars` must match the Neon branch for the `--env` you choose.

## Browse local database tables

Plain HTTP browser — no extra setup.

```sh
# School data (students, announcements, etc.) — stop `bun repo dev` first
bun repo db browser school

```

Opens automatically at `http://127.0.0.1:8192`.

| Symptom | Fix |
|---------|-----|
| School browser fails to open PGlite | Stop `bun repo dev` first — the API holds the lock on `.data/school` |

## Dev database seed

Seeding targets both local deployments: the unified API at `http://localhost:9999`. Each service owns its database. After starting the API, run `bun repo seed` in another terminal to load demo data.

### Fresh clone or after wiping `.data/`

**Order matters.** Never delete `.data` while `bun repo dev` is running — open PGlite/SQLite handles will corrupt the files.

```sh
# 1. Stop bun repo dev (Ctrl+C)

# 2. Wipe local databases
rm -rf .data

# 3. Start API + webapp
bun repo dev          # terminal 1 — http://localhost:9999/

# 4. Seed demo data (once API is ready)
bun repo seed    # terminal 2
```

`bun repo seed` runs the full HTTP seed. On a fresh database the flow is:

1. Provision central identity users through the identity Worker
2. Sign in and call `POST /core/onboarding/register-school` when no school exists yet
3. Seed access roles, provision the seeding service account with the school profile API key
4. Load demo school data through `/core/*` routes

**Credentials:** seeding uses the `seedingApiKey` from the school profile in `@edaya/fixtures` — no `.env` API key required. For GraphiQL Bearer auto-injection, set `GRAPHQL_DEV_API_KEY` to the same profile key.

| Command | Purpose |
|---------|---------|
| `bun repo seed` | Full local demo data via HTTP |
| `bun repo seed --staging` | Full seed against `SEED_STAGING_API_URL` |
| `bun repo seed --scope doctor` | Diagnose seed health (sign-in, grants, entity checks) |
| `bun repo seed --scope doctor --repair` | Auto-repair common drift without wiping `.data` |
| `bun repo seed --scope <name>` | Granular scope — `bun repo seed --help` for list |

**Staging:** see [deploy-staging.md](./deploy-staging.md). Use `bun repo smoke-test staging` for post-deploy checks.

Fixture data lives in `tooling/fixtures/`. Loaders and orchestration live in `tooling/seeding/`.

**Reference date:** rolling dashboard data anchors to the dataset clock in `tooling/fixtures/src/meta/dates.ts` (demo-ci default `2026-09-17`, central `2026-06-16`). Override at seed time with `SEED_REFERENCE_DATE` in `apps/api/.env` or repo root `.env`.

See `tooling/fixtures/src/meta/entity-manifest.ts` for entity coverage status.

### Demo login

In local dev, the webapp `/login` page signs into the identity service with the demo credentials.

## Identity emails

OTP and signup-verification delivery is owned by the unified API's identity module (`apps/api/src/identity`). The school notification cron handles school-domain notifications only. See [cron-runtimes.md](./cron-runtimes.md).

To send authentication emails from the local server, configure `apps/api/.env` (or the file selected by `EDAYA_LOCAL_ENV_FILE`):

```dotenv
CLOUDFLARE_EMAIL_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_EMAIL_API_TOKEN=your-email-sending-api-token
EMAIL_FROM=EDAYA <noreply@edayaplus.com>
```

The sender domain must be enabled for Cloudflare Email Sending, and the token must have permission to send email in that account. Local processes use the [Cloudflare REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/); Workers keep their `EMAIL` binding. Process environment values take precedence over the local file. Keep credentials in the gitignored local file or process environment.

With both credentials present, real OTP delivery is automatic in normal development and `dev:test`. Remove any existing `EMAIL_TRANSPORT=log` setting to enable it; retaining that setting explicitly disables sending. With neither credential, delivery remains omitted locally. Partial credentials produce a configuration warning and disable real delivery. These credentials apply to authentication emails; school notification delivery is unchanged.

## Testing

Use package-scoped commands for fast local feedback:

```sh
bun --filter @edaya/core lint
bun --filter @edaya/core check
bun --filter @edaya/core test

bun --filter @edaya/api lint
bun --filter @edaya/api check
bun --filter @edaya/api test
```

Webapp tests run from **edaya_frontend** (`bun --filter @edaya/webapp test`).

Before opening a pull request, run `bun run verify`. For integration coverage (HTTP routes, PGlite services), also run `bun run test:integration`. See [repo-cli.md](./repo-cli.md) and [test-pyramid-plan.md](../sprints/test-pyramid-plan.md).

| Location | Scope |
|----------|-------|
| `apps/api/tests/` | API unit tests (mocked runtime) |
| `tooling/integration-tests/src/services/` etc. | Integration `api` slice (PGlite) |
| `tooling/integration-tests/src/routes/` etc. | Integration `http` slice |
| `tooling/integration-tests/src/seed/` | Integration `seed` slice (slow; opt-in) |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `bun repo seed` times out; `/doc` returns 500 with PGlite file errors | `.data` wiped or corrupted while API was running | Stop `bun repo dev`, `rm -rf .data`, restart, `bun repo seed` |
| `POST /auth/edaya/otp/start` fails | Identity database empty or identity service unavailable | Start the unified API on port 9999, then run the full seed |
| Sign-in succeeds but app shows “Session API indisponible” | Identity subject exists but the school actor is not linked | Run the full seed against identity and school |
| `422` on `/core/entities/.../list` during login | Stale API process after schema changes | Restart `bun repo dev` |
| Webapp shows API unreachable | API not ready on port 9999 | Wait for startup; set `PUBLIC_API_URL` to the school API origin (`http://localhost:9999`) |
| DB browser fails on school tables | API still running (`bun repo dev`) holds the `.data/school` lock | Stop `bun repo dev`, then run `bun repo db browser school` |

Quick health checks:

```sh
curl -s http://localhost:9999/            # expect {"message":"Edaya Core API"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9999/doc   # expect 200
bun repo seed --scope doctor                                                    # health check (sign-in + grants + data)
```

- **Port in use** — Change `PORT` in `apps/api/.env`; update `API_URL` in the webapp `.env` to match.
- **401 after login** — Verify the JWT issuer/audience match `IDENTITY_ISSUER` and `API_ORIGIN`.

## Account authentication

Use the dedicated `bun run dev:test` server for captured local email/WhatsApp/SMS verification. Password and Telegram endpoints are absent. `bun repo seed` exercises local OTP; remote staging fixtures use an explicitly generated `SEED_AUTH_SESSIONS_FILE`, never the development OTP endpoint.

See [Account architecture and cutover](../proposals/three-repo-account-auth-architecture.md) for encryption keys, optional TOTP, provider replacement, and launch gates. Identity migrations: `AUTH_DATABASE_URL=... bun repo identity-migrate`. Keep the identity database separate from the school database.

## Test-only OTP access

From the backend checkout run `bun run dev:test`. Identity requires `NODE_ENV=test`, binds to `127.0.0.1:9999`, and uses a disposable in-memory identity database. It captures email, WhatsApp and SMS without requiring provider credentials; phone verification starts with WhatsApp for Côte d’Ivoire. Email settings are loaded from the normal local configuration described above, while identity database, secret and origin settings remain isolated under explicit `EDAYA_TEST_*` configuration. No `.env` files are rewritten. The school API continues to use its normal local configuration. Localhost and Android emulator Identity origins are included for native debug clients. Set `EDAYA_TEST_PORT`, `EDAYA_TEST_API_ORIGIN` and `EDAYA_TEST_TRUSTED_ORIGINS` inline when using other local ports. An optional `EDAYA_TEST_AUTH_DATABASE_URL` must point to a local test database; do not reuse normal development data.

When email sending is configured, each email challenge captures and sends the same OTP once. Email failures emit a sanitized terminal warning and leave the captured code usable. Requests time out after 10 seconds and are not automatically retried. WhatsApp and SMS remain capture-only. Revealing or copying a code never sends email. Ordinary automated tests remain offline unless they explicitly inject a delivery dependency; CI can also set `EMAIL_TRANSPORT=log` to keep `dev:test` capture-only regardless of inherited credentials.

Start the webapp with `PUBLIC_TEST_OTP_ACCESS=true PUBLIC_API_URL=http://127.0.0.1:9999 bun --filter @edaya/webapp dev` from the web checkout. Start either Flutter app in debug with `flutter run --dart-define=TEST_OTP_ACCESS=true` and a loopback Identity URL. The controls also require successful server capability discovery. Staging is not a testing signal. Normal deployment commands and Flutter profile/release builds exclude access.

Send a code through the normal form, select **Show test code**, optionally **Copy**, and manually enter it before verifying. Reveal creates no message, OTP guess or session. Login and contact linking use the same controls. Codes are transient and clear on replacement, expiry, completion, reset, departure or backgrounding. French and English are supported.

Stop with Ctrl-C: the server clears captured codes and closes its database. The optional CI mailbox (`EDAYA_TEST_OTP_FILE`, permissions 0600), clock (`EDAYA_TEST_CLOCK_FILE`) and privileged policy (`EDAYA_TEST_POLICY_FILE`) remain private fixtures; delete mailbox files after shutdown and never upload them. The integration start/stop scripts use disposable school configuration and clean the private fixtures on stop.

Only the testing entry exposes `GET /auth/edaya/testing/capabilities` and `POST /auth/edaya/testing/otp` with `{challenge}`. Both return `Cache-Control: no-store`; pending challenges only, with original recent session authorization for linking. The normal application returns 404 for these routes and the removed `/auth/edaya/dev/last-otp` route in every environment. No migration or hosted testing deployment is required.

For a complete disposable school/Identity/files stack, run `.github/scripts/ci-start-local-apis.sh start` from the web or mobile checkout. Its optional `EDAYA_CI_API_PID_DIR` selects the fixture directory (default `/tmp/edaya-ci-apis`). To seed it, run from the backend with `SEED_ENV_FILE=/tmp/edaya-ci-apis/school.env SEED_API_URL=http://127.0.0.1:9999 EDAYA_TEST_OTP_FILE=/tmp/edaya-ci-apis/otp.jsonl bun --no-env-file repo seed --skip-profile-photos --skip-attachments`. Use the matching Identity issuer and school API origin from the disposable configuration. Run the same script with `stop` when finished. Never attach the private mailbox or disposable environment file as an artifact.

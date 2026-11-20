# Local development

See [API configuration and secrets](api-configuration.md) for JSONC settings, secrets-only files, and the `bun repo ops vars` commands.

Run the **EDaya Core API** on your machine. Web frontends (`@edaya/webapp`, `@edaya/webadmin`) live in the sibling **[edaya_frontend](../../edaya_frontend/README.MD)** repo.

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

## How the webapp reaches the API

- **Browser client** — Identity login runs against `PUBLIC_API_URL` (`http://localhost:9999`); school requests use the returned Bearer JWT and never use identity cookies.
- **API base URL** — `PUBLIC_API_URL` targets the school API (`http://localhost:9999` locally).
- **Bootstrap** — The webapp obtains an identity access token, then loads `/core/authorization/effective-grants`.

See [webapp-migration-plan.md](../sprints/archive/webapp-migration-plan.md) for the completed mock → API migration (edaya_frontend).

## API runtimes

The API uses explicit **profiles** (`local`, `in-memory`, `worker`). See [runtime-boundaries.md](./runtime-boundaries.md) for the adapter contract.

| Profile | Command | School DB |
|---------|---------|-----------|
| **local** | `bun run repo dev` | PGlite `.data/school` |
| **worker** | `bun --filter @edaya/api dev:worker` | Postgres via school Hyperdrive |

Identity runs in the unified API with its own database. Tests use `RUNTIME=in-memory` programmatically (ephemeral school PGlite). Wrangler smoke uses `config.staging.jsonc` + `.dev.vars` (not loaded by `bun run repo dev`). See [api-runtimes.md](./api-runtimes.md).

## API database (local profile)

`RUNTIME=local` uses `DATABASE_URL=pglite:.data/school`. Account authentication shares the API process and uses its separate database.

## File storage (local dev)

`bun run repo dev` starts identity, the school API, and the local file server together. Uploads persist under repo-root `.data/files/` (gitignored).

| Variable | Default |
|----------|---------|
| `LOCAL_FILES_URL` | `http://localhost:9200` |
| `LOCAL_FILES_ROOT` | `.data/files` |
| `LOCAL_FILES_PORT` | `9200` (service only) |
| `LOCAL_FILES_SECRET` | Explicit local file-service shared secret |

Profile photos and uploads use the presigned-URL flow: `/core/files/{attachmentId}/content`. The browser PUTs to `LOCAL_FILES_URL` (CORS allows origins from `TRUSTED_ORIGINS`).

### worker smoke (R2, Hyperdrive)

Optional — exercises the same adaptors as deployed workers. Requires `apps/api/.dev.vars` (Wrangler secrets; **not** read by `bun run repo dev`).

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun --filter @edaya/api dev:worker
```

Point `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.dev.vars` at the **staging** Neon branch. Production is deploy-only; use `wrangler dev --env prod` manually only when required.

See [api-runtimes.md](./api-runtimes.md).

## Grade/year subject cutover

Migration `0044_grade_year_subjects.sql` requires empty curriculum and staff grant tables. It deliberately rejects populated legacy data. Reset and reseed the school database for this breaking model change; keep the separate identity/account database and existing migration history. Back up the local school store before resetting it and stop the local API while changing its persisted data.

The web and mobile clients must be regenerated from the same backend candidate. The new `Subject` owns its grade, academic year, metadata and workload. `ClassSubject.subjectId` references that subject; chapters no longer have grade-allocation links. Use `configureSubject`, `updateSubject`, `removeSubject`, `configureSubjectMatter` and `removeSubjectMatter`. Existing grade-allocation endpoints and grant payloads are not compatible. Subject grant payloads use `{ kind: 'subject', gradeLevelId, subjectId? }`.

## Environment credentials matrix

| Concern | Local dev (`bun run repo dev`) | Staging | Production |
|---------|----------------------|---------|------------|
| **Env file** | `config.local.jsonc` + `.env` secrets | `config.staging.jsonc` + Worker secrets | `config.production.jsonc` + Worker secrets |
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
# School data (students, announcements, etc.) — stop `bun run repo dev` first
bun repo ops db browser school

```

Opens automatically at `http://127.0.0.1:8192`.

| Symptom | Fix |
|---------|-----|
| School browser fails to open PGlite | Stop `bun run repo dev` first — the API holds the lock on `.data/school` |

## Upgrading school identifiers on existing data

The ordinary school migration upgrades a populated pre-0054 database in place. For local development run `bun repo ops db migrate school local` with the local API stopped. Staging and production use the same SQL through the deploy workflow.

Migration 0054 keeps person IDs, relationships, and national identifiers. It maps existing matricules and human staff, teacher, and guardian codes to optional identifiers using the same canonical format as new writes. Leading zeroes are preserved. Missing values remain empty. If a legacy identifier is invalid or two people in the same school and profile group would receive the same identifier, the transaction rolls back and reports the affected row IDs. Correct those records in the pre-upgrade schema and retry.

The migration carries existing short names, grade labels, discipline codes and placement codes forward. Missing abbreviations are generated from the display name. Subjects retain their original code in `subjects.legacy_code`, including when they have a different curated short name. Service accounts keep their service ID and key bindings and acquire display fields from their existing name and code.

## Dev database seed

Seeding targets both local deployments: the unified API at `http://localhost:9999`. Each service owns its database. After starting the API, run `bun repo ops seed` in another terminal to load demo data.

### Fresh clone or after wiping `.data/`

**Order matters.** Never delete `.data` while `bun run repo dev` is running — open PGlite/SQLite handles will corrupt the files.

```sh
# 1. Stop bun run repo dev (Ctrl+C)

# 2. Wipe local databases
rm -rf .data

# 3. Start API + webapp
bun run repo dev          # terminal 1 — http://localhost:9999/

# 4. Seed demo data (once API is ready)
bun repo ops seed    # terminal 2
```

`bun repo ops seed` runs the full HTTP seed. On a fresh database the flow is:

1. Provision central identity users through the identity Worker
2. Sign in and call `POST /core/onboarding/register-school` when no school exists yet
3. Seed access roles, provision the seeding service account with the school profile API key
4. Load demo school data through `/core/*` routes

**Credentials:** seeding uses the `seedingApiKey` from the school profile in `@edaya/fixtures` — no `.env` API key required.

| Command | Purpose |
|---------|---------|
| `bun repo ops seed` | Full local demo data via HTTP |
| `bun repo ops seed staging` | Full seed against `SEED_STAGING_API_URL` |
| `bun repo ops seed --scope doctor` | Diagnose seed health (sign-in, grants, entity checks) |
| `bun repo ops seed --scope doctor --repair` | Auto-repair common drift without wiping `.data` |
| `bun repo ops seed --scope <name>` | Granular scope — `bun repo ops seed --help` for list |

**Staging:** see [deploy-staging.md](./deploy-staging.md). Use `bun repo ops smoke api staging` for post-deploy checks.

Fixture data lives in `tooling/fixtures/`. Loaders and orchestration live in `tooling/seeding/`.

**Reference date:** rolling dashboard data anchors to the dataset clock in `tooling/fixtures/src/meta/dates.ts` (demo-ci default `2026-09-17`, central `2026-06-16`). Override at seed time with `SEED_REFERENCE_DATE` in the shell or repo root `.env`.

See `tooling/fixtures/src/meta/entity-manifest.ts` for entity coverage status.

### Demo login

In local dev, the webapp `/login` page signs into the identity service with the demo credentials.

## Identity emails

OTP and signup-verification delivery is owned by the unified API's identity module (`apps/api/src/identity`). The school notification cron handles school-domain notifications only. See [cron-runtimes.md](./cron-runtimes.md).

To send authentication emails from the local server, put the account ID / sender in `config.local.jsonc` and only the API token in `.env` (or the file selected by `EDAYA_LOCAL_ENV_FILE`). The following shows the combined settings:

```dotenv
CLOUDFLARE_EMAIL_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_EMAIL_API_TOKEN=your-email-sending-api-token
EMAIL_FROM=EDAYA <noreply@edayaplus.com>
```

The sender domain must be enabled for Cloudflare Email Sending, and the token must have permission to send email in that account. Local processes use the [Cloudflare REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/); Workers keep their `EMAIL` binding. Process environment values take precedence over the local file. Keep credentials in the gitignored local file or process environment.

With both credentials present, real OTP delivery is automatic in normal captured development. Remove any existing `EMAIL_TRANSPORT=log` setting to enable it; retaining that setting explicitly disables sending. With neither credential, delivery remains omitted locally. Partial credentials produce a configuration warning and disable real delivery. These credentials apply to authentication emails; school notification delivery is unchanged.

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

Before opening a pull request, run `bun run verify`. For integration coverage (package SQL/composition, HTTP routes, seed and native PostgreSQL), also run `bun run test:integration`. Large performance datasets run separately through `bun run test:benchmarks`. See [repo-cli.md](./repo-cli.md) and [test-pyramid-plan.md](../sprints/test-pyramid-plan.md).

| Location | Scope |
|----------|-------|
| `apps/api/tests/` | API unit tests (mocked runtime) |
| `tooling/integration-tests/src/services/` etc. | Integration `api` slice (PGlite) |
| `tooling/integration-tests/src/routes/` etc. | Integration `http` slice |
| `tooling/integration-tests/src/seed/` | Integration `seed` slice (slow; opt-in) |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `bun repo ops seed` times out; `/doc` returns 500 with PGlite file errors | `.data` wiped or corrupted while API was running | Stop the local API, back up the school store, then use the school-only reset procedure above; retain `.data/identity` |
| `POST /auth/edaya/otp/start` fails | Identity database empty or identity service unavailable | Start the unified API on port 9999, then run the full seed |
| Sign-in succeeds but app shows “Session API indisponible” | Identity subject exists but the school actor is not linked | Run the full seed against identity and school |
| `422` on `/core/entities/.../list` during login | Stale API process after schema changes | Restart `bun run repo dev` |
| Webapp shows API unreachable | API not ready on port 9999 | Wait for startup; set `PUBLIC_API_URL` to the school API origin (`http://localhost:9999`) |
| DB browser fails on school tables | API still running (`bun run repo dev`) holds the `.data/school` lock | Stop `bun run repo dev`, then run `bun repo ops db browser school` |

Quick health checks:

```sh
curl -s http://localhost:9999/            # expect {"message":"EDaya Core API"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9999/doc   # expect 200
bun repo ops seed --scope doctor                                                    # health check (sign-in + grants + data)
```

- **Port in use** — Change `PORT` in `apps/api/config.local.jsonc`; update `API_URL` in the webapp `.env` to match.
- **401 after login** — Verify the JWT issuer/audience match `IDENTITY_ISSUER` and `API_ORIGIN`.

## Account authentication

Use `bun run repo dev` for captured local email/WhatsApp/SMS verification. Password and Telegram endpoints are absent. `bun repo ops seed` exercises local OTP; remote staging fixtures use an explicitly generated `SEED_AUTH_SESSIONS_FILE`, never the development OTP endpoint.

See [Account architecture and cutover](../proposals/three-repo-account-auth-architecture.md) for encryption keys, optional TOTP, provider replacement, and launch gates. Identity migrations: `AUTH_DATABASE_URL=... bun repo ops db migrate identity local`. Keep the identity database separate from the school database.

## Test-only OTP access

From the backend checkout run `bun run repo dev`. OTP capture is enabled by default, with `NODE_ENV=development` and the normal persistent school and identity databases. The API binds to loopback when capture is enabled. Set `LOCAL_OTP_CAPTURE=false` to opt out. Configured providers deliver the captured code once; explicit transport opt-outs and phone mode still apply. Capture does not enable phone authentication automatically. Automated CI retains a separate internal testing entrypoint with disposable `EDAYA_TEST_*` settings and offline injected delivery. No `.env` files are rewritten.

Configured OTP providers send the captured challenge once. Delivery failures emit a sanitized warning and leave the local capture usable; revealing or copying a code never resends it. Seeding pauses school background processing, not authentication OTPs. Successful seeding restores the previous background settings; failures leave them paused for inspection using `bun repo ops status local` and explicit `resume scheduler local` / `resume jobs local`.

Start the webapp with `PUBLIC_TEST_OTP_ACCESS=true PUBLIC_API_URL=http://127.0.0.1:9999 bun --filter @edaya/webapp dev` from the web checkout. Start either Flutter app in debug with `flutter run --dart-define=TEST_OTP_ACCESS=true` and a loopback Identity URL. The controls also require successful server capability discovery. Staging is not a testing signal. Normal deployment commands and Flutter profile/release builds exclude access.

Send a code through the normal form, select **Show test code**, optionally **Copy**, and manually enter it before verifying. Reveal creates no message, OTP guess or session. Login and contact linking use the same controls. Codes are transient and clear on replacement, expiry, completion, reset, departure or backgrounding. French and English are supported.

Stop with Ctrl-C: the server clears captured codes and closes its database. The optional CI mailbox (`EDAYA_TEST_OTP_FILE`, permissions 0600), clock (`EDAYA_TEST_CLOCK_FILE`) and privileged policy (`EDAYA_TEST_POLICY_FILE`) remain private fixtures; delete mailbox files after shutdown and never upload them. The integration supervisor uses disposable configuration and cleans private fixtures when the child command ends.

Only the testing entry exposes `GET /auth/edaya/testing/capabilities` and `POST /auth/edaya/testing/otp` with `{challenge}`. Both return `Cache-Control: no-store`; pending challenges only, with original recent session authorization for linking. The normal application returns 404 for these routes and the removed `/auth/edaya/dev/last-otp` route in every environment. No migration or hosted testing deployment is required.

For a complete disposable school/Identity/files stack, run `bun run repo ci fixture /absolute/consumer/path -- <command> [arguments]` from the acquired backend checkout. The supervisor starts owned services, injects their configuration into the command, and removes private files and processes on success, failure, or cancellation. Set `EDAYA_FIXTURE_SEED=true` to prepare the complete demo fixture. Ports can be selected with `EDAYA_CI_API_PORT` and `EDAYA_CI_FILES_PORT`. Frontend `bun run repo test integration` and mobile `dart run edaya_repo:repo ci integration` acquire their service inputs from the already prepared client record and manage this lifecycle automatically. Never upload private mailbox files or disposable environment files.

### Teacher quick login

Local staff with access-control management can generate a code in the linked teacher’s account section. The loopback development launcher exposes **Show code** when local OTP capture is enabled and both databases are local. A restart clears the reveal buffer. Generate a replacement to see it again. Local capture supports email testing without a provider. SMS requires a configured route.

Teacher quick-code issuance is enabled by default in all environments. Set `TEACHER_QUICK_LOGIN_ENABLED=false` to disable staff issuance. For a hosted release, apply Account migration `0003_teacher_quick_codes` before deploying the matching API and clients. Code reveal is available only on the loopback development launcher with local capture enabled.

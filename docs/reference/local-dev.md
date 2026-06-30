# Local development

Run the API and webapp together on your machine. The webapp is a **static SPA** (`ssr = false`) that calls the API from the browser via `@edaya/api-client`. In dev, Vite proxies `/core`, `/auth`, `/doc`, and `/reference` to the API so cookies and CORS work without extra setup.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (repo `packageManager`: `bun@1.3.14`)
- From the repo root: `bun install`

## First-time setup

```sh
# API — persisted PGlite + auth SQLite under repo-root .data/
cp apps/api/.env.example apps/api/.env

# Webapp — Vite proxy target + optional production API URL
cp apps/webapp/.env.example apps/webapp/.env
```

## Start both apps

From the repo root:

```sh
bun dev
```

Or in separate terminals:

```sh
# Terminal 1 — API on http://localhost:9999
cd apps/api && bun dev

# Terminal 2 — Webapp on http://localhost:5173
cd apps/webapp && bun dev
```

## URLs

| Service | URL |
|---------|-----|
| Webapp | http://localhost:5173 |
| API | http://localhost:9999 |
| OpenAPI reference | http://localhost:9999/reference |
| GraphiQL (entity API) | http://localhost:9999/graphiql |

## How the webapp reaches the API

- **Browser client** — `$lib/api/school-client.ts` wraps `@edaya/api-client` with `createBrowserTransport()`. Requests use `credentials: 'include'` for Better Auth session cookies and send `X-Academic-Year-Id` from shell context.
- **API base URL** — `PUBLIC_API_URL` in `apps/webapp/.env`. Leave **empty** in local dev so requests are same-origin (`/core/...`, `/auth/...`). Set to the API origin in production builds (e.g. `https://api.edaya.softilab.dev`).
- **Vite proxy (dev)** — `vite.config.ts` forwards `/core`, `/auth`, `/doc`, `/reference`, `/graphql`, and `/graphiql` to `API_URL` (default `http://localhost:9999`).
- **Bootstrap** — `bootstrapSession()` loads Better Auth session + `/core/authorization/effective-grants` on app start. List/read data flows through `$lib/api/*-data.ts` and `$lib/queries/*`.

See [webapp-migration-plan.md](../sprints/done/webapp-migration-plan.md) for the completed mock → API migration.

## API runtimes

The API uses explicit **profiles** (`local`, `in-memory`, `worker`). Local dev runs the `local` profile (`RUNTIME=local` in `apps/api/.env`, default).

| Profile | Command | School DB | Auth DB |
|---------|---------|-----------|---------|
| **local** | `cd apps/api && bun dev` | PGlite `.data/school` (default) or Postgres | SQLite `.data/auth.sqlite` |
| **worker** | `cd apps/api && bun run dev:worker` | Postgres via Hyperdrive | D1 |

Tests use `RUNTIME=in-memory` programmatically (ephemeral PGlite + `:memory:` auth). Workers use `wrangler.toml` + `.dev.vars` instead of dotenv. See [api-runtimes.md](./api-runtimes.md).

## API database options (local profile)

Set `RUNTIME=local` (default). Override `DATABASE_URL` only when you need Postgres instead of PGlite:

| `DATABASE_URL` | Use case |
|----------------|----------|
| `pglite:.data/school` | Default local dev — PGlite persisted under repo-root `.data/` (gitignored) |
| `postgres://…` | Real Postgres (Docker, Neon); set `RUN_MIGRATIONS_ON_STARTUP=true` on first boot |

Auth uses SQLite at `AUTH_DATABASE_PATH` (default `.data/auth.sqlite`), also under repo-root `.data/`.

## File storage (R2)

Local `bun dev` uses the same `@edaya/adaptor-r2` presigned-URL flow as staging and production when R2 credentials are present. No Worker R2 bindings and no `wrangler dev` required.

1. Create the dev bucket once: `wrangler r2 bucket create edaya-files-dev`
2. Create an R2 API token (Object Read & Write) in the Cloudflare dashboard
3. Add to `apps/api/.dev.vars` (shared with `wrangler dev`):

```env
R2_BUCKET_NAME=edaya-files-dev
R2_ENDPOINT=https://<jurisdiction-host>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
# Optional — your Cloudflare account id from the dashboard; may differ from the endpoint hostname
R2_ACCOUNT_ID=...
```

`R2_ENDPOINT` is the jurisdiction-specific S3 API URL from the R2 dashboard and is used for all presigned uploads/downloads. It does **not** need to share the same id as `R2_ACCOUNT_ID`. When `R2_ENDPOINT` is unset, the API falls back to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.

`bun dev` loads `.env` then `.dev.vars` automatically. On startup you should see `Using R2 file storage` in API logs.

Without R2 credentials, local dev uses in-memory file storage (uploads do not persist across restarts).

### R2 TLS troubleshooting

Quick credential test (loads `apps/api/.dev.vars`, prints a `curl` PUT, runs it, then cleans up):

```sh
bun run test:r2
# print curl only, without running it:
bun run test:r2 -- --curl-only
```

Verify your account endpoint:

```sh
curl -I "$R2_ENDPOINT"
# or, when R2_ENDPOINT is unset:
curl -I "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
```

| Result | Meaning |
|--------|---------|
| HTTP response (any status) | TLS is provisioned — R2 presigned uploads should work |
| `SSL alert handshake failure` or connection refused | Account-scoped TLS not provisioned yet — wait or contact Cloudflare support |

Profile photos and uploads use `/core/files/{attachmentId}/content`.

The webapp uploads directly to R2 presigned URLs from the browser. Configure bucket CORS once per bucket (allows `http://localhost:5173` by default, plus any origins in `TRUSTED_ORIGINS`):

```sh
bun run configure:r2-cors
```

Uses `wrangler r2 bucket cors set` when you are logged in (`wrangler login`); falls back to the S3 API with your R2 token. Re-run after adding staging/production app URLs to `TRUSTED_ORIGINS`.

## Browse local database tables

Plain HTTP browser — no extra setup.

```sh
# School data (students, announcements, etc.) — stop `bun dev` first
bun db:browser:school

# Better Auth users/sessions — can run while the API is up
bun db:browser:auth
```

Opens automatically at `http://127.0.0.1:8191` (auth) or `http://127.0.0.1:8192` (school).

| Symptom | Fix |
|---------|-----|
| School browser fails to open PGlite | Stop `bun dev` first — the API holds the lock on `.data/school` |
| Only auth tables visible | You ran `db:browser:auth` — use `db:browser:school` for school entities |

## Dev database seed

Seeding is **HTTP-only** via `@edaya/seeding` — seed logic lives in `tooling/seeding/`. School data persists under repo-root `.data/` when using `DATABASE_URL=pglite:.data/school`.

### Fresh clone or after wiping `.data/`

**Order matters.** Never delete `.data` while `bun dev` is running — open PGlite/SQLite handles will corrupt the files.

```sh
# 1. Stop bun dev (Ctrl+C)

# 2. Wipe local databases
rm -rf .data

# 3. Start API + webapp
bun dev          # terminal 1 — wait until http://localhost:9999/ returns 200

# 4. Seed through HTTP (terminal 2)
bun seed:init
```

`bun seed:init` and `bun seed` run the same full HTTP seed. On a fresh database the flow is:

1. Provision Better Auth users (`/auth/sign-up`)
2. Sign in and call `POST /core/onboarding/register-school` when no school exists yet
3. Seed access roles, provision the seeding service account with the school profile API key
4. Load demo school data through `/core/*` routes

**Credentials:** seeding uses the `seedingApiKey` from the school profile in `@edaya/dev-fixtures` — no `.env` API key required. For GraphiQL Bearer auto-injection, set `GRAPHQL_DEV_API_KEY` to the same profile key.

| Command | Purpose |
|---------|---------|
| `bun seed:init` | Alias for `bun seed` — full HTTP demo seed (use after fresh clone or `rm -rf .data`) |
| `bun seed` | Full demo data via HTTP |
| `bun seed:auth` | Better Auth accounts only |
| `bun seed:auth:link` | Re-link Better Auth users to seeded staff/guardian records |
| `bun seed:smoke` | Sign in + verify `/core/authorization/effective-grants` |
| `bun seed:validate` | Manifest entity counts + dashboard queries via HTTP |
| `bun seed:remote` | Full seed against `SEED_API_URL` (staging / remote API) |

**Staging:** see [deploy-staging.md](./deploy-staging.md).

Fixture data lives in `tooling/fixtures/`. Loaders and orchestration live in `tooling/seeding/`.

**Reference date:** rolling dashboard data anchors to `SEED_REFERENCE_DATE` in `tooling/fixtures/src/dates.ts` (default `2026-06-16`). Override at seed time in `apps/api/.env` or `tooling/seeding/.env`.

See `tooling/fixtures/src/seed-entity-manifest.ts` for entity coverage status.

### Demo login

In local dev, the webapp `/login` page loads demo picker accounts from `@edaya/dev-fixtures/demo-login`. Sign-in uses Better Auth with password `DevPassword1!`.

## Auth emails (OTP + signup verification)

Better Auth can send **real emails** when Novu is configured:

1. Set `NOVU_SECRET_KEY` (and optional `NOVU_API_URL`) in `apps/api/.env` or `.dev.vars`
2. Configure an email integration in the Novu dashboard (e.g. Custom SMTP)
3. Apply Novu workflows (includes `auth.otp` and `auth.email_verification`):

```sh
bun novu:bootstrap:apply
```

| Mode | `NOVU_SECRET_KEY` | OTP sign-in | Signup verification |
|------|-------------------|-------------|---------------------|
| Dev fallback | unset | OTP logged in API console | not required |
| Real email | set | Novu email | required before password sign-in |

When Novu is set, `REQUIRE_EMAIL_VERIFICATION` defaults to **true** (override with `REQUIRE_EMAIL_VERIFICATION=false`). OTP and verification links are still logged in the API console in development unless `AUTH_EMAIL_LOG_OTP=false`.

**Quick test:** use login **OTP email** on `/login` with your real address, or sign up (Phase 1 UI) once available — you should receive the message in your inbox.

## Testing

Use package-scoped commands for fast local feedback:

```sh
bun --filter @edaya/core lint
bun --filter @edaya/core check
bun --filter @edaya/core test

bun --filter @edaya/webapp lint
bun --filter @edaya/webapp check
bun --filter @edaya/webapp test
```

Before opening a pull request, run `bun run verify`.

| Location | Scope |
|----------|-------|
| `apps/api/tests/` | API unit tests (mocked runtime) |
| `tooling/integration-tests/src/seed/` | Seed verification (requires seeded DB) |
| `tooling/integration-tests/src/routes/` | Route integration tests |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `seed:init` times out; `/doc` returns 500 with PGlite file errors | `.data` wiped or corrupted while API was running | Stop `bun dev`, `rm -rf .data`, restart, `bun seed:init` |
| `POST /auth/sign-in/email` → 401 `Invalid email or password` | Auth DB empty (seed not run after wipe) | Run `bun seed:init` while API is up |
| Sign-in succeeds but app shows “Session API indisponible” | Auth user exists but staff actor is not linked | `rm -rf .data` + full reseed, or `bun seed:auth:link` |
| `422` on `/core/entities/.../list` during login | Stale API process after schema changes | Restart `bun dev` |
| Webapp shows API unreachable | API not ready on port 9999 | Wait for startup; leave `PUBLIC_API_URL` empty in dev |
| `SQLiteError: disk I/O error` on auth | API still running during a wipe | Stop API before `rm -rf .data`, then restart |
| DB browser fails on school tables | API still running (`bun dev`) holds the `.data/school` lock | Stop `bun dev`, then run `bun db:browser:school` |

Quick health checks:

```sh
curl -s http://localhost:9999/            # expect {"message":"Edaya Core API"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9999/doc   # expect 200
sqlite3 .data/auth.sqlite 'select count(*) from user;'               # expect 27 after seed
bun seed:smoke                                                       # sign-in + effective-grants
```

- **Port in use** — Change `PORT` in `apps/api/.env`; update `API_URL` in the webapp `.env` to match.
- **401 after login** — Verify `BETTER_AUTH_URL` matches the API origin and `TRUSTED_ORIGINS` includes `http://localhost:5173`.

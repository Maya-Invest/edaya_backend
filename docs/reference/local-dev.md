# Local development

Run the **Edaya Core API** on your machine. Web frontends (`@edaya/webapp`, `@edaya/webadmin`) live in the sibling **[edaya_web](../../edaya_web/README.MD)** repo.

The webapp is a **static SPA** (`ssr = false`) that calls the API from the browser via `@maya-invest/edaya-api-client`. Identity login targets the sibling identity service; school requests carry its access JWT as a Bearer token.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (repo `packageManager`: `bun@1.3.14`)
- **edaya_identity** checked out as a sibling directory, then `bun install` in both repositories
- **edaya_web** checked out as a sibling directory for the webapp UI

## First-time setup

```sh
# API — persisted school PGlite under repo-root `.data/`
cp apps/api/.env.example apps/api/.env

# Ops & seeding (remote URLs, Neon connection strings, smoke credentials)
cp .env.example .env

# Webapp — in edaya_web
cd ../edaya_web
cp apps/webapp/.env.example apps/webapp/.env
```

## Start identity + API + webapp

```sh
# Terminal 1 — Identity on http://localhost:9900 (from edaya_identity/)
cd edaya_identity && bun repo dev

# Terminal 2 — School API on http://localhost:9999, files on :9200 (from edaya_backend/)
cd edaya_backend && bun repo dev

# Terminal 3 — Webapp on http://localhost:5173 (from edaya_web/)
cd edaya_web && bun --filter @edaya/webapp dev
```

## URLs

| Service | URL |
|---------|-----|
| Webapp | http://localhost:5173 |
| School API | http://localhost:9999 |
| Central Identity | http://localhost:9900 |
| OpenAPI reference | http://localhost:9999/reference |
| GraphiQL (entity API) | http://localhost:9999/graphiql |

## How the webapp reaches the API

- **Browser client** — Identity login runs against `PUBLIC_AUTH_URL` (`http://localhost:9900`); school requests use the returned Bearer JWT and never use identity cookies.
- **API base URL** — `PUBLIC_API_URL` targets the school API (`http://localhost:9999` locally).
- **Bootstrap** — The webapp obtains an identity access token, then loads `/core/authorization/effective-grants`.

See [webapp-migration-plan.md](../sprints/archive/webapp-migration-plan.md) for the completed mock → API migration (edaya_web).

## API runtimes

The API uses explicit **profiles** (`local`, `in-memory`, `worker`). See [runtime-boundaries.md](./runtime-boundaries.md) for the adapter contract.

| Profile | Command | School DB |
|---------|---------|-----------|
| **local** | `bun repo dev` | PGlite `.data/school` |
| **worker** | `bun --filter @edaya/api dev:worker` | Postgres via school Hyperdrive |

Central Identity is a separate process/Worker with its own database. Tests use `RUNTIME=in-memory` programmatically (ephemeral school PGlite). Workers use `wrangler.jsonc` + `.dev.vars` (not loaded by `bun repo dev`). See [api-runtimes.md](./api-runtimes.md).

## API database (local profile)

`RUNTIME=local` uses `DATABASE_URL=pglite:.data/school`. Identity runs separately on port 9900 with its own database.

## File storage (local dev)

`bun repo dev` starts the API and **`@edaya/local-files-server`** together. Uploads persist under repo-root `.data/files/` (gitignored).

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
| **File storage** | `@edaya/local-files-server` (:9200) | R2 `edaya-files-staging` | R2 `edaya-files-production` |
| **Notify** | In-process `@edaya/adaptor-notify` (`EMAIL_TRANSPORT=log`) | Unset `NOVU_SECRET_KEY`; Cloudflare Email + optional FCM on the API Worker | Same as staging |
| **Documents** | In-process `@edaya/adaptor-docs` (stub, or Gotenberg if `GOTENBERG_URL`) | API Worker `BROWSER` binding (Browser Run); optional `GOTENBERG_URL` for `wrangler dev` | Same as staging |
| **Novu** | Unused unless `NOVU_SECRET_KEY` is set | Unused after notify smoke | Unused after notify smoke |
| **Identity directory** | `IDENTITY_DIRECTORY_SECRET` in `.env` | Wrangler secret | Wrangler secret |

**Wrangler secret templates** (from `apps/api/`):

```sh
cp secrets.json.example secrets.staging.json   # fill staging R2 + dev Novu
cp secrets.json.example secrets.prod.json         # fill production R2 + prod Novu
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

Seeding targets both local deployments: identity at `http://localhost:9900` and the school API at `http://localhost:9999`. Each service owns its database. After starting both, run `bun repo seed` in another terminal to load demo data.

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

**Reference date:** rolling dashboard data anchors to `SEED_REFERENCE_DATE` in `tooling/fixtures/src/meta/dates.ts` (default `2026-06-16`). Override at seed time in `apps/api/.env` or repo root `.env`.

See `tooling/fixtures/src/meta/entity-manifest.ts` for entity coverage status.

### Demo login

In local dev, the webapp `/login` page signs into the identity service with the demo credentials.

## Identity emails

OTP and signup-verification delivery is owned by `edaya_identity`, not the school Worker.
Configure and inspect authentication email delivery in the identity repository. The school notification cron handles school-domain notifications only. See [cron-runtimes.md](./cron-runtimes.md).

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

Webapp tests run from **edaya_web** (`bun --filter @edaya/webapp test`).

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
| `POST /auth/sign-in/email` → 401 `Invalid email or password` | Identity database empty or identity service unavailable | Start `edaya_identity` on port 9900, then run the full seed |
| Sign-in succeeds but app shows “Session API indisponible” | Identity subject exists but the school actor is not linked | Run the full seed against identity and school |
| `422` on `/core/entities/.../list` during login | Stale API process after schema changes | Restart `bun repo dev` |
| Webapp shows API unreachable | API not ready on port 9999 | Wait for startup; leave `PUBLIC_API_URL` empty in dev |
| DB browser fails on school tables | API still running (`bun repo dev`) holds the `.data/school` lock | Stop `bun repo dev`, then run `bun repo db browser school` |

Quick health checks:

```sh
curl -s http://localhost:9999/            # expect {"message":"Edaya Core API"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9999/doc   # expect 200
bun repo seed --scope doctor                                                    # health check (sign-in + grants + data)
```

- **Port in use** — Change `PORT` in `apps/api/.env`; update `API_URL` in the webapp `.env` to match.
- **401 after login** — Verify the JWT issuer/audience match `IDENTITY_ISSUER` and `SCHOOL_API_ORIGIN`.

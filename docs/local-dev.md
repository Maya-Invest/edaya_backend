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

The API runs on **Node** locally (`bun dev`) and is also packaged for **Cloudflare Workers** (`bun run dev:worker` in `apps/api`). Workers use `wrangler.toml` + `.dev.vars` instead of dotenv. See [api-runtimes.md](./api-runtimes.md).

## API database options

| `DATABASE_URL` | Use case |
|----------------|----------|
| `pglite:.data/school` | Default local dev — PGlite persisted under repo-root `.data/` (gitignored) |
| `pglite` | Ephemeral in-memory Postgres (tests, CI) |
| `postgres://…` | Real Postgres (Docker, Neon, staging) |

Auth uses SQLite at `AUTH_DATABASE_PATH` (default `.data/auth.sqlite`), also under repo-root `.data/`.

## Dev database seed

Seeding is **HTTP-only** via `@edaya/seeding` — seed logic lives in `testing/seeding/`. School data persists under repo-root `.data/` when using `DATABASE_URL=pglite:.data/school`; seed once after a fresh clone or `rm -rf .data`.

| Command | Purpose |
|---------|---------|
| `bun seed:init` | Wait for API, then full HTTP seed (`auth` → `school` → `access`), then provision seeding service account |
| `bun seed` | Same as `seed:all` — full demo data via HTTP |
| `bun seed:auth` | Better Auth accounts; also re-links staff/guardians when school data exists |
| `bun seed:auth:link` | Re-link Better Auth users to seeded staff/guardian records only |
| `bun seed:smoke` | Sign in + verify `/core/authorization/effective-grants` |
| `bun seed:validate` | List all manifest-seeded entities + dashboard queries via HTTP; fails if counts are below fixture minimums |
| `bun seed:remote` | Full seed against `SEED_API_URL` (staging / remote API) |

**Staging:** see [deploy-staging.md](./deploy-staging.md) for isolated Cloudflare deploy, bootstrap, and `bun run smoke:staging`.

**Credentials:** seeding uses the `seedingApiKey` from the school profile in `@edaya/dev-fixtures` — no `.env` entry required for the default school. Override with `SERVICE_ACCOUNT_API_KEY` in `apps/api/.env` when you need a custom key (e.g. staging or after key rotation).

```sh
# Terminal 1
bun dev

# Terminal 2 — first time or after wiping .data/
bun seed:init
```

Fixture data lives in `testing/dev-fixtures/`. Loaders and orchestration live in `testing/seeding/`.

**Reference date:** rolling dashboard data (today's attendance, upcoming events, fee due dates) anchors to `SEED_REFERENCE_DATE` in `testing/dev-fixtures/src/dates.ts` (default `2026-06-16`). Override at seed time with `SEED_REFERENCE_DATE=YYYY-MM-DD` in `apps/api/.env` or `testing/seeding/.env`.

**Re-seed after a DB wipe:**

```sh
# Stop bun dev first — wiping .data while the API is running breaks the open SQLite/PGlite handles
rm -rf .data
bun dev          # terminal 1 — recreates .data/auth.sqlite and .data/school
bun seed:init    # terminal 2
```

If auth returns 500 (`SQLiteError: disk I/O error`) after a wipe, restart the API — do not wipe again without stopping it first.

See `testing/dev-fixtures/src/seed-entity-manifest.ts` for entity coverage status.
Staff auth linking and school owner assignment (Koussi Yann / `st8`) run automatically during **school** and **access** seed — no separate `auth:link` step.

### Demo login

In local dev, the webapp `/login` page loads demo picker accounts from `@edaya/dev-fixtures/demo-login` (derived from `DEV_AUTH_STAFF_ACCOUNTS` + access roles) — no API route. Sign-in still uses Better Auth. Authenticated users without a school can register one via `POST /core/onboarding/register-school` (`ALLOW_PUBLIC_SCHOOL_REGISTRATION` defaults on in development).

## Testing

| Location | Scope |
|----------|-------|
| `apps/api/tests/` | API unit tests (mocked runtime) |
| `testing/integration-tests/src/seed/` | Seed verification (requires seeded DB) |
| `testing/integration-tests/src/routes/` | Route integration tests |

## Troubleshooting

- **API won't start** — Ensure `apps/api/.env` exists and `DATABASE_URL` is set.
- **Webapp shows API unreachable** — Confirm the API is running on port 9999. In dev, leave `PUBLIC_API_URL` empty and check the Vite proxy target (`API_URL` in `apps/webapp/.env`, default `http://localhost:9999`).
- **401 after login** — Usually the auth user is not linked to a staff record. Run `bun seed:auth:link` (or `bun seed:init` after wiping `.data/`). Also verify `BETTER_AUTH_URL` matches the API origin and `TRUSTED_ORIGINS` includes `http://localhost:5173`.
- **Port in use** — Change `PORT` in `apps/api/.env`; update `API_URL` in the webapp `.env` to match.

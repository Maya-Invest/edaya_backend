# Local development

Run the API and webapp together on your machine. The webapp is a **static SPA** (`ssr = false`) that calls the API from the browser via `@edaya/api-client`. In dev, Vite proxies `/core`, `/auth`, `/doc`, and `/reference` to the API so cookies and CORS work without extra setup.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (repo `packageManager`: `bun@1.3.14`)
- From the repo root: `bun install`

## First-time setup

```sh
# API — persisted PGlite + auth SQLite under apps/api/.data/
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

## How the webapp reaches the API

- **Browser client** — `$lib/api/school-client.ts` wraps `@edaya/api-client` with `createBrowserTransport()`. Requests use `credentials: 'include'` for Better Auth session cookies and send `X-Academic-Year-Id` from shell context.
- **API base URL** — `PUBLIC_API_URL` in `apps/webapp/.env`. Leave **empty** in local dev so requests are same-origin (`/core/...`, `/auth/...`). Set to the API origin in production builds (e.g. `https://api.edaya.softilab.dev`).
- **Vite proxy (dev)** — `vite.config.ts` forwards `/core`, `/auth`, `/doc`, and `/reference` to `API_URL` (default `http://localhost:9999`).
- **Bootstrap** — `bootstrapSession()` loads Better Auth session + `/core/authorization/effective-grants` on app start. List/read data flows through `$lib/api/*-data.ts` and `$lib/queries/*`.

See [webapp-migration-plan.md](../sprints/done/webapp-migration-plan.md) for the completed mock → API migration.

## API runtimes

The API runs on **Node** locally (`bun dev`) and is also packaged for **Cloudflare Workers** (`bun run dev:worker` in `apps/api`). Workers use `wrangler.toml` + `.dev.vars` instead of dotenv. See [api-runtimes.md](./api-runtimes.md).

## API database options

| `DATABASE_URL` | Use case |
|----------------|----------|
| `pglite:.data/school` | Default local dev — PGlite persisted under `apps/api/.data/` (gitignored) |
| `pglite` | Ephemeral in-memory Postgres (tests, CI) |
| `postgres://…` | Real Postgres (Docker, Neon, staging) |

Auth uses SQLite at `AUTH_DATABASE_PATH` (default `.data/auth.sqlite`), also under `.data/`.

## Dev database seed

Seeding is **HTTP-only** via `@edaya/seeding` — the API exposes system routes; seed logic lives in `testing/seeding/`. School data persists under `.data/` when using `DATABASE_URL=pglite:.data/school`; seed once after a fresh clone or `rm -rf apps/api/.data`.

| Command | Purpose |
|---------|---------|
| `bun seed:init` | Wait for API, then full HTTP seed (`auth` → `school` → `auth:link` → `access`) |
| `bun seed` | Same as `seed:all` — full demo data via HTTP + system actor |
| `bun seed:auth` | Better Auth accounts only (no `SYSTEM_ACTOR_SECRET`) |
| `bun seed:smoke` | Sign in + verify `/core/authorization/effective-grants` |
| `bun seed:remote` | Full seed against `SEED_API_URL` (staging / remote API) |

Requires `SYSTEM_ACTOR_SECRET=dev-system-secret` in `apps/api/.env` (must match the running API) for all scopes except `auth`.

```sh
# Terminal 1
bun dev

# Terminal 2 — first time or after wiping .data/
bun seed:init
```

Fixture data lives in `testing/dev-fixtures/`. Loaders and orchestration live in `testing/seeding/`.

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
- **401 after login** — Verify `BETTER_AUTH_URL` matches the API origin and `TRUSTED_ORIGINS` includes `http://localhost:5173`.
- **Port in use** — Change `PORT` in `apps/api/.env`; update `API_URL` in the webapp `.env` to match.

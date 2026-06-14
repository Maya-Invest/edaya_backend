# Local development

Run the API and webapp together on your machine. The webapp talks to the API through a server-side client (`API_URL`) and, in dev, a Vite proxy for browser requests under `/api`.

## Prerequisites

- [Bun](https://bun.sh) 1.2+ (repo `packageManager`)
- From the repo root: `bun install`

## First-time setup

```sh
# API — persisted PGlite + auth SQLite under apps/api/.data/
cp apps/api/.env.example apps/api/.env

# Webapp — points SSR / server handlers at the local API
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

- **SSR / server code** — `src/lib/server/api-client.ts` calls `API_URL` (default `http://localhost:9999`).
- **Browser (dev)** — Vite proxies `/api`, `/doc`, and `/reference` to the API so same-origin requests work without extra CORS setup.
- **Data** — UI pages still use local mocks today; see [webapp-api-integration-plan.md](./webapp-api-integration-plan.md) for wiring entity loaders to the API.

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

Seeding is **HTTP-only** via `@edaya/seeding` — the API has no seed logic. School data persists under `.data/` when using `DATABASE_URL=pglite:.data/school`; seed once after a fresh clone or `rm -rf apps/api/.data`.

| Command | Purpose |
|---------|---------|
| `bun seed:init` | Wait for API, then full HTTP seed (`auth` → `school` → `auth:link` → `access`) |
| `bun seed` | Same as `seed:all` — full demo data via HTTP + system actor |
| `bun seed:auth` | Better Auth accounts only (no `SYSTEM_ACTOR_SECRET`) |
| `bun seed:smoke` | Sign in + verify `/core/authorization/effective-grants` |
| `bun seed:remote` | Full seed against `SEED_API_URL` (staging) |

Requires `SYSTEM_ACTOR_SECRET=dev-system-secret` in `apps/api/.env` (must match the running API) for all scopes except `auth`.

```sh
# Terminal 1
bun dev

# Terminal 2 — first time or after wiping .data/
bun seed:init
```

Fixture data lives in `testing/dev-fixtures/`. Loaders and orchestration live in `testing/seeding/`.

Seed and route integration tests (require seeded DB) live in `testing/integration-tests/src/seed/` and `src/routes/`. API unit tests in `apps/api/tests/` use mocks only.

## Troubleshooting

- **API won't start** — Ensure `apps/api/.env` exists and `DATABASE_URL` is set.
- **Webapp shows API unreachable** — Confirm the API is running on port 9999 and `apps/webapp/.env` has `API_URL=http://localhost:9999`.
- **Port in use** — Change `PORT` in `apps/api/.env` and update `API_URL` in the webapp `.env` to match.

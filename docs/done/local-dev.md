# Local development

Run the API and webapp together on your machine. The webapp talks to the API through a server-side client (`API_URL`) and, in dev, a Vite proxy for browser requests under `/api`.

## Prerequisites

- [Bun](https://bun.sh) 1.2+ (repo `packageManager`)
- From the repo root: `bun install`

## First-time setup

```sh
# API — in-memory Postgres, no Docker required
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
| `pglite` | Default local dev — ephemeral in-memory Postgres |
| `postgres://…` | Persistent data (e.g. local Postgres on port 5432) |

## Dev database seed

With `DATABASE_URL=pglite`, the API **auto-seeds on startup** in development (school, year, classes, staff, students, guardians). IDs match the webapp mocks in `apps/webapp/src/lib/data/school.ts` for future API wiring.

| Command | Purpose |
|---------|---------|
| `bun seed` (repo root) | Run seed manually |
| `cd apps/api && bun run seed` | Same, API package only |

Fixture data lives in `testing/dev-fixtures/`. API seed orchestration stays in `apps/api/src/lib/seed/`. Extend the fixtures package and `run-dev-seed.ts` as you connect more pages to the API.

| Env | Behavior |
|-----|----------|
| `SEED_ON_START=true` | Always seed on API startup (skips if data exists) |
| `SEED_ON_START=false` | Never auto-seed |
| *(unset)* + `pglite` in dev | Auto-seed on startup |

With persistent Postgres, auto-seed is off by default — run `bun seed` once after creating the database.

## Troubleshooting

- **API won't start** — Ensure `apps/api/.env` exists and `DATABASE_URL` is set.
- **Webapp shows API unreachable** — Confirm the API is running on port 9999 and `apps/webapp/.env` has `API_URL=http://localhost:9999`.
- **Port in use** — Change `PORT` in `apps/api/.env` and update `API_URL` in the webapp `.env` to match.

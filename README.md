# Edaya Core

Monorepo for the Edaya platform: a **Hono API** (`apps/api`), a **SvelteKit webapp** (`apps/webapp`), shared **domain core** (`packages/core`), portable persistence adaptors, platform **integrations**, and a generated **API client**.

Built with [Bun](https://bun.sh) workspaces and [Turborepo](https://turbo.build).

## Monorepo layout

```text
maya_school_core/
├── apps/
│   ├── api/                              @edaya/api — Hono API (Node + Cloudflare Worker)
│   └── webapp/                           @edaya/webapp — SvelteKit UI (Cloudflare Pages)
├── packages/
│   ├── core/                             @edaya/core — domain, services, ports
│   ├── adaptor-postgres/                 @edaya/adaptor-postgres — school schema, repos, SQL
│   └── api-client/                       @edaya/api-client — typed API SDK
├── integrations/
│   ├── neon-migrations/                  @edaya/neon-migrations — apply school migrations (Neon/Hyperdrive)
│   └── betterauth-d1-migrations/         @edaya/betterauth-d1-migrations — auth schema + D1 deploy
└── testing/
    ├── dev-fixtures/
    ├── seeding/
    └── integration-tests/
```

**Boundary rule:** `packages/*` are vendor-agnostic persistence; `integrations/*` are platform-specific migration/deploy orchestration; Worker host wiring (Hyperdrive, DI, request runtime cache) lives in `apps/api`.

## Solution architecture

The codebase follows a **ports-and-adapters** layout: business rules live in `@edaya/core`; portable Postgres persistence lives in `@edaya/adaptor-postgres`; platform migrations live in `integrations/*`; the API wires runtime and HTTP; the webapp consumes the API through `@edaya/api-client`.

```mermaid
flowchart TB
  subgraph clients["Clients"]
    Webapp["@edaya/webapp<br/>SvelteKit · Cloudflare Pages"]
  end

  subgraph api_layer["API"]
    API["@edaya/api<br/>Hono · Node + Worker"]
    Client["@edaya/api-client"]
    WorkerHost["runtime + http/di<br/>Hyperdrive · DI · request cache"]
  end

  subgraph domain["Domain"]
    Core["@edaya/core"]
  end

  subgraph packages["Packages"]
    PG["@edaya/adaptor-postgres"]
  end

  subgraph integrations["Integrations"]
    Auth["@edaya/betterauth-d1-migrations"]
    NeonM["@edaya/neon-migrations"]
  end

  Webapp --> Client
  Webapp -->|SSR / dev proxy| API
  Client --> API
  API --> WorkerHost
  API --> Core
  API --> PG
  API --> Auth
  Core --> PG
  NeonM --> PG
  NeonM -.->|migrate:all| Auth
  PG --> SchoolDB[(Postgres / PGlite)]
  Auth --> AuthDB[(D1 / SQLite)]
```

### Request flow

1. **Webapp** — Server code calls the API via `API_URL` (`@edaya/api-client`). In dev, Vite proxies `/api`, `/doc`, and `/reference` to the API.
2. **API** — Hono middleware resolves env, session, and a cached runtime (`getApiRuntime`).
3. **Runtime** — Opens the school Postgres DB and auth store (D1 or local SQLite), runs migrations, wires Better Auth, and builds `SchoolApplication` with Postgres repositories.
4. **Core** — `SchoolApplication.forActor(actor)` returns `SchoolService` for commands, queries, and entity CRUD with authorization.

### API runtimes

| Runtime | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **Node** | `apps/api/src/entries/node.ts` | `.env` (dotenv) | `cd apps/api && bun dev` |
| **Worker** | `apps/api/src/entries/worker.ts` | `wrangler.toml` + `.dev.vars` | `cd apps/api && bun run dev:worker` |

Node supports persisted PGlite (`DATABASE_URL=pglite:.data/school`) or in-memory (`pglite`) on Node. Workers require a real Postgres URL.

### API layout

- `apps/api/src/routes/` — OpenAPI route modules (thin HTTP surface)
- `apps/api/src/lib/school-api/` — registry, schemas, dispatch, entity handlers
- `apps/api/src/runtime/` — database, auth, Worker bindings, Hyperdrive, runtime registry
- `apps/api/src/http/` — Hono app, dependency injection middleware
- `packages/core/src/` — domains, entities, authorization, services, ports

More detail: [docs/api-folder-structure.md](./docs/api-folder-structure.md), [docs/api-runtimes.md](./docs/api-runtimes.md).

## Workspace packages

### Apps

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono HTTP API (Node + Cloudflare Workers), OpenAPI, dev seed, Worker host wiring |
| `@edaya/webapp` | `apps/webapp` | SvelteKit UI (Cloudflare Pages adapter) |

### Packages

| Package | Path | Role |
|---------|------|------|
| `@edaya/core` | `packages/core` | Domain model, business services, authorization, repository ports |
| `@edaya/adaptor-postgres` | `packages/adaptor-postgres` | School Drizzle schema, SQL migrations, Postgres repository implementations |
| `@edaya/api-client` | `packages/api-client` | Type-safe client for entities, commands, queries (generated bindings) |

### Integrations

| Package | Path | Role |
|---------|------|------|
| `@edaya/neon-migrations` | `integrations/neon-migrations` | Apply school migrations on Neon / Hyperdrive origin |
| `@edaya/betterauth-d1-migrations` | `integrations/betterauth-d1-migrations` | Better Auth schema, SQL migrations, D1 deploy scripts |

### Testing

| Package | Path | Role |
|---------|------|------|
| `@edaya/dev-fixtures` | `testing/dev-fixtures` | Shared dev seed IDs, fixture records, and minimal seed helpers |
| `@edaya/seeding` | `testing/seeding` | HTTP seed orchestration (`seed:all`, `seed:init`, …) |
| `@edaya/integration-tests` | `testing/integration-tests` | Cross-package integration tests (auth, Postgres, core services) |

## Prerequisites

- [Bun](https://bun.sh) 1.2+ (see `packageManager` in root `package.json`)

## First-time setup

```sh
bun install

cp apps/api/.env.example apps/api/.env
cp apps/webapp/.env.example apps/webapp/.env
```

## Local development

```sh
bun dev
```

| Service | URL |
|---------|-----|
| Webapp | http://localhost:5173 |
| API | http://localhost:9999 |
| OpenAPI reference | http://localhost:9999/reference |

Or run apps separately:

```sh
cd apps/api && bun dev          # Node API
cd apps/webapp && bun dev       # SvelteKit
```

**Worker runtime** (API on Cloudflare):

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
cd apps/api && bun run dev:worker
```

See [docs/local-dev.md](./docs/local-dev.md) for database options, dev seed, troubleshooting, and how the webapp connects to the API.

## Commands

All root scripts run across the monorepo via Turborepo unless noted.

### Development

| Command | Description |
|---------|-------------|
| `bun dev` | Start API + webapp in watch mode |
| `bun seed` | Run all dev seeds via HTTP (`@edaya/seeding seed:all`) |
| `bun run seed:init` | Bootstrap school + auth DBs and run initial seed |
| `bun run seed:auth` | Provision Better Auth user accounts only |
| `bun run seed:smoke` | Minimal smoke seed for quick verification |
| `bun run seed:remote` | Seed a remote API instance |
| `bun run deploy:api:staging` | Deploy API to Cloudflare Workers (staging) |
| `bun run deploy:webapp:staging` | Build + deploy webapp to staging |
| `bun run seed:smoke:staging` | Sign-in + effective-grants smoke against staging URL |
| `cd apps/api && bun dev` | API only (Node, port 9999) |
| `bun run dev:worker` | API only (Cloudflare Worker) |
| `cd apps/webapp && bun dev` | Webapp only (port 5173) |
| `cd apps/webapp && bun run preview` | Preview production build |
| `cd apps/webapp && bun run preview:worker` | Preview webapp on Cloudflare Workers locally |
| `bun run deploy:webapp` | Build and deploy webapp to Cloudflare Workers |
| `cd apps/api && bun start` | Run Node API bundle (`dist/node.js`) |
| `bun run deploy:api` | Deploy API to Cloudflare Workers (production) |

### Database

Root scripts use the `db:*` prefix. Integration packages expose the underlying `migrate:*` scripts (e.g. `bun --filter @edaya/neon-migrations migrate:dev`).

| Command | Description |
|---------|-------------|
| `bun run db:generate` | Generate school schema SQL migrations (`@edaya/adaptor-postgres`) |
| `bun run db:migrate` | Apply school schema migrations (`@edaya/neon-migrations`) |
| `bun run db:migrate:all` | Apply school + local D1 auth migrations (dev bootstrap) |
| `bun run db:migrate:dev` | Load `apps/api/.dev.vars` and migrate Hyperdrive origin + local D1 auth |
| `bun run db:migrate:staging` | Apply school migrations to Neon staging branch (`STAGING_DATABASE_URL`) |
| `bun run db:generate:auth` | Generate auth schema SQL migrations (`@edaya/betterauth-d1-migrations`) |
| `bun run db:migrate:auth` | Apply Better Auth migrations to local D1 |
| `bun run db:migrate:auth:remote` | Apply Better Auth migrations to remote D1 (production) |
| `bun run db:migrate:auth:staging` | Apply Better Auth migrations to remote D1 (staging) |
| `bun run auth:generate-schema` | Regenerate Better Auth Drizzle schema from CLI config |

Package-level extras (run from adaptor package or with `bun --filter`):

| Command | Description |
|---------|-------------|
| `bun --filter @edaya/adaptor-postgres db:push` | Push schema to database (drizzle-kit) |
| `bun --filter @edaya/adaptor-postgres db:studio` | Open Drizzle Studio |
| `bun --filter @edaya/betterauth-d1-migrations db:push` | Push auth schema |
| `bun --filter @edaya/betterauth-d1-migrations db:studio` | Drizzle Studio for auth schema |

### OpenAPI & API client

| Command | Description |
|---------|-------------|
| `bun run openapi:generate` | Export OpenAPI from API → regenerate webapp types + API client bindings |
| `bun run openapi:check` | Regenerate OpenAPI artifacts and fail if committed files drift |
| `bun run check:boundaries` | Verify layer import boundaries (runtime/http, core/integrations) |
| `cd apps/api && bun run export-openapi` | Export OpenAPI JSON only |
| `cd apps/api && bun run generate-api-client` | Regenerate `@edaya/api-client` bindings only |
| `cd apps/webapp && bun run openapi:generate` | Regenerate `schema.d.ts` from local OpenAPI JSON |

### Quality & CI

| Command | Description |
|---------|-------------|
| `bun run lint` | ESLint all packages |
| `bun run lint:fix` | ESLint with auto-fix |
| `bun run check` | TypeScript / Svelte type checks |
| `bun run quality` | `lint` + `check` per package |
| `bun run test` | Unit and integration tests |
| `bun run test:remote` | Integration tests against a real Postgres database |
| `bun run test:coverage` | Tests with coverage (where supported) |
| `bun run build` | Build deployable apps (webapp + API Node bundle) |
| `bun run fullcheck` | `lint:fix` → `check` → `build` → `openapi:check` → `check:boundaries` → `test` |

### Per-package shortcuts

```sh
bun --filter @edaya/core test
bun --filter @edaya/api test
bun --filter @edaya/integration-tests test
bun --filter @edaya/webapp test
bun --filter @edaya/webapp check
bun --filter @edaya/api-client check
```

## Testing

Tests are split by layer. Run everything with `bun run test` (Turbo across all packages that define a `test` script).

| Layer | Package / path | What to test here |
|-------|----------------|-------------------|
| Domain | `packages/core/tests/` | Entities, authorization, service workflows |
| API unit | `apps/api/tests/` | HTTP helpers, runtime, route builders, thin route tests |
| API harness | `apps/api/tests/support/core-route-harness.ts` | Shared PGlite app + auth helpers (also used by integration-tests) |
| Cross-package | `testing/integration-tests/src/` | Seeds, auth flows, PGlite persistence, full route scenarios |
| Webapp mappers | `apps/webapp/src/lib/api/*.test.ts` | OpenAPI → UI type mapping logic |

**Conventions**

- Put pure domain tests in `@edaya/core`.
- Put API transport/runtime tests in `apps/api/tests/`, mirroring `src/` layout (`http/`, `runtime/`, `routes/`, `lib/`).
- Put scenarios that span seeding, auth, and Postgres in `@edaya/integration-tests`.
- Colocate webapp mapper tests next to `*-data.ts` files; they run via `bun --filter @edaya/webapp test`.
- Integration-tests import the canonical route harness from `@api-tests/support/core-route-harness` (resolved to `apps/api/tests/support/`).

## Environment

**API** (`apps/api/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `pglite:.data/school` (persisted dev), `pglite` (in-memory tests), or `postgres://…` |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `BETTER_AUTH_URL` | Public API URL for auth callbacks |
| `TRUSTED_ORIGINS` | CORS / auth origins (e.g. webapp URL) |
| `SERVICE_ACCOUNT_API_KEY` | Optional — `/core/*` HTTP seeding after first `bun seed:init` |

**Webapp** (`apps/webapp/.env`):

| Variable | Purpose |
|----------|---------|
| `API_URL` | Server-side API base URL (SSR, remote handlers) |
| `PUBLIC_API_URL` | Browser-facing API URL |

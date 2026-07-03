# Edaya Core

Monorepo for the Edaya platform backend: a **Hono API** (`apps/api`) with scheduled cron jobs, shared libraries under **`package/`** (domain core, adaptors, integrations, generated API client), and **`tooling/`** harnesses.

Web frontends live in the separate **[edaya_web](../edaya_web)** repo (`@edaya/webapp`, `@edaya/saas-admin`).

Built with [Bun](https://bun.sh) workspaces and [Turborepo](https://turbo.build).

## Monorepo layout

```text
edaya_backend/
├── apps/
│   └── api/                              @edaya/api — Hono API + scheduled cron (Node + Worker)
├── package/
│   ├── domain-core/                      @edaya/core — domain, services, ports
│   ├── adaptor-postgres/                 @edaya/adaptor-postgres — school schema, repos, SQL
│   ├── adaptor-novu/                     @edaya/adaptor-novu — Novu notification gateway
│   ├── adaptor-r2/                       @edaya/adaptor-r2 — R2 file storage adapter
│   ├── adaptor-local-fs/                 @edaya/adaptor-local-fs — local dev file storage adapter
│   ├── adaptor-auth/                     @edaya/adaptor-auth — Better Auth schema + runtime migrations
│   └── generated-api-client/             @edaya/api-client — typed API SDK
└── tooling/
    ├── repo/                             @edaya/repo — CI, OpenAPI codegen, dev tools
    ├── fixtures/                         @edaya/fixtures
    ├── seeding/                          @edaya/seeding
    ├── db-migrate/                       @edaya/db-migrate — school + auth migration CLI
    ├── novu-ops/                         @edaya/novu-ops — Novu bootstrap + subscriber cleanup
    └── integration-tests/                @edaya/integration-tests (+ smoke/)
```

**Boundary rule:** `package/domain-core`, `package/adaptor-postgres`, `package/generated-api-client`, and `package/adaptor-novu` stay vendor-agnostic; `package/adaptor-auth` owns Better Auth persistence; `tooling/db-migrate` owns migration CLI scripts; `tooling/novu-ops` owns Novu bootstrap/cleanup CLI; Worker host wiring (Hyperdrive, DI, request runtime cache) lives in `apps/api`.

## Solution architecture

The codebase follows a **ports-and-adapters** layout: business rules live in `@edaya/core`; portable Postgres persistence lives in `@edaya/adaptor-postgres`; Better Auth persistence lives in `@edaya/adaptor-auth`; migration CLI lives in `@edaya/db-migrate`; the API wires runtime and HTTP. Web clients consume the API through `@edaya/api-client` in **edaya_web**.

```mermaid
flowchart TB
  subgraph clients["Clients (edaya_web)"]
    Webapp["@edaya/webapp<br/>SvelteKit · Cloudflare"]
  end

  subgraph api_layer["API"]
    API["@edaya/api<br/>Hono · Node + Worker"]
    Client["@edaya/api-client"]
    WorkerHost["runtime + http/di<br/>Hyperdrive · DI · request cache"]
  end

  subgraph package["package/"]
    Core["@edaya/core"]
    PG["@edaya/adaptor-postgres"]
    Auth["@edaya/adaptor-auth"]
    DbMigrate["@edaya/db-migrate"]
  end

  Webapp --> Client
  Client -->|Browser HTTP / Vite proxy| API
  API --> WorkerHost
  API --> Core
  API --> PG
  API --> Auth
  PG -.->|implements ports| Core
  DbMigrate --> PG
  DbMigrate --> Auth
  DbMigrate -.->|school:migrate:all| DbMigrate
  PG --> SchoolDB[(Postgres / PGlite)]
  Auth --> AuthDB[(D1 / SQLite)]
```

### Request flow

1. **Web clients** — Static browser SPAs in **edaya_web** call the API through `@edaya/api-client`. In local development, Vite proxies same-origin `/core`, `/auth`, `/doc`, `/reference`, `/graphql`, and `/graphiql` requests to `API_URL`. Production builds use `PUBLIC_API_URL` when the API is not same-origin.
2. **API** — Hono middleware resolves env, session, and a cached runtime (`getApiRuntime`).
3. **Runtime** — Opens the school Postgres DB and auth store (D1 or local SQLite), runs migrations, wires Better Auth, and builds `SchoolApplication` with Postgres repositories.
4. **Core** — `SchoolApplication.forActor(actor)` returns `SchoolService` for commands, queries, and entity CRUD with authorization.

### API runtimes

| Profile | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **local** | `apps/api/src/entries/local.ts` | `.env` (dotenv) | `cd apps/api && bun dev` |
| **in-memory** | tests / harness | programmatic env | `bun test` in `apps/api` |
| **worker** | `apps/api/src/entries/worker.ts` | `wrangler.jsonc` + `.dev.vars` | `bun dev:worker-local` |

`local` uses persisted PGlite by default (`DATABASE_URL=pglite:.data/school`). `in-memory` uses ephemeral PGlite for fast tests. Workers require a real Postgres URL via Hyperdrive.

### API layout

- `apps/api/src/routes/` — OpenAPI route modules (thin HTTP surface)
- `apps/api/src/lib/school-api/` — registry, schemas, dispatch, entity handlers
- `apps/api/src/runtime/` — database, auth, Worker bindings, Hyperdrive, runtime registry
- `apps/api/src/http/` — Hono app, dependency injection middleware
- `package/domain-core/src/` — domains, entities, authorization, services, ports

More detail: [docs/reference/runtime-boundaries.md](./docs/reference/runtime-boundaries.md), [docs/reference/api-runtimes.md](./docs/reference/api-runtimes.md), [docs/reference/cross-repo-workflow.md](./docs/reference/cross-repo-workflow.md).

## Workspace packages

### Apps

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono HTTP API (Node + Cloudflare Workers), OpenAPI, scheduled cron, dev seed, Worker host wiring |

### Package workspace

| Package | Path | Role |
|---------|------|------|
| `@edaya/core` | `package/domain-core` | Domain model, business services, authorization, repository ports |
| `@edaya/adaptor-postgres` | `package/adaptor-postgres` | School Drizzle schema, SQL migrations, Postgres repository implementations |
| `@edaya/adaptor-novu` | `package/adaptor-novu` | Novu Cloud `NotificationGatewayPort` adapter |
| `@edaya/adaptor-auth` | `package/adaptor-auth` | Better Auth Drizzle schema, SQL migrations, runtime `runMigrations()` |
| `@edaya/api-client` | `package/generated-api-client` | Type-safe client for entities, commands, queries (generated bindings) |

### Tooling

| Package | Path | Role |
|---------|------|------|
| `@edaya/repo` | `tooling/repo` | Repo CI, OpenAPI codegen, local dev tools |
| `@edaya/fixtures` | `tooling/fixtures` | Shared dev seed IDs, fixture records, and minimal seed helpers |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed orchestration (`seed:all`, `seed:init`, …) |
| `@edaya/db-migrate` | `tooling/db-migrate` | School + auth migration CLI (Neon / Hyperdrive + D1) |
| `@edaya/novu-ops` | `tooling/novu-ops` | Novu workflow bootstrap + subscriber cleanup CLI |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration tests, staging smoke, Novu smoke |

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (see `packageManager` in root `package.json`)

## First-time setup

```sh
bun install

cp apps/api/.env.example apps/api/.env
```

Web frontends: see **[edaya_web](../edaya_web/README.MD)** (`cp apps/webapp/.env.example apps/webapp/.env` there).

## Local development

```sh
bun dev   # API only
```

| Service | URL |
|---------|-----|
| API | http://localhost:9999 |
| OpenAPI reference | http://localhost:9999/reference |

Webapp (port 5173) runs from **edaya_web** — see [edaya_web README](../edaya_web/README.MD).

Or run the API alone:

```sh
cd apps/api && bun dev          # Node API
```

**Worker runtime** (API on Cloudflare):

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun dev:worker-local
```

See [docs/reference/local-dev.md](./docs/reference/local-dev.md) for database options, dev seed, and troubleshooting.

## Commands

All root scripts run across the monorepo via Turborepo unless noted.

### Development

| Command | Description |
|---------|-------------|
| `bun dev` | Start API in watch mode |
| `bun seed` | Run all dev seeds via HTTP (`@edaya/seeding seed:all`) |
| `bun run seed:init` | Alias for `bun seed` — full HTTP demo seed (fresh clone / after `rm -rf .data`) |
| `bun run seed:auth` | Provision Better Auth user accounts only |
| `bun run seed:smoke` | Minimal smoke seed for quick verification |
| `bun run seed:remote` | Seed a remote API instance |
| `bun run deploy:api:staging` | Deploy API to Cloudflare Workers (staging) |
| `bun run seed:smoke:staging` | Sign-in + effective-grants smoke against staging URL |
| `cd apps/api && bun dev` | API only (Node, port 9999) |
| `bun dev:worker-local` | API worker-local smoke (Miniflare; alias: `bun dev:worker`) |
| `cd apps/api && bun start` | Run Node API bundle (`dist/node.js`) |
| `bun run deploy:api` | Deploy API to Cloudflare Workers (production) |

### Database

Root scripts use the `db:*` prefix. `@edaya/db-migrate` exposes `school:*` and `auth:*` scripts (e.g. `bun --filter @edaya/db-migrate school:migrate:dev`).

| Command | Description |
|---------|-------------|
| `bun run db:generate` | Generate school schema SQL migrations (`@edaya/adaptor-postgres`) |
| `bun run db:migrate` | Apply school schema migrations (`@edaya/db-migrate`) |
| `bun run db:migrate:all` | Apply school + local D1 auth migrations (dev bootstrap) |
| `bun run db:migrate:dev` | Load `apps/api/.dev.vars` and migrate Hyperdrive origin + local D1 auth |
| `bun run db:migrate:staging` | Apply school migrations to Neon staging branch (`STAGING_DATABASE_URL`) |
| `bun run db:generate:auth` | Generate auth schema SQL migrations (`@edaya/adaptor-auth`) |
| `bun run db:migrate:auth` | Apply Better Auth migrations to local D1 |
| `bun run db:migrate:auth:remote` | Apply Better Auth migrations to remote D1 (production) |
| `bun run db:migrate:auth:staging` | Apply Better Auth migrations to remote D1 (staging) |
| `bun run auth:generate-schema` | Regenerate Better Auth Drizzle schema from CLI config |

Package-level extras (run from adaptor package or with `bun --filter`):

| Command | Description |
|---------|-------------|
| `bun --filter @edaya/adaptor-postgres db:push` | Push schema to database (drizzle-kit) |
| `bun --filter @edaya/adaptor-auth auth:db:push` | Push auth schema |
| `bun db:browser:school` | Browse local school tables (stop `bun dev` first) |
| `bun db:browser:auth` | Browse local auth tables |

### OpenAPI & API client

| Command | Description |
|---------|-------------|
| `bun run generated:update` | Export OpenAPI and update tracked API client bindings |
| `bun run generated:check` | Generate in a temporary directory and fail if tracked artifacts drift |
| `bun run openapi:generate` | Compatibility alias for updating all tracked OpenAPI artifacts |
| `bun run openapi:check` | Compatibility alias for `generated:check` |
| `bun run check:boundaries` | Verify layer import boundaries (runtime/http, core/adaptor-auth) |
| `bun run export-openapi` | Export OpenAPI JSON only |
| `bun tooling/repo/openapi/generate-bindings.ts` | Regenerate `@edaya/api-client` bindings from OpenAPI only |

TypeScript schema types for web apps are generated in **edaya_web** (`bun run openapi:generate`).

### Quality & CI

| Command | Description |
|---------|-------------|
| `bun run doctor` | Check environment-file tracking and required examples |
| `bun run lint` | ESLint repository scripts and all packages |
| `bun run lint:fix` | ESLint repository scripts and all packages with auto-fix |
| `bun run fix` | Alias for `lint:fix`; this command mutates files |
| `bun run check` | TypeScript / Svelte type checks |
| `bun run quality` | `lint` + `check` per package |
| `bun run test` | Repository-tooling, unit, and integration tests |
| `bun run test:remote` | Integration tests against a real Postgres database |
| `bun run test:coverage` | Tests with coverage (where supported) |
| `bun run build` | Build deployable API bundle |
| `bun run verify` | Complete non-mutating CI verification path |
| `bun run fullcheck` | Compatibility alias for `verify` |

### Per-package shortcuts

Use package-scoped commands during local iteration, then run `bun run verify` before opening a pull request:

```sh
bun --filter @edaya/core lint
bun --filter @edaya/core check
bun --filter @edaya/core test

bun --filter @edaya/api lint
bun --filter @edaya/api check
bun --filter @edaya/api test
```

Webapp tests run from **edaya_web** (`bun --filter @edaya/webapp test`).

## Testing

Tests are split by layer. Run everything with `bun run test` (repository tooling plus Turbo across packages that define a `test` script).

| Layer | Package / path | What to test here |
|-------|----------------|-------------------|
| Domain | `package/domain-core/tests/` | Entities, authorization, service workflows |
| API unit | `apps/api/tests/` | HTTP helpers, runtime, route builders, thin route tests |
| API harness | `apps/api/tests/support/core-route-harness.ts` | Shared PGlite app + auth helpers (also used by integration-tests) |
| Cross-package | `tooling/integration-tests/src/` | Seeds, auth flows, PGlite persistence, full route scenarios |

**Conventions**

- Put pure domain tests in `@edaya/core`.
- Put API transport/runtime tests in `apps/api/tests/`, mirroring `src/` layout (`http/`, `runtime/`, `routes/`, `lib/`).
- Put scenarios that span seeding, auth, and Postgres in `@edaya/integration-tests`.
- Integration-tests import the canonical route harness from `@api-tests/support/core-route-harness` (resolved to `apps/api/tests/support/`).

## Environment

**API** (`apps/api/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `pglite:.data/school` (local), `pglite` (in-memory tests); Postgres via Hyperdrive on `worker` |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `BETTER_AUTH_URL` | Public API URL for auth callbacks |
| `TRUSTED_ORIGINS` | CORS / auth origins (e.g. webapp URL) |

Seeding uses per-school `seedingApiKey` values from `@edaya/fixtures` — no API env key required.

Webapp env vars live in **edaya_web** (`apps/webapp/.env`).

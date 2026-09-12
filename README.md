# Edaya Core

Monorepo for the Edaya platform backend: a **Hono API** (`apps/api`) with scheduled cron jobs, shared libraries under **`package/`** (domain, authorization, school service, adaptors, generated API clients), and **`tooling/`** harnesses.

Web frontends live in the separate **[edaya_web](../edaya_web)** repo (`@edaya/webapp`, `@edaya/webadmin`).

Built with [Bun](https://bun.sh) workspaces and [Turborepo](https://turbo.build).

## Monorepo layout

```text
edaya_backend/
├── apps/
│   └── api/                              @edaya/api — Hono API + scheduled cron (Node + Worker)
├── package/
│   ├── domain-core/                      @edaya/core — entities, ports, registry
│   ├── domain-authorization/             @edaya/authorization — grants, policy, operations
│   ├── domain-service/                   @edaya/service — workflows, entity configs, notifications, cron
│   ├── adaptor-postgres/                 @edaya/adaptor-postgres — school schema, repos, SQL
│   ├── adaptor-novu/                     @edaya/adaptor-novu — Novu notification gateway (legacy fallback)
│   ├── adaptor-notify/                   @edaya/adaptor-notify — in-process email/push adapters
│   ├── adaptor-docs/                     @edaya/adaptor-docs — in-process PDF rendering
│   ├── adaptor-r2/                       @edaya/adaptor-r2 — R2 file storage adapter
│   ├── adaptor-local-fs/                 @edaya/adaptor-local-fs — local dev file storage adapter
│   └── api-client/                       @maya-invest/edaya-api-client — typed school API SDK
└── tooling/
    ├── repo/                             @edaya/repo — CI, OpenAPI codegen, dev tools
    ├── client-codegen/                   @edaya/client-codegen — OpenAPI client generator
    ├── fixtures/                         @edaya/fixtures
    ├── seeding/                          @edaya/seeding
    ├── db-migrate/                       @edaya/db-migrate — school-schema CLI
    ├── novu-ops/                         @edaya/novu-ops — Novu bootstrap + subscriber cleanup
    ├── local-files-server/               @edaya/local-files-server — local upload HTTP service
    ├── integration-tests/                @edaya/integration-tests (+ smoke/)
    └── api-dev-container/                scripts only (no package.json) — Apple Container API image
```

**Boundary rule:** `package/domain-core`, `package/domain-authorization`, `package/domain-service`, and adaptor packages never depend on `apps/` or `tooling/`. Identity and Better Auth live in sibling `edaya_identity`. `tooling/db-migrate` owns school migration CLI scripts; Worker host wiring (Hyperdrive, DI, request runtime cache) lives in `apps/api`.

## Solution architecture

The codebase follows a **ports-and-adapters** layout: entity types and ports live in `@edaya/core`; authorization in `@edaya/authorization`; school orchestration (`SchoolService`) in `@edaya/service`; portable Postgres persistence in `@edaya/adaptor-postgres`; migration CLI in `@edaya/db-migrate`; the API verifies central identity JWTs and uses the identity directory client. Web clients consume the API through `@maya-invest/edaya-api-client`.

```mermaid
flowchart TB
  subgraph clients["Clients (edaya_web)"]
    Webapp["@edaya/webapp<br/>SvelteKit · Cloudflare"]
  end

  subgraph identity["Identity (edaya_identity)"]
    Identity["@edaya/identity<br/>Better Auth · JWT · directory"]
  end

  subgraph api_layer["API"]
    API["@edaya/api<br/>Hono · Node + Worker"]
    Client["@maya-invest/edaya-api-client"]
    WorkerHost["runtime + http/di<br/>Hyperdrive · DI · request cache"]
  end

  subgraph package["package/"]
    Core["@edaya/core"]
    Authz["@edaya/authorization"]
    Service["@edaya/service"]
    PG["@edaya/adaptor-postgres"]
    DbMigrate["@edaya/db-migrate"]
  end

  Webapp -->|/auth| Identity
  Webapp --> Client
  Client -->|Bearer JWT / Vite proxy| API
  API -->|verify JWT + directory| Identity
  API --> WorkerHost
  API --> Service
  API --> Authz
  API --> Core
  API --> PG
  Service --> Authz
  Authz --> Core
  PG -.->|implements ports| Core
  DbMigrate --> PG
  PG --> SchoolDB[(Postgres / PGlite)]
```

### Request flow

1. **Web clients** — Browser SPAs sign in on identity (`/auth/*`), exchange a short-lived school-audience JWT, then call the school API through `@maya-invest/edaya-api-client`.
2. **API** — Hono middleware resolves env, verifies the identity JWT (or a `sk_live_` key), and a cached runtime (`getApiRuntime`).
3. **Runtime** — Opens only the school Postgres DB, runs school migrations, wires the central identity JWT/directory client, and builds `SchoolApplication`.
4. **Service** — `SchoolApplication.forActor(actor)` returns `SchoolService` for commands, queries, and entity CRUD with authorization.

### API runtimes

| Profile | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **local** | `apps/api/src/entries/local.ts` | `apps/api/.env` | `bun repo dev` (API + local-files) |
| **in-memory** | tests / harness | programmatic env | `bun test` in `apps/api` |
| **worker** | `apps/api/src/entries/worker.ts` | `wrangler.jsonc` + `.dev.vars` | `bun --filter @edaya/api dev:worker` (optional smoke) |

`local` uses persisted PGlite by default (`DATABASE_URL=pglite:.data/school`). `in-memory` uses ephemeral PGlite for fast tests. Workers require a real Postgres URL via Hyperdrive.

### API layout

- `apps/api/src/routes/` — OpenAPI route modules (thin HTTP surface)
- `apps/api/src/lib/school-api/` — registry, schemas, dispatch, entity handlers
- `apps/api/src/routes/onboarding.routes.ts` — thin HTTP for school registration; orchestration lives in `@edaya/service` (`capabilities/onboarding`)
- `apps/api/src/lib/graphql/` — **supported second contract** (`POST /graphql`) derived from the same registry as REST. The typed client (`@maya-invest/edaya-api-client`) is REST-only; web/mobile production callers use REST. Vite proxies `/graphql` and `/graphiql` for local exploration.
- `apps/api/src/cron/` — scheduled cron + queue consumer
- `apps/api/src/runtime/` — database, auth, Worker bindings, Hyperdrive, runtime registry
- `apps/api/src/http/` — Hono app, dependency injection middleware
- `package/domain-core/src/` — entities, ports, registry
- `package/domain-authorization/src/` — grants, policy, operations
- `package/domain-service/src/` — `SchoolService`, workflows, entity configs

More detail: [docs/reference/runtime-boundaries.md](./docs/reference/runtime-boundaries.md), [docs/reference/api-runtimes.md](./docs/reference/api-runtimes.md), [docs/reference/cross-repo-workflow.md](./docs/reference/cross-repo-workflow.md).

## Workspace packages

### Apps

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono HTTP API (Node + Cloudflare Workers), OpenAPI, scheduled cron, dev seed, Worker host wiring |

### Package workspace

| Package | Path | Role |
|---------|------|------|
| `@edaya/core` | `package/domain-core` | Domain entities, Zod schemas, repository/gateway ports |
| `@edaya/authorization` | `package/domain-authorization` | Grants, policy, operations, `AuthorizationRepositories` |
| `@edaya/service` | `package/domain-service` | `SchoolService`, workflows, entity configs, notifications, cron |
| `@edaya/adaptor-postgres` | `package/adaptor-postgres` | School Drizzle schema, SQL migrations, Postgres repository implementations |
| `@edaya/adaptor-novu` | `package/adaptor-novu` | Novu Cloud `NotificationGatewayPort` adapter (legacy fallback) |
| `@edaya/adaptor-notify` | `package/adaptor-notify` | In-process email/push adapters |
| `@edaya/adaptor-docs` | `package/adaptor-docs` | In-process PDF rendering |
| `@edaya/adaptor-r2` | `package/adaptor-r2` | Worker `FileStoragePort` adapter |
| `@edaya/adaptor-local-fs` | `package/adaptor-local-fs` | Local-dev `FileStoragePort` adapter |
| `@maya-invest/edaya-api-client` | `package/api-client` | Type-safe client for entities, commands, queries (generated bindings) |

### Tooling

| Package | Path | Role |
|---------|------|------|
| `@edaya/repo` | `tooling/repo` | Repo CLI (`bun repo`), CI checks, OpenAPI tooling |
| `@edaya/client-codegen` | `tooling/client-codegen` | OpenAPI → typed client generator |
| `@edaya/fixtures` | `tooling/fixtures` | Shared dev seed IDs, fixture records, and minimal seed helpers |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed orchestration (via `bun repo seed`) |
| `@edaya/db-migrate` | `tooling/db-migrate` | School-schema migration CLI (Neon / Hyperdrive / PGlite) |
| `@edaya/novu-ops` | `tooling/novu-ops` | Novu workflow bootstrap + subscriber cleanup CLI |
| `@edaya/local-files-server` | `tooling/local-files-server` | Local-dev file storage HTTP service |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration tests, staging smoke, Novu smoke |

`tooling/api-dev-container/` is a Docker/Apple Container helper (no workspace `package.json`). Invoke via `bun repo dev-container` / root `dev:container*` scripts.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (see `packageManager` in root `package.json`)
- Sibling **[edaya_identity](../edaya_identity/README.md)** checkout (`../edaya_identity`) for JWT verify + directory (`@maya-invest/edaya-identity-client`)

## First-time setup

```sh
bun install

cp apps/api/.env.example apps/api/.env
cp .env.example .env   # optional — seeding, migrations, smoke-test staging
```

Keep `IDENTITY_DIRECTORY_SECRET` identical in `apps/api/.env` and `edaya_identity/apps/identity/.env` (example value: `local-directory-secret`).

Identity: see **[edaya_identity](../edaya_identity/README.md)**. Web frontends: see **[edaya_web](../edaya_web/README.MD)**.

## Local development

Identity must be running before seed or login:

```sh
# Terminal 1 — identity
cd ../edaya_identity && bun repo dev     # :9900

# Terminal 2 — this repo
bun repo dev                             # :9999 API + :9200 files

# Terminal 3 — demo data (after both are up)
bun repo seed
```

| Service | URL |
|---------|-----|
| Identity | http://localhost:9900 |
| API | http://localhost:9999 |
| Local files | http://localhost:9200 |
| OpenAPI reference | http://localhost:9999/reference |

Webapp (port 5173) runs from **edaya_web** — see [edaya_web README](../edaya_web/README.MD).

`bun repo dev` starts the API **and** `@edaya/local-files-server` (required for uploads). Running `cd apps/api && bun repo dev` alone starts the API without the file server.

**worker smoke** (Miniflare — optional, hits remote Neon/R2):

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun --filter @edaya/api dev:worker
```

See [docs/reference/local-dev.md](./docs/reference/local-dev.md) for database options, dev seed, and troubleshooting.

## Commands

**Development and ops:** [`bun repo`](./docs/reference/repo-cli.md) — `bun repo dev`, `bun repo seed`, `bun repo db …`, etc. **No Turbo in `bun repo`** — use root scripts below.

**Turbo quality** (root `package.json`):

| Command | Description |
|---------|-------------|
| `bun run verify` | Pre-PR gate: `bun repo verify` + quality + build + test |
| `bun repo verify --full` | Local PR CI: `bun run verify` + `test:integration` |
| `bun run lint` | ESLint across workspaces |
| `bun run lint:fix` | ESLint with auto-fix |
| `bun run check` | TypeScript checks |
| `bun run test` | Unit tests (Turbo; excludes integration-tests) |
| `bun run build` | Build deployable bundles |
| `bun run quality` | `lint` + `check` per package |
| `bun run test:coverage` | Unit coverage (informational) |
| `bun run test:integration` | Integration api + http slices |
| `bun run test:integration:seed` | Integration seed slice (slow, opt-in) |

### Pre-PR verification

```sh
bun repo verify --full       # PR blocking CI locally (verify + integration)
bun run verify               # CI verify job only (no integration)
bun repo verify              # repo hygiene only (doctor + repo check *)
bun run test:integration     # integration slices alone
```

Full command tree: **[docs/reference/repo-cli.md](./docs/reference/repo-cli.md)**. CI workflow details: **[docs/reference/ci-setup.md](./docs/reference/ci-setup.md)**.

### Per-package iteration

```sh
bun --filter @edaya/core test
bun --filter @edaya/api lint
```

Then `bun run verify` before opening a PR. Webapp tests run from **edaya_web**.

## Testing

Tests are split by layer. **`bun run test`** runs Turbo unit tests only. **`bun run test:integration`** runs in-memory integration slices (see [test-pyramid-plan.md](./docs/sprints/test-pyramid-plan.md)).

| Layer | Package / path | What to test here |
|-------|----------------|-------------------|
| Domain | `package/domain-core/tests/` | Entities, schemas, ports |
| Authorization | `package/domain-authorization/tests/` | Grants, policy, operations |
| Service | `package/domain-service/tests/` | Workflows, entity configs, notifications, cron |
| API unit | `apps/api/tests/` | HTTP helpers, runtime, route builders, thin route tests |
| API harness | `apps/api/tests/support/core-route-harness.ts` | Shared PGlite app + auth helpers (also used by integration-tests) |
| Cross-package | `tooling/integration-tests/src/` | Seeds, auth flows, PGlite persistence, full route scenarios |

**Conventions**

- Put entity/schema tests in `@edaya/core`; authorization tests in `@edaya/authorization`; workflow tests in `@edaya/service`.
- Put API transport/runtime tests in `apps/api/tests/`, mirroring `src/` layout (`http/`, `runtime/`, `routes/`, `lib/`).
- Put scenarios that span seeding, auth, and Postgres in `@edaya/integration-tests`.
- Integration-tests import the canonical route harness from `@api-tests/support/core-route-harness` (resolved to `apps/api/tests/support/`).

## Environment

**API** (`apps/api/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `pglite:.data/school` (local), `pglite` (in-memory tests); Postgres via Hyperdrive on `worker` |
| `SCHOOL_API_ORIGIN` | JWT audience and public school API origin |
| `IDENTITY_ISSUER` | Central identity JWT issuer; JWKS is resolved at `/.well-known/jwks.json` |
| `IDENTITY_DIRECTORY_URL` | Central identity internal directory base URL |
| `IDENTITY_DIRECTORY_SECRET` | Shared directory credential (secret) |
| `TRUSTED_ORIGINS` | School API CORS origins |

Seeding uses per-school `seedingApiKey` values from `@edaya/fixtures` — no API env key required. Auth users are provisioned against identity (`SEED_AUTH_URL`, default `http://localhost:9900`).

Webapp env vars live in the **edaya_web** repo (`apps/webapp/.env` there).

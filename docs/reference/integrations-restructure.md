# Monorepo layout

Shared libraries live under **`package/`**; **apps** wire them at runtime; **tooling/** holds harnesses.

Web frontends (`@edaya/webapp`, `@edaya/webadmin`) live in the sibling **[edaya_web](../../../edaya_web)** repo.

## Layout

```text
edaya_backend/
  apps/
    api/                            Hono HTTP, OpenAPI, scheduled cron, runtime, Worker host wiring
  package/
    domain-core/                    Domain entities + ports
    domain-authorization/           Auth engine, permissions, policy
    domain-service/                 Workflows, entity CRUD, notifications, cron
    adaptor-postgres/               School Drizzle schema, SQL, repos, runMigrations()
    adaptor-novu/                   Novu notification gateway adapter (legacy fallback)
    adaptor-notify/                 In-process email/push adapters for school notification ports
    adaptor-docs/                   In-process PDF rendering (Handlebars + PdfRenderer)
    adaptor-r2/                     R2 file storage adapter
    adaptor-local-fs/               Local-dev file storage adapter
    api-client/                     Typed school API client generated from OpenAPI
  tooling/
    repo/                           @edaya/repo — CI, OpenAPI codegen, dev tools
    client-codegen/                 @edaya/client-codegen — OpenAPI client generator
    fixtures/                       Shared seed IDs and fixture records
    seeding/                        HTTP seed orchestration (@edaya/seeding)
    db-migrate/                     School-schema migration CLI (Neon / Hyperdrive)
    novu-ops/                       Novu workflow bootstrap + subscriber cleanup CLI
    local-files-server/             Local-dev file storage HTTP service
    integration-tests/              Integration tests + smoke (staging, Novu, in-process notify)
    api-dev-container/              Scripts only (no package.json) — Apple Container API image
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `@edaya/core` (`package/domain-core`) | Entity types, Zod schemas, ports, registry, shared utils | Workflows, entity `*Config` factories, notifications, cron dispatch |
| `@edaya/authorization` (`package/domain-authorization`) | Permissions, grants, policy, `AuthorizationRepositories` | School workflows, entity configs, notification templates |
| `@edaya/service` (`package/domain-service`) | `SchoolService`, workflows, entity configs, notifications, cron jobs, `SchoolRepositories` | HTTP routes, Drizzle schema, identity runtime |
| `package/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `package/adaptor-novu` | Novu `NotificationGatewayPort` adapter, delivery ports | Workflow bootstrap, subscriber cleanup CLI |
| `tooling/db-migrate` | Postgres `drizzle-kit migrate`, Hyperdrive / staging bootstrap | School SQL source files (those live in adaptor-postgres) |
| `tooling/novu-ops` | Novu workflow bootstrap, subscriber cleanup | Runtime notification gateway |
| `tooling/seeding` | HTTP seed scripts against running API (`bun repo seed`, …) | API route handlers |
| `apps/api` | Hono, OpenAPI, identity-client wiring, Hyperdrive bindings, DI, runtime registry | Identity persistence, migration CLI scripts, Novu ops CLI, seed data |

**Domain dependency direction:** `@edaya/service` → `@edaya/authorization` → `@edaya/core`. Adaptors and `apps/api` may depend on any combination needed at the wiring layer.

**Dependency direction:** `package/domain-core`, `package/domain-authorization`, `package/domain-service`, `package/adaptor-postgres`, `package/api-client`, and adaptor packages do not depend on identity persistence. `apps/api` depends only on `@maya-invest/edaya-identity-client`; `tooling/seeding` calls Central Identity and the school API over HTTP.

**Enforcement:** `bun repo verify` runs import boundary grep checks (`tooling/repo/lib/boundaries.ts`) and layout-identity checks (`tooling/repo/lib/layout-identity.ts`). ESLint `no-restricted-imports` blocks `@edaya/service` and `@edaya/authorization` in `package/domain-core/src`, and `@edaya/service` in `package/domain-authorization/src`.

## Package map

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono API + scheduled cron (Node + Worker) |
| `@edaya/core` | `package/domain-core` | Domain entities + ports |
| `@edaya/authorization` | `package/domain-authorization` | Authorization engine |
| `@edaya/service` | `package/domain-service` | School orchestration (workflows, capabilities) |
| `@edaya/adaptor-postgres` | `package/adaptor-postgres` | School persistence |
| `@maya-invest/edaya-api-client` | `package/api-client` | Typed school API SDK |
| `@edaya/adaptor-novu` | `package/adaptor-novu` | Novu Cloud adapter (legacy fallback) |
| `@edaya/adaptor-notify` | `package/adaptor-notify` | In-process email/push notification adapters |
| `@edaya/adaptor-docs` | `package/adaptor-docs` | In-process PDF rendering for report cards and logbooks |
| `@edaya/adaptor-r2` | `package/adaptor-r2` | R2 `FileStoragePort` adapter (S3-compatible API) |
| `@edaya/adaptor-local-fs` | `package/adaptor-local-fs` | Local dev `FileStoragePort` adapter (filesystem + signed HTTP URLs) |
| `@edaya/local-files-server` | `tooling/local-files-server` | Local dev file storage HTTP service |
| `@edaya/client-codegen` | `tooling/client-codegen` | OpenAPI client generator |
| `@edaya/repo` | `tooling/repo` | Repo CI, OpenAPI codegen, local dev tools |
| `@edaya/fixtures` | `tooling/fixtures` | Fixture data |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed CLI |
| `@edaya/db-migrate` | `tooling/db-migrate` | School migration CLI |
| `@edaya/novu-ops` | `tooling/novu-ops` | Novu workflow bootstrap + subscriber cleanup CLI |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration test suite + staging smoke |

## Historical renames

| Before | After |
|--------|-------|
| `maya_school_core/` | `edaya_backend/` (folder); `@edaya/solution` (root package) |
| `testing/` | `tooling/` |
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/runtime/` and `apps/api/src/http/` |
| `@edaya/adaptor-betterauth` | Moved to sibling `edaya_identity` |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` + `@edaya/db-migrate` (school apply) |
| `@edaya/neon-migrations` | `@edaya/db-migrate` for school; identity migrations moved to `edaya_identity` |
| `package/adaptor-novu/bootstrap` + `cleanup/` | `@edaya/novu-ops` (`tooling/novu-ops`) |
| `packages/` + `integrations/` | Unified under `package/` |
| `package/authorization/` | `package/domain-authorization/` |
| `package/generated-api-client/` | `package/api-client/` |
| `tooling/local-files/` | `tooling/local-files-server/` |

## Root scripts

| Script | Package / target |
|--------|------------------|
| `bun repo dev` | `@edaya/api` watch mode |
| `bun --filter @edaya/api dev:worker` | `@edaya/api` `dev:worker` |
| `bun repo seed` / `bun repo seed --staging` / `bun repo seed --scope doctor` / `bun repo smoke-test staging` | `@edaya/seeding` / `@edaya/integration-tests` |
| `bun repo db generate` | `@edaya/adaptor-postgres` |
| `bun repo db migrate local` | `@edaya/db-migrate` — school (local) |
| `bun repo db migrate staging` | `@edaya/db-migrate` — school (staging) |
| `bun repo db migrate production` | `@edaya/db-migrate` — school (production) |
| `bun repo novu bootstrap` / `bun repo novu bootstrap apply` / `bun repo novu bootstrap validate` | `@edaya/novu-ops` |
| `bun repo novu cleanup` / `bun repo novu cleanup apply` | `@edaya/novu-ops` |
| `bun repo openapi generate` | Export OpenAPI + regenerate client bindings |
| `bun repo check openapi` | Drift check for generated artifacts |
| `bun repo deploy api production` | `@edaya/api` `deploy:production` |
| `bun repo deploy api staging` | `@edaya/api` `deploy:staging` |
| `bun repo smoke-test staging` | `@edaya/integration-tests` |

Webapp deploy scripts live in **edaya_web**. See [cross-repo-workflow.md](./cross-repo-workflow.md).

## School migration pipeline

1. `db:generate` — Drizzle Kit in `@edaya/adaptor-postgres`
2. `db:migrate:local` / `db:migrate:staging` / `db:migrate:production` — school schema only

Central Identity owns its schema generation and migrations in sibling `edaya_identity`.

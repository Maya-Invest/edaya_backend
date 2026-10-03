# Monorepo layout

Shared libraries live under **`package/`**; **apps** wire them at runtime; **tooling/** holds harnesses.

Web frontends (`@edaya/webapp`, `@edaya/webadmin`) live in the sibling **[edaya_frontend](../../../edaya_frontend)** repo.

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
    adaptor-notify/                 In-process email/push adapters for school notification ports
    adaptor-docs/                   In-process PDF rendering (Handlebars + PdfRenderer)
    adaptor-r2/                     R2 file storage adapter
    adaptor-local-fs/               Local-dev file storage adapter
    api-client/                     Typed school API client generated from OpenAPI
  tooling/
    repo/                           @edaya/repo — CLI, CI, codegen, migrations, local services
      codegen/                      OpenAPI client generator and runtime templates
      db/school/                    School migration and guarded reset commands
      db/identity/                  Account/provider migration and guarded wipe commands
      dev/local-files.ts            Local-dev file HTTP server
    fixtures/                       Shared seed IDs and fixture records
    seeding/                        HTTP seed orchestration (@edaya/seeding)
    integration-tests/              Integration tests + smoke
    test-support/                   Shared Bun preload (no package.json)
    api-dev-container/              Container scripts (no package.json)
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `@edaya/core` (`package/domain-core`) | Entity types, Zod schemas, ports, registry, shared utils | Workflows, entity `*Config` factories, notifications, cron dispatch |
| `@edaya/authorization` (`package/domain-authorization`) | Permissions, grants, policy, `AuthorizationRepositories` | School workflows, entity configs, notification templates |
| `@edaya/service` (`package/domain-service`) | `SchoolService`, workflows, entity configs, notifications, cron jobs, `SchoolRepositories` | HTTP routes, Drizzle schema, identity runtime |
| `package/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `tooling/repo/db/school` | School migration application and guarded reset commands | School SQL source files (those live in adaptor-postgres) |
| `tooling/seeding` | HTTP seed scripts against running API (`bun repo seed`, …) | API route handlers |
| `apps/api` | Hono, OpenAPI, Account composition, Hyperdrive bindings, DI, runtime registry | Migration CLI scripts and seed data |

**Domain dependency direction:** `@edaya/service` → `@edaya/authorization` → `@edaya/core`. Adaptors and `apps/api` may depend on any combination needed at the wiring layer.

**Dependency direction:** `package/domain-core`, `package/domain-authorization`, `package/domain-service`, `package/adaptor-postgres`, `package/api-client`, and adaptor packages do not depend on identity persistence. `apps/api/src/identity` composes Account/provider adapters and exposes typed in-process directory, token and privileged-policy ports. School packages exclude provider internals. `tooling/seeding` calls authentication and school routes through one API URL.

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
| `@edaya/adaptor-notify` | `package/adaptor-notify` | In-process email/push notification adapters |
| `@edaya/adaptor-docs` | `package/adaptor-docs` | In-process PDF rendering for report cards and logbooks |
| `@edaya/adaptor-r2` | `package/adaptor-r2` | R2 `FileStoragePort` adapter (S3-compatible API) |
| `@edaya/adaptor-local-fs` | `package/adaptor-local-fs` | Local dev `FileStoragePort` adapter (filesystem + signed HTTP URLs) |
| `@edaya/repo` | `tooling/repo` | Repo CI, OpenAPI codegen, migrations, local dev services |
| `@edaya/fixtures` | `tooling/fixtures` | Fixture data |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed CLI |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration test suite + staging smoke |

## Historical renames

| Before | After |
|--------|-------|
| `maya_school_core/` | `edaya_backend/` (folder); `@edaya/solution` (root package) |
| `testing/` | `tooling/` |
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/runtime/` and `apps/api/src/http/` |
| `@edaya/adaptor-betterauth` | Moved to `apps/api/src/identity` in this workspace |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` + `repo migration commands` (school apply) |
| `@edaya/neon-migrations` | `repo migration commands` for school; identity migrations moved to `edaya_identity` |
| `packages/` + `integrations/` | Unified under `package/` |
| `package/authorization/` | `package/domain-authorization/` |
| `package/generated-api-client/` | `package/api-client/` |
| `tooling/local-files/` | `tooling/repo/dev/local-files.ts` |

## Root scripts

| Script | Package / target |
|--------|------------------|
| `bun repo dev` | Identity, school API, and local files in watch mode |
| `bun --filter @edaya/api dev:worker` | `@edaya/api` `dev:worker` |
| `bun repo seed` / `bun repo seed --staging` / `bun repo seed --scope doctor` / `bun repo smoke-test staging` | `@edaya/seeding` / `@edaya/integration-tests` |
| `bun repo db generate` | `@edaya/adaptor-postgres` |
| `bun repo db migrate local` | `repo migration commands` — school (local) |
| `bun repo db migrate staging` | `repo migration commands` — school (staging) |
| `bun repo db migrate production` | `repo migration commands` — school (production) |
| `bun repo openapi generate` | Export OpenAPI + regenerate client bindings |
| `bun repo check openapi` | Drift check for generated artifacts |
| `bun repo deploy api production` | `@edaya/api` `deploy:production` |
| `bun repo deploy api staging` | `@edaya/api` `deploy:staging` |
| `bun repo smoke-test staging` | `@edaya/integration-tests` |

Webapp deploy scripts live in **edaya_frontend**. See [cross-repo-workflow.md](./cross-repo-workflow.md).

## School migration pipeline

1. `db:generate` — Drizzle Kit in `@edaya/adaptor-postgres`
2. `db:migrate:local` / `db:migrate:staging` / `db:migrate:production` — school schema only

Central Identity owns its schema generation and migrations in `apps/api/src/identity` in this workspace.

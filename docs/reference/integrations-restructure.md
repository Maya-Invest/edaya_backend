# Monorepo layout

Shared libraries live under **`package/`**; **apps** wire them at runtime; **tooling/** holds harnesses.

Web frontends (`@edaya/webapp`, `@edaya/saas-admin`) live in the sibling **[edaya_web](../../../edaya_web)** repo.

## Layout

```text
edaya_backend/
  apps/
    api/                            Hono HTTP, OpenAPI, scheduled cron, runtime, Worker host wiring
  package/
    domain-core/                    Domain, services, authorization, ports
    adaptor-postgres/               School Drizzle schema, SQL, repos, runMigrations()
    adaptor-auth/                   Better Auth schema, SQL, runtime runMigrations()
    adaptor-novu/                   Novu notification gateway adapter
    adaptor-r2/                     R2 file storage adapter
    generated-api-client/           Typed client generated from OpenAPI
  tooling/
    repo/                           @edaya/repo — CI, OpenAPI codegen, dev tools
    fixtures/                       Shared seed IDs and fixture records
    seeding/                        HTTP seed orchestration (@edaya/seeding)
    db-migrate/                     School + auth migration CLI (Neon / Hyperdrive)
    novu-ops/                       Novu workflow bootstrap + subscriber cleanup CLI
    integration-tests/              Integration tests + smoke (staging, Novu)
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `package/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `package/adaptor-auth` | Auth Drizzle schema, auth SQL, auth `runMigrations()` | Better Auth runtime config (lives in `apps/api`) |
| `package/adaptor-novu` | Novu `NotificationGatewayPort` adapter, delivery ports | Workflow bootstrap, subscriber cleanup CLI |
| `tooling/db-migrate` | Postgres `drizzle-kit migrate`, Hyperdrive / staging bootstrap | School SQL source files (those live in adaptor-postgres) |
| `tooling/novu-ops` | Novu workflow bootstrap, subscriber cleanup | Runtime notification gateway |
| `tooling/seeding` | HTTP seed scripts against running API (`seed:init`, …) | API route handlers |
| `apps/api` | Hono, OpenAPI, Better Auth config, Hyperdrive bindings, DI, runtime registry | Migration CLI scripts, Novu ops CLI, seed data |

**Dependency direction:** `package/domain-core`, `package/adaptor-postgres`, `package/generated-api-client`, and adaptor packages never depend on `@edaya/adaptor-auth`. `apps/api` depends on `@edaya/adaptor-auth`. `tooling/db-migrate` orchestrates migrations and may reference adaptor paths for SQL only. `tooling/seeding` calls the API over HTTP.

## Package map

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono API + scheduled cron (Node + Worker) |
| `@edaya/core` | `package/domain-core` | Domain + ports |
| `@edaya/adaptor-postgres` | `package/adaptor-postgres` | School persistence |
| `@edaya/adaptor-auth` | `package/adaptor-auth` | Better Auth persistence |
| `@edaya/api-client` | `package/generated-api-client` | Typed API SDK |
| `@edaya/adaptor-novu` | `package/adaptor-novu` | Novu Cloud `NotificationGatewayPort` adapter |
| `@edaya/adaptor-r2` | `package/adaptor-r2` | R2 `FileStoragePort` adapter (S3-compatible API) |
| `@edaya/adaptor-local-fs` | `package/adaptor-local-fs` | Local dev `FileStoragePort` adapter (filesystem + signed HTTP URLs) |
| `@edaya/local-files` | `tooling/local-files` | Local dev file storage HTTP service |
| `@edaya/repo` | `tooling/repo` | Repo CI, OpenAPI codegen, local dev tools |
| `@edaya/fixtures` | `tooling/fixtures` | Fixture data |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed CLI |
| `@edaya/db-migrate` | `tooling/db-migrate` | School + auth migration CLI |
| `@edaya/novu-ops` | `tooling/novu-ops` | Novu workflow bootstrap + subscriber cleanup CLI |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration test suite + staging smoke |

## Historical renames

| Before | After |
|--------|-------|
| `maya_school_core/` | `edaya_backend/` (folder); `@edaya/solution` (root package) |
| `testing/` | `tooling/` |
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/runtime/` and `apps/api/src/http/` |
| `@edaya/adaptor-betterauth` | `@edaya/adaptor-auth` |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` + `@edaya/db-migrate` (school apply) |
| `@edaya/neon-migrations` + `@edaya/betterauth-d1-migrations` | `@edaya/integration-migrations` → split into `@edaya/adaptor-auth` + `@edaya/db-migrate` |
| `package/adaptor-novu/bootstrap` + `cleanup/` | `@edaya/novu-ops` (`tooling/novu-ops`) |
| `packages/` + `integrations/` | Unified under `package/` |
| `apps/webapp` | Moved to **edaya_web** repo |

## Root scripts

| Script | Package / target |
|--------|------------------|
| `bun dev` | `@edaya/api` watch mode |
| `bun dev:worker:staging` | `@edaya/api` `dev:worker:staging` |
| `bun seed` / `bun seed:init` / `bun seed:auth` / `bun seed:smoke` / `bun seed:remote` / `bun seed:smoke:staging` | `@edaya/seeding` |
| `bun db:generate` | `@edaya/adaptor-postgres` |
| `bun db:migrate` | `@edaya/db-migrate` (`migrate`) — school only |
| `bun db:migrate:full` | `@edaya/db-migrate` (`migrate:full`) — school + auth |
| `bun db:migrate:production` | `@edaya/db-migrate` (`migrate:production`) |
| `bun db:migrate:staging` | `@edaya/db-migrate` (`migrate:staging`) |
| `bun db:generate:auth` | `@edaya/adaptor-auth` (`auth:db:generate`) |
| `bun auth:generate-schema` | `@edaya/adaptor-auth` |
| `bun novu:bootstrap` / `bun novu:bootstrap:apply` / `bun novu:bootstrap:validate` | `@edaya/novu-ops` |
| `bun novu:cleanup` / `bun novu:cleanup:apply` | `@edaya/novu-ops` |
| `bun run openapi:generate` | Export OpenAPI + regenerate client bindings |
| `bun run openapi:check` | Drift check for generated artifacts |
| `bun deploy:api` | `@edaya/api` `deploy:worker` |
| `bun deploy:api:staging` | `@edaya/api` `deploy:worker:staging` |
| `bun smoke:staging` | `@edaya/integration-tests` |

Webapp deploy scripts live in **edaya_web**. See [cross-repo-workflow.md](./cross-repo-workflow.md).

## Auth schema pipeline

1. `auth:generate-schema` — Better Auth CLI → `package/adaptor-auth/src/schema.ts`
2. `db:generate:auth` — Drizzle Kit → `package/adaptor-auth/drizzle/auth/*.sql`
3. Node / worker runtime — `runMigrations()` on startup (PGlite) or pre-applied on Neon
4. Neon deploy — `db:migrate:production` / `db:migrate:staging` (school + `auth` schema)

## School migration pipeline

1. `db:generate` — Drizzle Kit in `@edaya/adaptor-postgres`
2. `db:migrate` — apply school schema to `DATABASE_URL`
3. `db:migrate:production` — Neon production from `tooling/seeding/.env.production` (school + auth)
4. `db:migrate:full` — school + auth on explicit `DATABASE_URL`

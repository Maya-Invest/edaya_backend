# Monorepo layout

Shared libraries live under **`package/`**; **apps** wire them at runtime; **tooling/** holds harnesses.

Web frontends (`@edaya/webapp`, `@edaya/saas-admin`) live in the sibling **[edaya_web](../../../edaya_web)** repo.

## Layout

```text
edaya_backend/
  apps/
    api/                            Hono HTTP, OpenAPI, runtime, Worker host wiring
    cron/                           Scheduled jobs (Node + Worker)
  package/
    domain-core/                    Domain, services, authorization, ports
    adaptor-postgres/               School Drizzle schema, SQL, repos, runMigrations()
    adaptor-novu/                   Novu notification gateway adapter
    adaptor-r2/                     R2 file storage adapter
    generated-api-client/           Typed client generated from OpenAPI
    integration-migrations/         School + auth migration apply (Neon / Hyperdrive + D1)
  tooling/
    repo/                           @edaya/repo — CI, OpenAPI codegen, dev tools
    fixtures/                       Shared seed IDs and fixture records
    seeding/                        HTTP seed orchestration (@edaya/seeding)
    integration-tests/              Integration tests + smoke (staging, Novu)
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `package/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `package/integration-migrations` | School `drizzle-kit migrate`, Hyperdrive dev bootstrap, auth schema/SQL, D1 Wrangler apply, auth `runMigrations()` | School SQL source files (those live in adaptor-postgres) |
| `tooling/seeding` | HTTP seed scripts against running API (`seed:init`, `seed:all`, …) | API route handlers |
| `apps/api` | Hono, OpenAPI, Better Auth config, Hyperdrive bindings, DI, runtime registry | Platform migration scripts, seed data |

**Dependency direction:** `package/domain-core`, `package/adaptor-postgres`, `package/generated-api-client`, and adaptor packages never depend on `package/integration-*`. `apps/api` depends on integration packages. `tooling/seeding` calls the API over HTTP. Integration packages may reference adaptor paths for migration SQL only.

## Package map

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono API (Node + Worker) |
| `@edaya/cron` | `apps/cron` | Cron runtime (Node + Worker) |
| `@edaya/core` | `package/domain-core` | Domain + ports |
| `@edaya/adaptor-postgres` | `package/adaptor-postgres` | School persistence |
| `@edaya/api-client` | `package/generated-api-client` | Typed API SDK |
| `@edaya/integration-migrations` | `package/integration-migrations` | School + auth migration apply |
| `@edaya/adaptor-novu` | `package/adaptor-novu` | Novu Cloud `NotificationGatewayPort` adapter |
| `@edaya/adaptor-r2` | `package/adaptor-r2` | R2 `FileStoragePort` adapter (S3-compatible API) |
| `@edaya/repo` | `tooling/repo` | Repo CI, OpenAPI codegen, local dev tools |
| `@edaya/fixtures` | `tooling/fixtures` | Fixture data |
| `@edaya/seeding` | `tooling/seeding` | HTTP seed CLI |
| `@edaya/integration-tests` | `tooling/integration-tests` | Integration test suite + staging smoke |

## Historical renames

| Before | After |
|--------|-------|
| `maya_school_core/` | `edaya_backend/` (folder); `@edaya/solution` (root package) |
| `testing/` | `tooling/` |
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/runtime/` and `apps/api/src/http/` |
| `@edaya/adaptor-betterauth` | Auth persistence in `@edaya/integration-migrations` |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` + `@edaya/integration-migrations` (school apply) |
| `@edaya/neon-migrations` + `@edaya/betterauth-d1-migrations` | `@edaya/integration-migrations` |
| `packages/` + `integrations/` | Unified under `package/` |
| `apps/webapp` | Moved to **edaya_web** repo |

## Root scripts

| Script | Package / target |
|--------|------------------|
| `bun dev` | `@edaya/api` watch mode |
| `bun dev:worker` | `@edaya/api` `dev:worker` |
| `bun seed` / `bun seed:init` / `bun seed:auth` / `bun seed:smoke` / `bun seed:remote` / `bun seed:smoke:staging` | `@edaya/seeding` |
| `bun db:generate` | `@edaya/adaptor-postgres` |
| `bun db:migrate` | `@edaya/integration-migrations` (`school:migrate`) |
| `bun db:migrate:all` | `@edaya/integration-migrations` (`school:migrate:all`) |
| `bun db:migrate:dev` | `@edaya/integration-migrations` (`school:migrate:dev`) |
| `bun db:generate:auth` | `@edaya/integration-migrations` (`auth:db:generate`) |
| `bun auth:generate-schema` | `@edaya/integration-migrations` |
| `bun db:migrate:auth` | `@edaya/integration-migrations` (`auth:migrate:local`) |
| `bun db:migrate:auth:remote` | `@edaya/integration-migrations` (`auth:migrate:remote`) |
| `bun db:migrate:staging` | `@edaya/integration-migrations` (`school:migrate:staging`) |
| `bun db:migrate:auth:staging` | `@edaya/integration-migrations` (`auth:migrate:staging`) |
| `bun run generated:update` | Export OpenAPI + regenerate `@edaya/api-client` bindings |
| `bun deploy:api` | `@edaya/api` `deploy:worker` |
| `bun deploy:api:staging` | `@edaya/api` `deploy:worker:staging` |
| `bun smoke:staging` | `@edaya/integration-tests` |

Webapp deploy scripts live in **edaya_web**. See [cross-repo-workflow.md](./cross-repo-workflow.md).

## Auth schema pipeline

1. `auth:generate-schema` — Better Auth CLI → `package/integration-migrations/src/auth/schema.ts`
2. `db:generate:auth` — Drizzle Kit → `package/integration-migrations/drizzle/auth/*.sql`
3. Node runtime — `runMigrations()` on API startup (SQLite file)
4. Worker deploy — D1 migrations via `auth:migrate:local` / `auth:migrate:remote` (Wrangler)

## School migration pipeline

1. `db:generate` — Drizzle Kit in `@edaya/adaptor-postgres`
2. `db:migrate` — apply to a configured Postgres URL
3. `db:migrate:dev` — Neon dev bootstrap + school + auth orchestration
4. `db:migrate:all` — school + auth in one pass

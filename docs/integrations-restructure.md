# Monorepo layout

Vendor-agnostic **packages**, platform-specific **integrations**, and **apps** that wire them together.

## Layout

```text
apps/
  api/                              Hono HTTP, OpenAPI, runtime, Worker host wiring
  webapp/                           SvelteKit static SPA (Cloudflare Pages)

packages/
  core/                             Domain, services, authorization, ports
  adaptor-postgres/                 School Drizzle schema, SQL, repos, runMigrations()
  api-client/                       Typed client generated from OpenAPI

integrations/
  neon-migrations/                  Apply school migrations (Neon / Hyperdrive)
  betterauth-d1-migrations/         Auth schema, SQL, D1 deploy, auth runMigrations()

testing/
  dev-fixtures/                     Shared seed IDs and fixture records
  seeding/                          HTTP seed orchestration (@edaya/seeding)
  integration-tests/                Cross-package integration tests
  smoke-staging/                    HTTP smoke checks for deployed staging (@edaya/smoke-staging)
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `packages/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `integrations/neon-migrations` | `drizzle-kit migrate`, Hyperdrive dev bootstrap, `migrate:all` orchestration | SQL source files |
| `integrations/betterauth-d1-migrations` | Auth schema, SQL, D1 Wrangler apply, auth `runMigrations()` | School data |
| `testing/seeding` | HTTP seed scripts against running API (`seed:init`, `seed:all`, …) | API route handlers |
| `apps/api` | Hono, OpenAPI, Better Auth config, Hyperdrive bindings, DI, runtime registry | Platform migration scripts, seed data |

**Dependency direction:** `packages` never depend on `integrations`. `apps/api` depends on both. `testing/seeding` calls the API over HTTP. Integration packages may reference adaptor paths for migration SQL only.

## Package map

| Package | Path | Role |
|---------|------|------|
| `@edaya/api` | `apps/api` | Hono API (Node + Worker) |
| `@edaya/webapp` | `apps/webapp` | SvelteKit UI |
| `@edaya/core` | `packages/core` | Domain + ports |
| `@edaya/adaptor-postgres` | `packages/adaptor-postgres` | School persistence |
| `@edaya/api-client` | `packages/api-client` | Typed API SDK |
| `@edaya/neon-migrations` | `integrations/neon-migrations` | School DB migration apply |
| `@edaya/betterauth-d1-migrations` | `integrations/betterauth-d1-migrations` | Auth schema + D1 deploy |
| `@edaya/dev-fixtures` | `testing/dev-fixtures` | Fixture data |
| `@edaya/seeding` | `testing/seeding` | HTTP seed CLI |
| `@edaya/integration-tests` | `testing/integration-tests` | Integration test suite |
| `@edaya/smoke-staging` | `testing/smoke-staging` | Deployed staging HTTP smoke |

## Historical renames

| Before | After |
|--------|-------|
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/runtime/` and `apps/api/src/http/` |
| `@edaya/adaptor-betterauth` | `@edaya/betterauth-d1-migrations` in `integrations/` |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` in `packages/` + `@edaya/neon-migrations` in `integrations/` |

## Root scripts

| Script | Package / target |
|--------|------------------|
| `bun dev` | Turbo — API + webapp watch |
| `bun dev:worker` | `@edaya/api` `dev:worker` |
| `bun seed` / `bun seed:init` / `bun seed:auth` / `bun seed:smoke` / `bun seed:remote` / `bun seed:smoke:staging` | `@edaya/seeding` |
| `bun db:generate` | `@edaya/adaptor-postgres` |
| `bun db:migrate` | `@edaya/neon-migrations` (`migrate`) |
| `bun db:migrate:all` | `@edaya/neon-migrations` (`migrate:all`) |
| `bun db:migrate:dev` | `@edaya/neon-migrations` (`migrate:dev`) |
| `bun db:generate:auth` | `@edaya/betterauth-d1-migrations` |
| `bun auth:generate-schema` | `@edaya/betterauth-d1-migrations` |
| `bun db:migrate:auth` | `@edaya/betterauth-d1-migrations` (`migrate:local`) |
| `bun db:migrate:auth:remote` | `@edaya/betterauth-d1-migrations` (`migrate:remote`) |
| `bun db:migrate:staging` | `@edaya/neon-migrations` (`migrate:staging`) |
| `bun db:migrate:auth:staging` | `@edaya/betterauth-d1-migrations` (`migrate:staging`) |
| `bun openapi:generate` | API export → webapp schema → API client regen |
| `bun deploy:api` | `@edaya/api` `deploy:worker` |
| `bun deploy:api:staging` | `@edaya/api` `deploy:worker:staging` |
| `bun deploy:webapp` | `@edaya/webapp` `deploy` |
| `bun deploy:webapp:staging` | `@edaya/webapp` `deploy:staging` |
| `bun smoke:staging` | `@edaya/smoke-staging` |

## Auth schema pipeline

1. `auth:generate-schema` — Better Auth CLI → `integrations/betterauth-d1-migrations/src/schema.ts`
2. `db:generate:auth` — Drizzle Kit → `integrations/betterauth-d1-migrations/drizzle/*.sql`
3. Node runtime — `runMigrations()` on API startup (SQLite file)
4. Worker deploy — D1 migrations via `migrate:local` / `migrate:remote` (Wrangler)

## School migration pipeline

1. `db:generate` — Drizzle Kit in `@edaya/adaptor-postgres`
2. `db:migrate` — apply to a configured Postgres URL
3. `db:migrate:dev` — Neon dev bootstrap + school + auth orchestration
4. `db:migrate:all` — school + auth in one pass

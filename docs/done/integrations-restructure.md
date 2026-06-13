# Integrations restructure

Completed monorepo layout split between vendor-agnostic **packages**, platform-specific **integrations**, and **apps** that wire them together.

## Target layout

```text
apps/
  api/                              Worker host wiring + HTTP + runtime
  webapp/                           SvelteKit UI

packages/
  core/                             Domain + ports
  adaptor-postgres/                 School schema, SQL, repos, runtime runMigrations()
  api-client/

integrations/
  neon-migrations/                  Apply school migrations (Neon / Hyperdrive)
  betterauth-d1-migrations/         Auth schema, SQL, D1 deploy, auth runMigrations()

testing/
  dev-fixtures/
  integration-tests/
```

## Boundary rules

| Layer | Owns | Does not own |
|-------|------|--------------|
| `packages/adaptor-postgres` | Drizzle schema, `drizzle/`, repos, `runMigrations()` for school DB | Wrangler, `.dev.vars`, Neon CLI scripts |
| `integrations/neon-migrations` | `drizzle-kit migrate`, Hyperdrive dev bootstrap, `migrate:all` orchestration | SQL source files |
| `integrations/betterauth-d1-migrations` | Auth schema, SQL, D1 Wrangler apply, auth `runMigrations()` | School data |
| `apps/api` | Hono, OpenAPI, Better Auth config, Hyperdrive bindings, DI, runtime registry | Platform migration scripts |

**Dependency direction:** `packages` never depend on `integrations`. `apps/api` depends on both. Integration packages may reference adaptor paths for migration SQL only.

## Package renames

| Before | After |
|--------|-------|
| `@edaya/adaptor-cloudflare` | Inlined into `apps/api/src/lib/runtime/` and `apps/api/src/lib/http/dependency-injection.ts` |
| `@edaya/adaptor-betterauth` | `@edaya/betterauth-d1-migrations` in `integrations/` |
| `@edaya/adaptor-neon` | `@edaya/adaptor-postgres` in `packages/` + `@edaya/neon-migrations` in `integrations/` |

## Root scripts

| Script | Package |
|--------|---------|
| `bun db:generate` | `@edaya/adaptor-postgres` |
| `bun db:migrate` | `@edaya/neon-migrations` (`migrate`) |
| `bun db:migrate:all` | `@edaya/neon-migrations` (`migrate:all`) |
| `bun db:migrate:dev` | `@edaya/neon-migrations` (`migrate:dev`) |
| `bun db:generate:auth` | `@edaya/betterauth-d1-migrations` |
| `bun auth:generate-schema` | `@edaya/betterauth-d1-migrations` |
| `bun db:migrate:auth` | `@edaya/betterauth-d1-migrations` (`migrate:local`) |
| `bun db:migrate:auth:remote` | `@edaya/betterauth-d1-migrations` (`migrate:remote`) |

## Auth schema pipeline

1. `auth:generate-schema` — Better Auth CLI → `src/schema.ts`
2. `db:generate:auth` — Drizzle Kit → `drizzle/*.sql`
3. Runtime — `runMigrations()` on API startup (Node sqlite file)
4. Deploy — `migrate:local` / `migrate:remote` via Wrangler for D1

## PR sequence (completed)

1. Inline Cloudflare runtime into `apps/api`
2. Move auth to `integrations/betterauth-d1-migrations`
3. Rename school adaptor to `adaptor-postgres`; extract `neon-migrations`
4. Documentation + full quality gate

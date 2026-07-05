# @edaya/db-migrate

Database migration CLI for EDAYA: school Postgres (Neon / Hyperdrive / PGlite) and Better Auth Postgres (`auth` schema).

| Area | Schema source | SQL migrations |
|------|---------------|----------------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` |
| **Auth** | `@edaya/adaptor-auth` | `package/adaptor-auth/drizzle/auth/` |

## Commands (monorepo root)

| Command | Scope | Environment |
|---------|-------|-------------|
| `bun db:migrate:local` | school + auth | `apps/api/.env` (`pglite:.data/school`) |
| `bun db:migrate:staging` | school + auth | repo root `.env` (`STAGING_DATABASE_URL`) |
| `bun db:migrate:production` | school + auth | repo root `.env` (`PRODUCTION_DATABASE_URL`) |
| `bun db:migrate:local:school` | school only | local |
| `bun db:migrate:staging:school` | school only | staging |
| `bun db:migrate:production:school` | school only | production |
| `bun db:migrate:local:auth` | auth only | local |
| `bun db:migrate:staging:auth` | auth only | staging |
| `bun db:migrate:production:auth` | auth only | production |

`bun dev` also applies both schemas on startup when `RUN_MIGRATIONS_ON_STARTUP=true` (default for local PGlite).

Schema generation: `bun db:generate` (school), `bun db:generate:auth` / `bun auth:generate-schema` (auth).

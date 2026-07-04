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
| `bun db:migrate:staging` | school + auth | `tooling/seeding/.env.staging` |
| `bun db:migrate:production` | school + auth | `tooling/seeding/.env.production` |
| `bun db:migrate:local:pg` | school only | local |
| `bun db:migrate:staging:pg` | school only | staging |
| `bun db:migrate:production:pg` | school only | production |
| `bun db:migrate:local:auth` | auth only | local |
| `bun db:migrate:staging:auth` | auth only | staging |
| `bun db:migrate:production:auth` | auth only | production |

`bun dev` also applies both schemas on startup when `RUN_MIGRATIONS_ON_STARTUP=true` (default for local PGlite).

Schema generation: `bun db:generate` (school), `bun db:generate:auth` / `bun auth:generate-schema` (auth).

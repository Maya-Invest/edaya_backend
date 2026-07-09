# @edaya/db-migrate

Database migration CLI for EDAYA: school Postgres (Neon / Hyperdrive / PGlite) and Better Auth Postgres (`auth` schema).

| Area | Schema source | SQL migrations |
|------|---------------|----------------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` |
| **Auth** | `@edaya/adaptor-auth` | `package/adaptor-auth/drizzle/auth/` |

## Commands (monorepo root)

| Command | Scope | Environment |
|---------|-------|-------------|
| `bun repo db migrate local` | school + auth | `apps/api/.env` (`pglite:.data/school`) |
| `bun repo db migrate staging` | school + auth | repo root `.env` (`STAGING_DATABASE_URL`) |
| `bun repo db migrate production` | school + auth | repo root `.env` (`PRODUCTION_DATABASE_URL`) |
| `bun repo db migrate local --school` | school only | local |
| `bun repo db migrate staging --school` | school only | staging |
| `bun repo db migrate production --school` | school only | production |
| `bun repo db migrate local --auth` | auth only | local |
| `bun repo db migrate staging --auth` | auth only | staging |
| `bun repo db migrate production --auth` | auth only | production |

`bun repo dev` also applies both schemas on startup when `RUN_MIGRATIONS_ON_STARTUP=true` (default for local PGlite).

Schema generation: `bun repo db generate` (school), `bun repo db generate --auth` (auth).

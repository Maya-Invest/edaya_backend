# School database commands

Database migration CLI for the EDAYA school schema (Neon / Hyperdrive / PGlite). Account and auth-provider migrations run through `bun repo identity-migrate` in this backend workspace.

| Area | Schema source | SQL migrations |
|------|---------------|----------------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` |

## Commands (monorepo root)

| Command | Scope | Environment |
|---------|-------|-------------|
| `bun repo db migrate local` | school | `apps/api/.env` (`pglite:.data/school`) |
| `bun repo db migrate staging` | school | repo root `.env` (`STAGING_DATABASE_URL`) |
| `bun repo db migrate production` | school | repo root `.env` (`PRODUCTION_DATABASE_URL`) |
| `bun repo db reset staging --yes` | drop + re-apply school | staging |
| `bun repo db reset production --yes` | drop + re-apply school | production |
| `bun repo db flatten` | squash school migrations to one baseline SQL file | repo |

`bun repo dev` applies the school and notification schemas on startup when `RUN_MIGRATIONS_ON_STARTUP=true`.

School migrations use `drizzle.__drizzle_migrations_school`. Identity migration journals live in the identity database and are not read here.

| Side | Journal table |
|------|----------------|
| School | `drizzle.__drizzle_migrations_school` |
Schema generation: `bun repo db generate`.

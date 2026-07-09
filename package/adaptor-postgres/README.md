# @edaya/adaptor-postgres

Portable Postgres persistence for EDAYA: Drizzle schema, SQL migrations, and repository implementations.

Migration apply scripts for Neon / Hyperdrive and Better Auth D1 live in `@edaya/db-migrate`.

## Scripts

```sh
# Generate SQL migration from schema changes
bun repo db generate

# Push schema (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run db:push
```

From the monorepo root:

```sh
bun repo db generate

# Browse local dev tables (loads apps/api/.env; stop the API first for PGlite)
bun repo db browser school
bun repo db browser auth
```

Apply migrations with `@edaya/db-migrate` (`bun repo db migrate staging`, `bun repo db migrate production`).

## Runtime usage

`DATABASE_URL` forms:

| Value | PGlite mode |
|-------|-------------|
| `pglite`, `memory`, `memory://` | In-memory (tests) |
| `pglite:.data/school`, `file://…` | Persisted filesystem directory |
| `postgres://…` | Real Postgres via `postgres-js` |

```ts
import {
  PostgresSchoolRepositories,
  isEphemeralDatabase,
  isPgliteDatabase,
  resolveMigrationDriver,
  resolvePgliteDataDir,
  runMigrations,
} from '@edaya/adaptor-postgres'

await runMigrations(db, { driver: resolveMigrationDriver(databaseUrl) })

const repos = new PostgresSchoolRepositories(db)
await repos.init({ driver: resolveMigrationDriver(databaseUrl) })
```

## Naming note

`@edaya/adaptor-auth` has a `session` table for auth sessions. The school `sessions` table in this package is for **class scheduling** — unrelated to Better Auth.

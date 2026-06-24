# @edaya/adaptor-postgres

Portable Postgres persistence for EDAYA: Drizzle schema, SQL migrations, and repository implementations.

Migration apply scripts for Neon / Hyperdrive live in `@edaya/neon-migrations`.

## Scripts

```sh
# Generate SQL migration from schema changes
bun run db:generate

# Push schema (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run db:push
```

From the monorepo root:

```sh
bun db:generate

# Browse local dev tables (loads apps/api/.env; stop the API first for PGlite)
bun db:browser:school
bun db:browser:auth
```

Apply migrations with `@edaya/neon-migrations` (`bun db:migrate`, `bun db:migrate:dev`).

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

`@edaya/betterauth-d1-migrations` also has a `session` table for auth sessions. The school `sessions` table in this package is for **class scheduling** — unrelated to Better Auth.

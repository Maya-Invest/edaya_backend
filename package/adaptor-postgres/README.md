# @edaya/adaptor-postgres

Portable Postgres persistence for EDAYA: Drizzle schema, SQL migrations, and repository implementations.

Migration apply scripts for Neon / Hyperdrive live in `tooling/repo/db/school`. Identity migration commands live in `tooling/repo/db/identity`.

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
```

Apply migrations with `tooling/repo/db/school` (`bun repo db migrate staging`, `bun repo db migrate production`).

## Runtime usage

`DATABASE_URL` forms:

| Value | PGlite mode |
|-------|-------------|
| `pglite`, `memory`, `memory://` | In-memory (tests) |
| `pglite:.data/school`, `file://…` | Persisted filesystem directory |
| `postgres://…` | Real Postgres (app/Worker: `node-postgres` / `pg`; CLI migrate: `postgres-js`) |

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

## School-scoped repositories

`PostgresStore.forSchool(schoolId)` returns a repository bound to a trusted school without changing the original store. Pass an authenticated school context, never a school ID taken directly from an unvalidated request. The original stores remain privileged for internal orchestration.

`src/lib/school-scope.ts` defines direct and indirect ownership paths. Scoped reads compose this predicate with caller filters before pagination; counts stay in SQL. Scoped upserts check proposed ownership and conflict-row ownership in the write statement. Batch saves run transactionally. These constraints enforce school ownership; callers still need permission checks, business validation and actor-specific resource authorization.

When adding an indirectly owned table, add its ownership path and exercise its scoped reads/writes. Unclassified tables without a school ownership predicate cannot be bound. Custom store overrides must preserve the shared scope; notification templates and invitations retain their custom mapping/update behavior through this boundary.

The school `sessions` table in this package is for **class scheduling**. Authentication persistence is owned by the sibling Central Identity service and database.

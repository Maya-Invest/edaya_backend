# @edaya/adaptor-postgres

Portable Postgres persistence for EDAYA: Drizzle schema, SQL migrations, and repository implementations.

Migration apply scripts for Neon / Hyperdrive live in `@edaya/neon-migrations`.

## Scripts

```sh
# Generate SQL migration from schema changes
bun run db:generate

# Push schema or open Drizzle Studio (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run db:push
DATABASE_URL=postgres://... bun run db:studio
```

From the monorepo root:

```sh
bun db:generate
```

Apply migrations with `@edaya/neon-migrations` (`bun db:migrate`, `bun db:migrate:dev`).

## Runtime usage

```ts
import {
  PostgresSchoolRepositories,
  resolveMigrationDriver,
  runMigrations,
} from '@edaya/adaptor-postgres'

await runMigrations(db, { driver: resolveMigrationDriver(databaseUrl) })

const repos = new PostgresSchoolRepositories(db)
await repos.init({ driver: resolveMigrationDriver(databaseUrl) })
```

## Naming note

`@edaya/betterauth-d1-migrations` also has a `session` table for auth sessions. The school `sessions` table in this package is for **class scheduling** — unrelated to Better Auth.

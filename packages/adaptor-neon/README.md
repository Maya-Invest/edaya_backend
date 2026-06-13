# @edaya/adaptor-neon

Neon Postgres persistence for EDAYA: Drizzle schema, SQL migrations, repository implementations, and migration scripts.

## Scripts

```sh
# Generate SQL migration from schema changes
bun run db:generate

# Apply school schema migrations (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run db:migrate

# Apply school + Better Auth migrations
DATABASE_URL=postgres://... bun run db:migrate:all

# Load apps/api/.dev.vars and migrate the Hyperdrive origin DB
bun run db:migrate:dev
```

From the monorepo root:

```sh
bun db:generate
bun db:migrate
bun db:migrate:all
bun db:migrate:dev
```

Auth migrations live in `@edaya/adaptor-betterauth`. `db:migrate:all` and `db:migrate:dev` apply both adaptors against the same database.

## Runtime usage

```ts
import {
  PostgresSchoolRepositories,
  resolveMigrationDriver,
  runMigrations,
} from '@edaya/adaptor-neon'

await runMigrations(db, { driver: resolveMigrationDriver(databaseUrl) })

const repos = new PostgresSchoolRepositories(db)
await repos.init({ driver: resolveMigrationDriver(databaseUrl) })
```

## Naming note

`@edaya/adaptor-betterauth` also has a `session` table for auth sessions. The school `sessions` table in this package is for **class scheduling** — unrelated to Better Auth.

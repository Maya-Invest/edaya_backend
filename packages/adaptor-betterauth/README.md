# @edaya/adaptor-betterauth

Better Auth persistence for EDAYA: Drizzle schema, SQL migrations, and migration helpers.

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

## Tables

| Table | Purpose |
|-------|---------|
| `user` | Better Auth identity |
| `session` | Active auth sessions (not school class `sessions`) |
| `account` | Credential / OAuth provider links |
| `verification` | Email verification and password-reset tokens |

**Naming note:** `@edaya/adaptor-postgres` also has a `sessions` table for **class scheduling**. That is unrelated to Better Auth's `session` table.

## Scripts

```sh
# Regenerate Drizzle schema after Better Auth plugin changes
bun run auth:generate-schema

# Generate SQL migration from schema changes
bun run db:generate

# Apply migrations to DATABASE_URL (Postgres only)
DATABASE_URL=postgres://... bun run db:migrate
```

From the monorepo root:

```sh
bun auth:generate-schema
bun db:generate:auth
bun db:migrate:auth
```

Auth and school migrations share the default Drizzle journal (`drizzle.__drizzle_migrations`) on the same database — use `bun db:migrate:auth` or `runMigrations()` interchangeably.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-betterauth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

await runMigrations(db, { driver: 'pglite' })

betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  // ...
})
```

## Schema upgrades

When bumping `better-auth`:

1. Update the dependency version
2. Run `bun run auth:generate-schema` and review `src/schema.ts`
3. Run `bun run db:generate` and review the new SQL migration
4. Commit schema + migration together

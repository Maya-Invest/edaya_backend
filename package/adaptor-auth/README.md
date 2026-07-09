# @edaya/adaptor-auth

Better Auth persistence for EDAYA: Drizzle schema, SQL migrations, and runtime `runMigrations()` for Postgres (Neon / Hyperdrive / PGlite).

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

Migration apply scripts live in `@edaya/db-migrate` (`tooling/db-migrate`).

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Postgres via Hyperdrive (`auth` schema on the school Neon DB) |
| **Node dev / tests** | Same PGlite/Postgres database as school (`auth` schema) |

```sh
bun run auth:generate-schema   # Regenerate Drizzle schema after Better Auth plugin changes
bun run auth:db:generate       # Generate SQL migration from schema changes (requires DATABASE_URL)
```

From the monorepo root: `bun repo db generate --auth`, `bun repo db generate --auth`.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

await runMigrations(db, { driver: 'pglite' }) // PGlite local/tests
// or { driver: 'postgres-js' } with drizzle-orm/postgres-js

betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
    schemaName: 'auth',
  }),
  // ...
})
```

**Naming note:** `@edaya/adaptor-postgres` has scheduling session tables in `public`. Better Auth tables live in the separate `auth` Postgres schema (`auth.user`, `auth.session`, …).

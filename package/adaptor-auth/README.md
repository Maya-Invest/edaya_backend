# @edaya/adaptor-auth

Better Auth persistence for EDAYA: Drizzle schema, SQL migrations, and runtime `runMigrations()` for D1/SQLite.

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

Migration apply scripts (Neon, Hyperdrive, Wrangler) live in `@edaya/db-migrate` (`tooling/db-migrate`).

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Cloudflare D1 (`AUTH_DB` binding) |
| **Node dev** | Local SQLite file (default `.data/auth.sqlite`) |

```sh
bun run auth:generate-schema   # Regenerate Drizzle schema after Better Auth plugin changes
bun run auth:db:generate       # Generate SQL migration from schema changes
```

From the monorepo root: `bun auth:generate-schema`, `bun db:generate:auth`.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

await runMigrations(db, { driver: 'sqlite' }) // Node local file
// or { driver: 'd1' } with drizzle-orm/d1

betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: authSchema,
  }),
  // ...
})
```

**Naming note:** `@edaya/adaptor-postgres` has a `sessions` table for **class scheduling**. That is unrelated to Better Auth's `session` table in `src/schema.ts`.

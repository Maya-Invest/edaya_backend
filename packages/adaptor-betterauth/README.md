# @edaya/adaptor-betterauth

Better Auth persistence for EDAYA: SQLite/D1 Drizzle schema, SQL migrations, and migration helpers.

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

Auth data is stored separately from the school database:

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Cloudflare D1 (`AUTH_DB` binding) |
| **Node dev** | Local SQLite file (default `.data/auth.sqlite`) |

## Tables

| Table | Purpose |
|-------|---------|
| `user` | Better Auth identity |
| `session` | Active auth sessions (not school class `sessions`) |
| `account` | Credential / OAuth provider links |
| `verification` | Email verification and password-reset tokens |

**Naming note:** `@edaya/adaptor-neon` also has a `sessions` table for **class scheduling**. That is unrelated to Better Auth's `session` table.

## Scripts

```sh
# Regenerate Drizzle schema after Better Auth plugin changes
bun run auth:generate-schema

# Generate SQL migration from schema changes
bun run db:generate

# Apply migrations to local D1 (wrangler dev)
bun run db:migrate:local

# Apply migrations to remote D1 (production database)
bun run db:migrate:remote
```

From the monorepo root:

```sh
bun auth:generate-schema
bun db:generate:auth
bun db:migrate:auth          # local D1
bun db:migrate:auth:remote   # remote D1
```

School data migrations stay in `@edaya/adaptor-neon`. `bun db:migrate:dev` applies Neon school migrations plus local D1 auth migrations.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-betterauth'
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

## Schema upgrades

When bumping `better-auth`:

1. Update the dependency version
2. Run `bun run auth:generate-schema` and review `src/schema.ts`
3. Run `bun run db:generate` and review the new SQL migration
4. Apply with `db:migrate:local` / `db:migrate:remote`
5. Commit schema + migration together

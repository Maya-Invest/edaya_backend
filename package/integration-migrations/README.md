# @edaya/integration-migrations

Database migration tooling for EDAYA: school Postgres (Neon / Hyperdrive) and Better Auth D1/SQLite.

| Area | Schema source | SQL migrations | Apply |
|------|---------------|----------------|-------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` | `school:migrate*` scripts |
| **Auth** | `src/auth/schema.ts` | `drizzle/auth/` | `auth:migrate*` scripts + `runMigrations()` |

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

## School migrations

SQL migrations live in `@edaya/adaptor-postgres`. This package orchestrates how they are applied.

```sh
# Apply school schema migrations (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run school:migrate

# Apply school + Better Auth D1 migrations (local dev bootstrap)
DATABASE_URL=postgres://... bun run school:migrate:all

# Load apps/api/.dev.vars and migrate Hyperdrive origin DB (+ local D1 auth)
bun run school:migrate:dev
```

From the monorepo root: `bun db:migrate`, `bun db:migrate:all`, `bun db:migrate:dev`, `bun db:migrate:staging`.

Schema generation stays in `@edaya/adaptor-postgres` (`bun db:generate`).

## Auth migrations

Better Auth persistence on D1/SQLite: Drizzle schema, SQL migrations, runtime migrate helpers, and Wrangler deploy scripts.

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Cloudflare D1 (`AUTH_DB` binding) |
| **Node dev** | Local SQLite file (default `.data/auth.sqlite`) |

```sh
bun run auth:generate-schema   # Regenerate Drizzle schema after Better Auth plugin changes
bun run auth:db:generate       # Generate SQL migration from schema changes
bun run auth:migrate:local     # Apply migrations to local D1 (wrangler dev)
bun run auth:migrate:remote    # Apply migrations to remote D1 (production)
```

From the monorepo root: `bun auth:generate-schema`, `bun db:generate:auth`, `bun db:migrate:auth`, `bun db:migrate:auth:remote`.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/integration-migrations'
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

**Naming note:** `@edaya/adaptor-postgres` has a `sessions` table for **class scheduling**. That is unrelated to Better Auth's `session` table in `src/auth/schema.ts`.

# @edaya/adaptor-auth

Better Auth persistence for EDAYA: Drizzle schema, SQL migrations, and runtime `runMigrations()` for Postgres (Neon / Hyperdrive / PGlite).

Runtime Better Auth configuration (secrets, `baseURL`, plugins) lives in `apps/api`.

Migration apply scripts live in `@edaya/db-migrate` (`tooling/db-migrate`).

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Authoritative Postgres through a cache-disabled auth connection; no KV session authority |
| **Node dev / tests** | Same PGlite/Postgres database as school (`auth` schema) |

```sh
bun run auth:generate-schema   # Generate a review file using auth@1.7.3; does not overwrite src/schema.ts
bun run auth:db:generate       # Generate SQL migration from schema changes (requires DATABASE_URL)
```

Review `generated-provider-schema.ts`, merge provider model changes into `src/schema.ts`, preserve Edaya tables and timezone-aware timestamps, then generate an additive migration. The CLI package was renamed to `auth` in Better Auth 1.7 ([CLI documentation](https://better-auth.com/docs/concepts/cli)). Never apply the generated provider file directly over the maintained schema.

`src/adapters/access-tokens.ts` stores only access-token digests and checks the live provider session. `auth-transactions.ts` gives protocol mutations a database transaction and cross-instance lock separate from school transactions. `delegation-grants.ts` stores selected children/scopes and checks client/grant expiry and revocation; the caller must additionally validate current school relationships. `oauth-clients.ts` is the operator-only registry adapter. Keep its mutations in the same auth transaction boundary as grant revocation.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

await runMigrations(db, { driver: 'pglite' }) // PGlite local/tests
// or { driver: 'node-postgres' } with drizzle-orm/node-postgres (Worker / Hyperdrive)
// or { driver: 'postgres-js' } with drizzle-orm/postgres-js (CLI migrate tooling)

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

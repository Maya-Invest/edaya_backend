# @edaya/adaptor-auth

Better Auth persistence for EDAYA: Drizzle schema, SQL migrations, and runtime `runMigrations()` for Postgres (Neon / Hyperdrive / PGlite).

Runtime Better Auth configuration (secrets, `baseURL`, plugins, first-party JWT issuance) lives in `apps/api/src/identity`, inside `apps/api`. The unified API opens this separate database only for Account operations.

Migration apply scripts live in `tooling/repo/db/identity` (`bun repo identity-migrate`).

| Runtime | Auth storage |
|---------|----------------|
| **Worker** | Authoritative Postgres through a cache-disabled Hyperdrive auth connection; no KV session authority |
| **Node dev / tests** | Local PGlite at `.data/identity` (not shared with school) |

```sh
bun run auth:generate-schema   # Generate a review file using auth@1.7.3; does not overwrite src/schema.ts
bun run auth:db:generate       # Generate SQL migration from schema changes (requires DATABASE_URL)
```

Review `generated-provider-schema.ts`, merge provider model changes into `src/schema.ts`, preserve Edaya tables and timezone-aware timestamps, then generate an additive migration. The CLI package was renamed to `auth` in Better Auth 1.7 ([CLI documentation](https://better-auth.com/docs/concepts/cli)). Never apply the generated provider file directly over the maintained schema.

`src/adapters/access-tokens.ts` stores rate-limit buckets and session revocation helpers. First-party access tokens are compact JWTs signed in `apps/api/src/identity`. `auth-transactions.ts` gives protocol mutations a database transaction and cross-instance lock separate from school transactions.

## Usage

```ts
import { authSchema, runMigrations } from '@edaya/adaptor-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

await runMigrations(db, { driver: 'pglite' }) // PGlite local/tests (`.data/identity`)
// or { driver: 'postgres-js' } with drizzle-orm/postgres-js (CLI migrate + identity process)
// Worker skips startup migrations; apply them with `bun repo db migrate`.

betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
    schemaName: 'auth',
  }),
  // ...
})

```

**Naming note:** School Postgres (`@edaya/adaptor-postgres` in `edaya_backend`) has scheduling session tables in `public`. Better Auth tables live in this identity database's `auth` schema (`auth.user`, `auth.session`, …).

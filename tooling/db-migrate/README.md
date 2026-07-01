# @edaya/db-migrate

Database migration CLI for EDAYA: school Postgres (Neon / Hyperdrive) and Better Auth D1/SQLite apply scripts.

| Area | Schema source | SQL migrations | Apply |
|------|---------------|----------------|-------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` | `school:migrate*` scripts |
| **Auth** | `@edaya/adaptor-auth` | `package/adaptor-auth/drizzle/auth/` | `auth:migrate*` scripts |

## School migrations

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

```sh
bun run auth:migrate:local     # Apply migrations to local D1 (wrangler dev)
bun run auth:migrate:remote    # Apply migrations to remote D1 (production)
```

From the monorepo root: `bun db:migrate:auth`, `bun db:migrate:auth:remote`, `bun db:migrate:auth:staging`.

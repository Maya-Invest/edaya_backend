# @edaya/db-migrate

Database migration CLI for EDAYA: school Postgres (Neon / Hyperdrive) and Better Auth Postgres (`auth` schema).

| Area | Schema source | SQL migrations |
|------|---------------|----------------|
| **School** | `@edaya/adaptor-postgres` | `package/adaptor-postgres/drizzle/` |
| **Auth** | `@edaya/adaptor-auth` | `package/adaptor-auth/drizzle/auth/` |

## Commands (package)

```sh
# School schema only (requires DATABASE_URL=postgres://…)
bun run migrate

# School + auth on DATABASE_URL
DATABASE_URL=postgres://… bun run migrate:full

# Hyperdrive origin from apps/api/.dev.vars (school + auth)
bun run migrate:hyperdrive

# Neon staging branch (school + auth; loads tooling/seeding/.env.staging)
bun run migrate:staging

# Auth schema only — package maintainer / PGlite repair (loads apps/api/.env)
bun run migrate:auth
```

From the monorepo root: `bun db:migrate`, `bun db:migrate:full`, `bun db:migrate:hyperdrive`, `bun db:migrate:staging`.

Local PGlite (`bun dev`) applies both schemas on startup — no migrate command needed.

Schema generation: `bun db:generate` (school), `bun db:generate:auth` / `bun auth:generate-schema` (auth).

**Deprecated root aliases:** `db:migrate:all` → `db:migrate:full`, `db:migrate:dev` → `db:migrate:hyperdrive`.

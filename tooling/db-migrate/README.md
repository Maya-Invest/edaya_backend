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

# School + auth on DATABASE_URL (includes legacy staff-access cutover when needed)
DATABASE_URL=postgres://… bun run migrate:full

# Legacy staff access → staff_permission_assignments only (Postgres; run before 0038 on existing DBs)
DATABASE_URL=postgres://… bun run migrate:staff-access

# Neon staging branch (school + auth; loads tooling/seeding/.env.staging)
bun run migrate:staging

# Neon production branch (school + auth; loads tooling/seeding/.env.production)
bun run migrate:production

# Auth schema only — package maintainer / PGlite repair (loads apps/api/.env)
bun run migrate:auth
```

From the monorepo root: `bun db:migrate`, `bun db:migrate:full`, `bun db:migrate:production`, `bun db:migrate:staging`.

Local PGlite (`bun dev`) applies both schemas on startup — no migrate command needed. Fresh PGlite databases have no legacy access rows; migration `0038` only drops empty legacy tables.

### Staff permission model cutover (existing Postgres)

For databases that still have `access_roles` / `staff_role_assignments`:

1. `bun run db:migrate:full` (or `migrate:staging` / `migrate:production`) — applies schema through `0037`, runs `migrate-staff-access-to-permissions`, then applies `0038`+ and auth migrations.
2. Or manually: `bun run db:migrate:staff-access` then `bun run db:migrate` — only when `0036`/`0037` are already applied and `0038` is not.

`USE_STAFF_PERMISSION_ASSIGNMENTS` was removed — grant resolution always uses `staff_permission_assignments`.

Schema generation: `bun db:generate` (school), `bun db:generate:auth` / `bun auth:generate-schema` (auth).

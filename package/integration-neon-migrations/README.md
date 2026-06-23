# @edaya/neon-migrations

Apply school Postgres schema migrations on Neon / Hyperdrive origin databases.

SQL migrations live in `@edaya/adaptor-postgres` (`package/adaptor-postgres/drizzle/`). This package orchestrates how they are applied in each environment.

## Scripts

```sh
# Apply school schema migrations (requires DATABASE_URL)
DATABASE_URL=postgres://... bun run migrate

# Apply school + Better Auth D1 migrations (local dev bootstrap)
DATABASE_URL=postgres://... bun run migrate:all

# Load apps/api/.dev.vars and migrate the Hyperdrive origin DB (+ local D1 auth)
bun run migrate:dev
```

From the monorepo root:

```sh
bun db:migrate
bun db:migrate:all
bun db:migrate:dev
```

Schema generation stays in `@edaya/adaptor-postgres` (`bun db:generate`). Auth D1 migrations live in `@edaya/betterauth-d1-migrations`.

## drizzle-kit config

`drizzle.config.ts` points at `package/adaptor-postgres` for schema and migration output paths. Run `migrate` from this package directory (or via root scripts) with `DATABASE_URL` set to the target Postgres connection string.

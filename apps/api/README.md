# Edaya API

Hono API for Edaya Core (`@edaya/api`).

## Local development

**Local runtime** (default):

```sh
cp .env.example .env   # from apps/api
bun dev                # http://localhost:9999
```

**Worker runtime** (Cloudflare):

```sh
cp .dev.vars.example .dev.vars
bun run dev:worker
```

OpenAPI reference (Core + Better Auth): http://localhost:9999/reference

GraphiQL (local entity queries): http://localhost:9999/graphiql — requires an authenticated Better Auth session cookie.

### GraphiQL auth

GraphQL uses the same auth as REST (`actor` from Better Auth session or `Authorization: Bearer` service account key).

1. **Sign in on the GraphiQL page** — use the email/password form at http://localhost:9999/graphiql (`POST /graphiql/login`, dev-only wrapper around Better Auth).
2. **Session cookie** — sign in via the webapp (http://localhost:5173), then open GraphiQL.
3. **Service account** — set `GRAPHQL_DEV_API_KEY` in `apps/api/.env` to the school profile `seedingApiKey` from `@edaya/dev-fixtures` for auto-injected Bearer auth locally, or add it manually in GraphiQL's **Headers** panel.

Default dev credentials (after `bun run seed:auth:link`): `c.moreau@school.edu` / `DevPassword1!` (director staff). Guardian example: `c.dubois@mail.com`.

Set `RUNTIME=local` in `.env` (default). School data and auth SQLite live under repo-root `.data/` (gitignored). Startup migrations run automatically for PGlite; Postgres on the local profile requires `RUN_MIGRATIONS_ON_STARTUP=true`. Tests use `RUNTIME=in-memory` with ephemeral PGlite. Workers require a real Postgres URL.

## Build & deploy

| Target | Command | Output |
|--------|---------|--------|
| **Node** | `bun run build` then `bun start` | `dist/node.js` (bundles workspace packages) |
| **Worker** | `bun run deploy:worker` | Wrangler bundles `src/entries/worker.ts` → `api.edaya.softilab.dev` |

Before first production deploy:

1. Apply school migrations to the Hyperdrive origin DB: `bun run db:migrate:dev` (from repo root)
2. Apply Better Auth migrations to D1: `bun run db:migrate:auth:remote`
3. Set `BETTER_AUTH_SECRET`: `wrangler secret put BETTER_AUTH_SECRET --env production`
4. Dry-run: `bun run deploy:worker:dry-run`
5. Deploy: `bun run deploy:worker`

See [docs/local-dev.md](../../docs/local-dev.md) and [docs/api-runtimes.md](../../docs/api-runtimes.md).

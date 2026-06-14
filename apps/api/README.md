# Edaya API

Hono API for Edaya Core (`@edaya/api`).

## Local development

**Node runtime** (default):

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

Default `DATABASE_URL=pglite:.data/school` uses persisted PGlite on Node (no Docker). School data and auth SQLite live under `apps/api/.data/` (gitignored). Use `DATABASE_URL=pglite` for ephemeral in-memory (tests). Workers require a real Postgres URL.

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

See [docs/done/local-dev.md](../../docs/done/local-dev.md) and [docs/done/api-runtimes.md](../../docs/done/api-runtimes.md).

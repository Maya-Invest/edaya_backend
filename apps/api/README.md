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

Default `DATABASE_URL=pglite` uses in-memory Postgres on Node only (no Docker). Dev data is auto-seeded on startup; run `bun run seed` to seed manually.

## Build & deploy

| Target | Command | Output |
|--------|---------|--------|
| **Node** | `bun run build` then `bun start` | `dist/node.js` (bundles workspace packages) |
| **Worker** | `bun run deploy:worker` | Wrangler bundles `src/entries/worker.ts` → `api.edaya.softilab.dev` |

Before first production deploy:

1. Apply school migrations to the Hyperdrive origin DB: `bun run db:migrate:dev`
2. Apply Better Auth migrations to D1: `bun run db:migrate:auth:remote`
3. Set `BETTER_AUTH_SECRET`: `wrangler secret put BETTER_AUTH_SECRET --env production`
4. Dry-run: `bun run deploy:worker:dry-run`
5. Deploy: `bun run deploy:worker`

See [docs/local-dev.md](../../docs/local-dev.md) and [docs/done/api-runtimes.md](../../docs/done/api-runtimes.md).

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

OpenAPI reference: http://localhost:9999/reference

Default `DATABASE_URL=pglite` uses in-memory Postgres on Node only (no Docker). Dev data is auto-seeded on startup; run `bun run seed` to seed manually.

See [docs/local-dev.md](../../docs/local-dev.md) and [docs/api-runtimes.md](../../docs/api-runtimes.md).

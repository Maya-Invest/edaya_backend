# Edaya API

Hono school API (`@edaya/api`). Central login lives in sibling **edaya_identity**, not in this process.

## Local development

**Local runtime** (default — from repo root):

```sh
cp .env.example .env   # from apps/api
# identity must already be running on :9900
bun repo dev           # http://localhost:9999 + local-files on :9200
```

`bun repo dev` at the repo root is required for file uploads. `cd apps/api && bun repo dev` starts the API only (no local-files).

**Worker smoke** (optional — Miniflare against staging Neon/R2):

```sh
cp .dev.vars.example .dev.vars
bun run dev:worker
```

Production worker profile: deploy only (`bun run deploy:production` from `apps/api`, or `bun repo deploy api production` from repo root). For rare prod Miniflare debugging: `cd apps/api && wrangler dev --env prod --env-file .dev.vars`.

OpenAPI reference (school API): http://localhost:9999/reference

GraphiQL (local entity queries): http://localhost:9999/graphiql — requires an identity JWT (or a service-account Bearer key).

### GraphiQL auth

GraphQL uses the same auth as REST (`actor` from an identity JWT or `Authorization: Bearer` service-account key). Host-only Better Auth cookies stay on the identity origin.

1. **Sign in on the GraphiQL page** — email/password form at http://localhost:9999/graphiql (`POST /graphiql/login`). That proxies to identity `/auth/sign-in/email` and returns a school-audience access token.
2. **Service account** — set `GRAPHQL_DEV_API_KEY` in `apps/api/.env` to the school profile `seedingApiKey` from `@edaya/fixtures` for auto-injected Bearer auth locally, or add it manually in GraphiQL's **Headers** panel.

Default demo credentials (after `bun repo seed` with identity running): `a.kone@ecole-ci.edaya.dev` / `DevPassword1!` (Cocody owner). See [edaya_web demo accounts](../../../edaya_web/docs/reference/demo-accounts.md).

`RUNTIME=local` uses persisted school PGlite (`.data/school`). Identity users live in the identity database (`.data/identity` in `edaya_identity`). Tests use `RUNTIME=in-memory` with ephemeral school storage. Vendor adaptors (Hyperdrive Postgres, R2) are for `RUNTIME=worker` via optional staging smoke or deploy.

See [docs/reference/runtime-boundaries.md](../../docs/reference/runtime-boundaries.md).

## Build & deploy

| Target     | Command                     | Output                                                         |
| ---------- | --------------------------- | -------------------------------------------------------------- |
| **Worker** | `bun run deploy:production` | Wrangler bundles `src/entries/worker.ts` → `api.school.edayaplus.com` |

`bun run build` produces a Node bundle of the **local** entry (`dist/node.js`) for CI/typecheck only — not used in production deploy.

Before first production deploy:

1. Migrate the Hyperdrive origin Neon DB (school schema only): `bun repo db migrate production` (from repo root). Identity migrations run from `edaya_identity`.
2. Upload secrets: `cp secrets.json.example secrets.prod.json` then `bunx wrangler secret bulk secrets.prod.json --env prod`
3. Dry-run: `bun run deploy:production:dry-run`
4. Deploy: `bun run deploy:production` (or `bun repo deploy api production` from repo root)

See [docs/reference/local-dev.md](../../docs/reference/local-dev.md) and [docs/reference/api-runtimes.md](../../docs/reference/api-runtimes.md).

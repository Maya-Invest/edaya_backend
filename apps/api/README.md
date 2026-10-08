# Edaya API

See [API configuration and secrets](../../docs/reference/api-configuration.md) for JSONC settings, secrets-only files, and the `bun repo vars` commands.

Hono API for Edaya Core (`@edaya/api`).

## Local development

**Local runtime** (default — from repo root):

```sh
cp .env.example .env   # from apps/api
bun repo dev                # http://localhost:9999 + local-files on :9200
```

`bun repo dev` at the repo root is required for file uploads. `cd apps/api && bun repo dev` starts the API only (no local-files).

**Worker smoke** (optional — Miniflare against staging Neon/R2):

```sh
cp .dev.vars.example .dev.vars
bun run dev:worker
```

Production worker profile: deploy only (`bun run deploy:production` from `apps/api`, or `bun repo deploy api production` from repo root). Normal deployments preserve variables. Update them separately with `bun repo vars push api production`.

OpenAPI reference (Core + Better Auth): http://localhost:9999/reference

GraphiQL (local entity queries): http://localhost:9999/graphiql — requires an authenticated Better Auth session cookie.

### GraphiQL auth

GraphQL uses the same auth as REST (`actor` from Better Auth session or `Authorization: Bearer` service account key).

1. **Sign in on the GraphiQL page** — use the email/password form at http://localhost:9999/graphiql (`POST /graphiql/login`, dev-only wrapper around Better Auth).
2. **Session cookie** — sign in via the webapp (http://localhost:5173), then open GraphiQL.
3. **Service account** — set `GRAPHQL_DEV_API_KEY` in `apps/api/.env` to the school profile `seedingApiKey` from `@edaya/fixtures` for auto-injected Bearer auth locally, or add it manually in GraphiQL's **Headers** panel.

Default dev credentials (after `bun repo seed --scope auth:link`): `c.moreau@school.edu` / `DevPassword1!` (director staff). Guardian example: `c.dubois@mail.com`.

`RUNTIME=local` uses persisted PGlite (`.data/school`) with Better Auth in the `auth` schema. Tests use `RUNTIME=in-memory` with ephemeral storage. Vendor adaptors (Hyperdrive Postgres, R2) are for `RUNTIME=worker` via optional staging smoke or deploy.

See [docs/reference/runtime-boundaries.md](../../docs/reference/runtime-boundaries.md).

## Build & deploy

| Target     | Command                     | Output                                                         |
| ---------- | --------------------------- | -------------------------------------------------------------- |
| **Worker** | `bun run deploy:production` | Wrangler bundles `src/entries/worker.ts` → `api.edayaplus.com` |

Bun runs the local TypeScript entry directly. Wrangler bundles the Worker entry for deployment. CI validates both staging and production bundles with `bun run deploy:staging:dry-run` and `bun run deploy:production:dry-run`; these commands do not deploy. Use `bun run check` for API type checking. The repository-root `bun run build` builds the generated API-client package.

Before first production deploy:

1. Migrate the Hyperdrive origin Neon DB (school + auth): `bun repo db migrate production` (from repo root)
2. Apply `config.production.jsonc` using `bun repo vars push api production` from the repository root. Upload secrets: `cp secrets.json.example secrets.prod.json` then `bunx wrangler secret bulk secrets.prod.json --env prod`
3. Dry-run: `bun run deploy:production:dry-run`
4. Deploy: `bun run deploy:production` (or `bun repo deploy api production` from repo root)

See [docs/reference/local-dev.md](../../docs/reference/local-dev.md) and [docs/reference/api-runtimes.md](../../docs/reference/api-runtimes.md).

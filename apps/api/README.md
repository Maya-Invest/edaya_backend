# EDaya API

See [API configuration and secrets](../../docs/reference/api-configuration.md) for JSONC settings, secrets-only files, and the `bun repo ops vars` commands.

Hono API for EDaya Core (`@edaya/api`).

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

Production worker profile: deploy only (`bun run deploy:production` from `apps/api`, or `bun repo ops emergency-deploy production --yes` from repo root). Normal deployments preserve variables. Update them separately with `bun repo ops vars push production`.

OpenAPI reference (Core + Better Auth): http://localhost:9999/reference

School queries and commands use REST under `/core`, documented in the OpenAPI reference. Authenticate with a school access token or a service-account Bearer key.

Default dev credentials (after `bun repo ops seed --scope auth:link`): `c.moreau@school.edu` / `DevPassword1!` (director staff). Guardian example: `c.dubois@mail.com`.

`RUNTIME=local` uses persisted PGlite (`.data/school`) with Better Auth in the `auth` schema. Tests use `RUNTIME=in-memory` with ephemeral storage. Vendor adaptors (Hyperdrive Postgres, R2) are for `RUNTIME=worker` via optional staging smoke or deploy.

See [docs/reference/runtime-boundaries.md](../../docs/reference/runtime-boundaries.md).

## Build & deploy

| Target     | Command                     | Output                                                         |
| ---------- | --------------------------- | -------------------------------------------------------------- |
| **Worker** | `bun run deploy:production` | Wrangler bundles `src/entries/worker.ts` → `api.edayaplus.com` |

Bun runs the local TypeScript entry directly. Wrangler bundles the Worker entry for deployment. CI validates both staging and production bundles with `bun run deploy:staging:dry-run` and `bun run deploy:production:dry-run`; these commands do not deploy. Use `bun run check` for API type checking. The repository-root `bun run build` builds the generated API-client package.

Before first production deploy:

1. Migrate the Hyperdrive origin Neon DB (school + auth): `bun repo ops db migrate school production` (from repo root)
2. Apply `config.production.jsonc` using `bun repo ops vars push production` from the repository root. Upload secrets: `cp secrets.json.example secrets.prod.json` then `bunx wrangler secret bulk secrets.prod.json --env prod`
3. Dry-run: `bun run deploy:production:dry-run`
4. Deploy: `bun run deploy:production` (or `bun repo ops emergency-deploy production --yes` from repo root)

See [docs/reference/local-dev.md](../../docs/reference/local-dev.md) and [docs/reference/api-runtimes.md](../../docs/reference/api-runtimes.md).

## Authentication terms publication

`GET /auth/edaya/terms?locale=fr|en` is public and returns `{ enforced, document }` with `Cache-Control: no-store`. Staging and production default to `live` (`NODE_ENV=production`). Other environments default to `off`; the checked-in local configuration enables `live`. An explicit `off` disables new acceptance prompts without deleting receipts or revoking sessions. `preview` and `enforced` are aliases for `live`. `AUTH_TERMS_VERSION` is accepted for compatibility and ignored.

The live policy reads the published [French](https://edayaplus.com/conditions-utilisation/) and [English](https://edayaplus.com/en/terms/) legal documents. Update those pages to publish a change. The API retains only legal content and safe links; the optional `html` fragment and existing plain-text `sections` represent the same localized document. `sourceUrl` identifies its public page. A SHA-256 hash identifies each normalized document, and both hashes determine the shared acceptance version. A wording or link change in either language updates the version; changes to surrounding site navigation or styling do not.

The API caches a successful translation pair for five minutes per process or Worker isolate. Both documents must be readable within five seconds on refresh; a failed refresh returns `503 terms_unavailable` and blocks new sign-ins until a retry succeeds. Existing sessions and challenges remain usable. Deploy the backend before the staff iframe reader; no new identity migration is needed. Every client that starts a fresh OTP must submit the version the user accepted, including Spark parent login. Roll out compatible clients before turning on enforcement for their users; an explicit `off` override supports a staged deployment.

OTP-start accepts `termsAcceptance: { version, locale, accepted: true }`. The service validates it before delivery, pins server-owned document hashes across resends and MFA, and inserts the first account/version receipt in the successful session transaction. The durable receipt stores account ID, version, displayed locale, hash and server completion timestamp; it collects no extra IP or user-agent history.

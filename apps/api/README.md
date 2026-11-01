# Edaya API

See [API configuration and secrets](../../docs/reference/api-configuration.md) for JSONC settings, secrets-only files, and the `bun repo ops vars` commands.

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

`GET /auth/edaya/terms?locale=fr|en` returns `{ enforced, document }` without authentication. `AUTH_TERMS_MODE=off` is the default and returns no published document. Terms reads use `Cache-Control: no-store`. `preview` displays the bilingual draft from `src/identity/terms-draft.ts` and exercises acceptance only outside production. Production rejects preview mode. Draft receipts in preview environments are test evidence, not acceptance of a published agreement.

Before production publication, replace every draft placeholder and approve both translations. Add a new immutable published version to the registry in `src/identity/terms-policy.ts`; never edit or remove previously published versions. Set `AUTH_TERMS_MODE=enforced` and `AUTH_TERMS_VERSION` to that approved entry. The runtime rejects missing versions, draft documents and placeholders. This repository intentionally ships no approved terms.

Apply Account migration `0002_terms_acceptance` to the identity database, deploy backend support with enforcement off, then regenerate and release matching web/mobile clients. Enable enforcement only after the approved document and compatible clients are available. Older clients cannot start a fresh login when enforcement is enabled. Existing sessions and in-progress challenges remain usable. Reverting to `off` stops new acceptance prompts without deleting receipts or revoking sessions.

OTP-start accepts `termsAcceptance: { version, locale, accepted: true }`. The service validates it before delivery, pins server-owned document hashes across resends and MFA, and inserts the first account/version receipt in the successful session transaction. The durable receipt stores account ID, version, displayed locale, hash and server completion timestamp; it collects no extra IP or user-agent history.

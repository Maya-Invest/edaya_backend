# Deploy staging

Isolated Cloudflare staging environment for validating deploys before production. See [staging-environment-plan.md](../sprints/staging-environment-plan.md) for goals and architecture.

**Domains:** `api-staging.edaya.softilab.dev` · `app-staging.edaya.softilab.dev`

---

## One-time Cloudflare + Neon setup

Complete these steps once before the first staging deploy. **Do not reuse production Hyperdrive or D1 IDs.**

### 1. Neon staging branch

Create a dedicated branch (e.g. `staging`) in Neon. Store the connection string in your team secret manager.

### 2. Hyperdrive (staging)

Neon **staging** branch: `br-flat-union-ahedlz5i` on project `calm-brook-83532792` (edaya).

Create a Hyperdrive config from the Neon console connection string (staging branch, **not** production):

```sh
cd apps/api
bunx wrangler hyperdrive create edaya-staging \
  --connection-string="$STAGING_DATABASE_URL"
```

Copy the returned config `id` into `apps/api/wrangler.jsonc` → `env.staging.hyperdrive[0].id` (replace placeholder `…000001`).

**Do not commit** `STAGING_DATABASE_URL` — store it in `tooling/seeding/.env.staging` (gitignored) or your secret manager.

### 3. D1 auth database (staging)

**Created:** `edaya-auth-staging` · `database_id = 2e55cf53-1b89-453f-ac17-3aab83fd8488` (already in `wrangler.jsonc`).

Auth migrations applied:

```sh
bun run db:migrate:auth:staging
```

To recreate manually:

```sh
cd apps/api
bunx wrangler d1 create edaya-auth-staging
```

### 4. Custom domains

Attach routes in Cloudflare for:

| Host | Worker |
|------|--------|
| `api-staging.edaya.softilab.dev` | `edaya-api-staging` |
| `app-staging.edaya.softilab.dev` | `edaya-webapp-staging` |

Routes are declared in `wrangler.jsonc`; DNS/custom domains are configured in the Cloudflare dashboard on first deploy.

### 5. Wrangler secrets (API staging)

```sh
cd apps/api
bunx wrangler secret put BETTER_AUTH_SECRET --env staging
```

Use a **unique** `BETTER_AUTH_SECRET` for staging (not the production value).

---

## First-time bootstrap

```sh
# 1. School schema on Neon staging branch (includes 0014_service_accounts.sql)
STAGING_DATABASE_URL=postgres://… bun run db:migrate:staging

# 2. Better Auth D1 on staging
bun run db:migrate:auth:staging

# 3. Deploy API + webapp
bun run deploy:api:staging
bun run deploy:webapp:staging

# 4. Copy staging URLs (optional convenience file)
cp tooling/seeding/.env.staging.example tooling/seeding/.env.staging

# 5. Bootstrap school + seeding service account (director session on first run)
#    Optional fresh start after a failed/partial seed:
#    bun seed:clean:staging --yes
SEED_API_URL=https://api-staging.edaya.softilab.dev bun run seed:init

# 6. Full remote seed (uses school profile API key from @edaya/fixtures)
SEED_API_URL=https://api-staging.edaya.softilab.dev bun run seed:remote

# 7. Verify
bun run smoke:staging
# or lighter auth-only check:
bun run seed:smoke:staging
```

---

## Repeatable deploy checklist

### Local gate (every change)

```sh
bun run fullcheck   # includes openapi:check
```

### Staging deploy

```sh
STAGING_DATABASE_URL=postgres://… bun run db:migrate:staging   # when schema changed
bun run db:migrate:auth:staging                                 # when auth schema changed
bun run deploy:api:staging
bun run deploy:webapp:staging
SEED_API_URL=https://api-staging.edaya.softilab.dev bun run seed:remote   # if seed data needed
bun run smoke:staging
```

### Production promotion (after staging green)

```sh
bun run fullcheck
bun run deploy:api
bun run deploy:webapp
```

---

## Smoke checks (`bun run smoke:staging`)

Reads `tooling/seeding/.env.staging` when present, or env vars:

| Variable | Default |
|----------|---------|
| `STAGING_API_URL` | `https://api-staging.edaya.softilab.dev` |
| `STAGING_APP_ORIGIN` | `https://app-staging.edaya.softilab.dev` |
| `SMOKE_STAFF_EMAIL` | dev fixture director email |
| `SMOKE_STAFF_PASSWORD` | dev fixture password |

| ID | Check |
|----|-------|
| S1 | `GET /` health |
| S2 | `GET /doc` or `/reference` |
| S3 | CORS allows trusted app origin |
| S4 | CORS rejects unknown origin |
| S5 | Better Auth sign-in + session cookie |
| S6 | `GET /core/authorization/effective-grants` |
| S7 | Service account Bearer → entity list (school profile key) |
| S8 | Seeded school visible via Hyperdrive |

**Tier 2 (manual):** browser login on `app-staging…`, demo data in UI, Safari cross-subdomain cookies.

---

## Scripts reference

| Command | Description |
|---------|-------------|
| `bun run deploy:api:staging` | Deploy API Worker (`--env staging`) |
| `bun run deploy:webapp:staging` | Build with staging `PUBLIC_API_URL` + deploy |
| `bun run db:migrate:staging` | School migrations → `STAGING_DATABASE_URL` |
| `bun run db:migrate:auth:staging` | D1 auth migrations → staging D1 |
| `bun run seed:remote` | Full HTTP seed against `SEED_API_URL` |
| `bun run smoke:staging` | Tier 1 HTTP smoke against staging |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Deploy fails on Hyperdrive/D1 | Placeholder IDs still in `wrangler.jsonc` |
| S5 sign-in fails on seed | Auth users missing — re-run `seed:init` (provisions auth before session bootstrap) |
| `MISSING_OR_NULL_ORIGIN` on seed | Ensure `STAGING_APP_ORIGIN` is set in `tooling/seeding/.env.staging` (seed CLI sends it as `Origin`) |
| `sign-in 401 INVALID_EMAIL_OR_PASSWORD` + user exists | Stale D1 row from interrupted bootstrap — `seed:init` auto-deletes and recreates on staging (`SEED_AUTH_REPAIR_STALE=false` to disable) |
| `sign-in 503` / Worker exceeded resource limits | Redeploy API staging after auth lazy-load fix: `bun run deploy:api:staging` |
| `account_kind` does not exist | School migration `0014_service_accounts` not applied — run `db:migrate:staging` |
| `db:migrate:staging` succeeds but schema still old | Orphan row in `drizzle.__drizzle_migrations` with a future `created_at` blocks pending files — re-run `db:migrate:staging` (auto-repairs orphans) or delete unknown-hash rows manually |
| `waitForApi` timeout | API not deployed yet, or DNS still propagating — verify `curl https://api-staging…/` returns 200 |
| S6 401 | Staff not linked to auth subject — run `seed:init` / `seed:remote` |
| S8 missing school | School seed not applied; run `seed:remote` |
| Webapp calls wrong API | Rebuild webapp with `deploy:webapp:staging` (sets `PUBLIC_API_URL`) |
| CORS errors in browser | `TRUSTED_ORIGINS` must include exact app staging origin |

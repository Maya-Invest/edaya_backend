# Deploy staging

Isolated Cloudflare staging environment for validating deploys before production. See [staging-environment-plan.md](../sprints/staging-environment-plan.md) for goals and architecture.

**Domains:** `api-staging.edaya.softilab.dev` · `app-staging.edaya.softilab.dev`

---

## One-time Cloudflare + Neon setup

Complete these steps once before the first staging deploy. **Do not reuse production Hyperdrive IDs.**

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

**Do not commit** `STAGING_DATABASE_URL` — store it in repo root `.env` (gitignored) or your secret manager.

### 3. Custom domains

Attach routes in Cloudflare for:

| Host | Worker |
|------|--------|
| `api-staging.edaya.softilab.dev` | `edaya-api-staging` |
| `app-staging.edaya.softilab.dev` | `edaya-webapp-staging` |

Routes are declared in `wrangler.jsonc`; DNS/custom domains are configured in the Cloudflare dashboard on first deploy.

### 4. Wrangler secrets (API staging)

```sh
cd apps/api
cp secrets.json.example secrets.staging.json   # fill values
bunx wrangler secret bulk secrets.staging.json --env staging
# Or individually:
bunx wrangler secret put BETTER_AUTH_SECRET --env staging
```

Use a **unique** `BETTER_AUTH_SECRET` for staging (not the production value). Staging uses the **dev** Novu API key (same as local `.env`).

---

## First-time bootstrap

```sh
# 1. School + auth schema on Neon staging branch
STAGING_DATABASE_URL=postgres://… bun repo db migrate staging

# 2. Deploy API + webapp
bun repo deploy api staging
bun run deploy:webapp:staging

# 4. Configure seeding env (copy example, set remote URLs)
cp .env.example .env

# 5. Bootstrap school + seeding service account (director session on first run)
#    Optional fresh start after a failed/partial seed:
#    bun repo seed clean --staging --yes
bun repo seed --staging

# 6. Verify
bun repo smoke-test staging
```

---

## Repeatable deploy checklist

### Local gate (every change)

```sh
bun run verify   # includes check openapi
```

### Staging deploy

```sh
STAGING_DATABASE_URL=postgres://… bun repo db migrate staging   # when schema changed
bun repo db migrate staging                                      # school + auth schema when either changed
bun repo deploy api staging
bun run deploy:webapp:staging
bun repo seed --staging   # if seed data needed
bun repo smoke-test staging
```

### Production promotion (after staging green)

```sh
bun run verify
bun repo deploy api production
bun run deploy:webapp:production
```

---

## Smoke checks (`bun repo smoke-test staging`)

Reads repo root `.env` when present, or env vars:

| Variable | Default |
|----------|---------|
| `SEED_STAGING_API_URL` | `https://api-staging.edaya.softilab.dev` |
| `SEED_STAGING_APP_ORIGIN` | `https://app-staging.edaya.softilab.dev` |
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
| `bun repo deploy api staging` | Deploy API Worker (`--env staging`) |
| `bun run deploy:webapp:staging` | Build with staging `PUBLIC_API_URL` + deploy |
| `bun repo db migrate staging` | School + auth migrations → staging Neon (`STAGING_DATABASE_URL`) |
| `bun repo seed --staging` | Full HTTP seed against `SEED_STAGING_API_URL` |
| `bun repo smoke-test staging` | Tier 1 HTTP smoke against staging |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Deploy fails on Hyperdrive | Placeholder ID still in `wrangler.jsonc` |
| S5 sign-in fails on seed | Auth users missing — re-run `seed:init` (provisions auth before session bootstrap) |
| `MISSING_OR_NULL_ORIGIN` on seed | Ensure `SEED_STAGING_APP_ORIGIN` is set in repo root `.env` (seed CLI sends it as `Origin`) |
| `sign-in 401 INVALID_EMAIL_OR_PASSWORD` + user exists | Stale auth row from interrupted bootstrap — `seed:init` auto-deletes and recreates on staging (`SEED_AUTH_REPAIR_STALE=false` to disable) |
| `sign-in 503` / Worker exceeded resource limits | Redeploy API staging after auth lazy-load fix: `bun repo deploy api staging` |
| `account_kind` does not exist | School migration `0014_service_accounts` not applied — run `db:migrate:staging` |
| `db:migrate:staging` succeeds but schema still old | Orphan row in `drizzle.__drizzle_migrations` with a future `created_at` blocks pending files — re-run `db:migrate:staging` (auto-repairs orphans) or delete unknown-hash rows manually |
| `waitForApi` timeout | API not deployed yet, or DNS still propagating — verify `curl https://api-staging…/` returns 200 |
| S6 401 | Staff not linked to auth subject — run `seed:init` / `seed:staging` |
| S8 missing school | School seed not applied; run `seed:staging` |
| Webapp calls wrong API | Rebuild webapp with `deploy:webapp:staging` (sets `PUBLIC_API_URL`) |
| CORS errors in browser | `TRUSTED_ORIGINS` must include exact app staging origin |
| Seed fails on profile photo upload (R2 401) | Run `bun repo smoke-test r2` — uses `apps/api/secrets.staging.json` + bucket `edaya-files-staging`; re-run `wrangler secret bulk secrets.staging.json --env staging` if check fails |

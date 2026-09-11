# Deploy staging

Isolated Cloudflare staging environment for validating deploys before production. See [staging-environment-plan.md](../sprints/staging-environment-plan.md) for goals and architecture.

**Domains:** `staging.api.school.edayaplus.com` · `staging.app.school.edayaplus.com` · `staging.admin.edayaplus.com` · `staging.identity.edayaplus.com`

---

## One-time Cloudflare + Neon setup

Complete these steps once before the first staging deploy. **Do not reuse production Hyperdrive IDs.**

### 1. Neon staging branch

Create a dedicated branch (e.g. `staging`) in Neon. Store the connection string in your team secret manager.

### 2. Hyperdrive (staging)

Neon **staging** branch: `br-flat-union-ahedlz5i` on project `calm-brook-83532792` (edaya).

Create one school Hyperdrive config from the Neon staging connection string (not production):

```sh
cd apps/api
# School / domain reads (query cache enabled)
bunx wrangler hyperdrive create edaya-staging \
  --connection-string="$STAGING_DATABASE_URL"

```

Copy the returned config ids into `apps/api/wrangler.jsonc`:

- `env.staging.hyperdrive` → binding `HYPERDRIVE` (cached)

**Do not commit** `STAGING_DATABASE_URL` — store it in repo root `.env` (gitignored) or your secret manager.

School `HYPERDRIVE` may keep query cache enabled. Staging seed retries a few read-after-write 403s (domain maps missing rows to forbidden) when Hyperdrive serves stale school reads during population.

### 2b. Central identity

Deploy `edaya_identity` first (own Neon, Hyperdrive `HYPERDRIVE_AUTH`, Email, JWKS, directory secret). Bind school `IDENTITY` to Worker `edaya-identity-staging`. JWT verification uses the issuer JWKS. See [central-identity.md](./central-identity.md) and sibling `edaya_identity/docs/deploy.md`.

### 3. Custom domains

Attach routes in Cloudflare for:

| Host | Worker |
|------|--------|
| `staging.api.school.edayaplus.com` | `edaya-api-staging` |
| `staging.identity.edayaplus.com` | `edaya-identity-staging` |
| `staging.app.school.edayaplus.com` | `edaya-webapp-staging` |
| `staging.admin.edayaplus.com` | `edaya-webadmin-staging` |

Routes are declared in `wrangler.jsonc`; DNS/custom domains are configured in the Cloudflare dashboard on first deploy.

### 4. Wrangler secrets (API staging)

```sh
cd apps/api
cp secrets.json.example secrets.staging.json   # fill values
bunx wrangler secret bulk secrets.staging.json --env staging
# Or individually:
bunx wrangler secret put IDENTITY_DIRECTORY_SECRET --env staging
```

Use the directory secret shared with the staging identity Worker. Staging uses the **dev** Novu API key (same as local `.env`).

---

## First-time bootstrap

```sh
# 1. School schema on Neon staging branch (identity migrates separately)
STAGING_DATABASE_URL=postgres://… bun repo db migrate staging

# 2. Deploy API + web apps (edaya_web repo)
bun repo deploy api staging
bun run deploy:webapp:staging
bun run deploy:webadmin:staging

# 4. Configure seeding env (copy example, set remote URLs)
cp .env.example .env

# 5. Bootstrap school + seeding service account (director session on first run)
#    Optional fresh start after a failed/partial seed:
#    bun repo seed clean --staging --yes
bun repo seed --staging

# 6. Verify
bun repo smoke-test staging
```

**Auth assurance:** interactive `assuranceLevel` is derived from the verified identity JWT `email_verified` claim.

---

## Repeatable deploy checklist

### Local gate (every change)

```sh
bun run verify   # includes check openapi
```

### Staging deploy

```sh
STAGING_DATABASE_URL=postgres://… bun repo db migrate staging   # when schema changed
bun repo deploy api staging                                      # or merge to `staging` with API path changes
bun run deploy:webapp:staging
bun run deploy:webadmin:staging
bun repo seed --staging   # if seed data needed
bun repo smoke-test staging
```

CI runs migrate → `deploy-api` automatically on push when API paths change (see [ci-setup.md](./ci-setup.md)).

### Production promotion (after staging green)

```sh
bun run verify
bun repo deploy api production
bun run deploy:webapp:production
bun run deploy:webadmin:production
```

---

## Smoke checks (`bun repo smoke-test staging`)

Reads repo root `.env` when present, or env vars:

| Variable | Default |
|----------|---------|
| `SEED_STAGING_API_URL` | `https://staging.api.school.edayaplus.com` |
| `SEED_STAGING_AUTH_URL` | `https://staging.identity.edayaplus.com` |
| `SEED_STAGING_APP_ORIGIN` | `https://staging.app.school.edayaplus.com` |
| `SMOKE_STAFF_EMAIL` | dev fixture director email |
| `SMOKE_STAFF_PASSWORD` | dev fixture password |

| ID | Check |
|----|-------|
| S1 | `GET /` health |
| S2 | `GET /doc` or `/reference` |
| S3 | CORS allows trusted app origin |
| S4 | CORS rejects unknown origin |
| S5 | Identity sign-in + school JWT verification |
| S6 | `GET /core/authorization/effective-grants` |
| S7 | Service account Bearer → entity list (school profile key) |
| S8 | Seeded school visible via Hyperdrive |

**Tier 2 (manual):** browser login on the staging app, demo data in UI, and Bearer-token school requests.

---

## Scripts reference

| Command | Description |
|---------|-------------|
| `bun repo deploy api staging` | Deploy API Worker (`--env staging`); also runs from CI on merge |
| `bun run deploy:webapp:staging` | Build with staging `PUBLIC_API_URL` + deploy webapp |
| `bun run deploy:webadmin:staging` | Build with staging `PUBLIC_API_URL` + deploy webadmin (`edaya_web`) |
| `bun repo db migrate staging` | School migrations → staging Neon (`STAGING_DATABASE_URL`) |
| `bun repo seed --staging` | Full HTTP seed against `SEED_STAGING_API_URL` |
| `bun repo smoke-test staging` | Tier 1 HTTP smoke against staging |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Deploy fails on Hyperdrive | Placeholder ID still in `wrangler.jsonc` |
| S5 sign-in fails on seed | Identity users missing or identity Worker unavailable — verify `SEED_STAGING_AUTH_URL`, then re-run `seed:init` |
| `MISSING_OR_NULL_ORIGIN` on seed | Ensure `SEED_STAGING_APP_ORIGIN` is set in repo root `.env` (seed CLI sends it as `Origin`) |
| `sign-in 401 INVALID_EMAIL_OR_PASSWORD` + user exists | Inspect the identity Worker/database and rerun identity seed provisioning |
| `account_kind` does not exist | School migration `0014_service_accounts` not applied — run `bun repo db migrate staging` |
| `db:migrate:staging` succeeds but schema still old | Orphan row in `drizzle.__drizzle_migrations_school` with a future `created_at` blocks pending school files — re-run `bun repo db migrate staging` (auto-repairs orphans) or delete unknown-hash rows manually |
| `relation "user" already exists` during identity migrate | Stale identity journal — from `edaya_identity` inspect `drizzle.__drizzle_migrations_auth`, then `bun repo db migrate` |
| `waitForApi` timeout | API not deployed yet, or DNS still propagating — verify `curl https://api-staging…/` returns 200 |
| S6 401 | Staff not linked to auth subject — run `seed:init` / `seed:staging` |
| S8 missing school | School seed not applied; run `seed:staging` |
| Webapp calls wrong API | Rebuild webapp with `deploy:webapp:staging` (sets `PUBLIC_API_URL`) |
| CORS errors in browser | `TRUSTED_ORIGINS` must include exact app and webadmin staging origins |
| Seed fails on profile photo upload (R2 401) | Run `bun repo smoke-test r2` — uses `apps/api/secrets.staging.json` + bucket `edaya-files-staging`; re-run `wrangler secret bulk secrets.staging.json --env staging` if check fails |

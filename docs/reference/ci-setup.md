# CI setup

> **Audience:** humans — GitHub Actions workflows and reusable setup  
> **Not normative for agents**

`edaya_backend` CI uses a composite action for Bun install, dependency caching, and Turbo remote cache. Other Edaya repos (e.g. `edaya_web`) can copy the same action when aligning setup.

The backend contains Account authentication in `apps/api/src/identity` and publishes one API client. No separate Identity checkout is required. Web and mobile integration workflows check out backend using the retained cross-repository credential `IDENTITY_CHECKOUT_TOKEN`. The coordinated candidate contains exactly backend, frontend and mobile.

## Composite action: `ci-bun-turbo`

Path: [`.github/actions/ci-bun-turbo`](../../.github/actions/ci-bun-turbo/action.yml)

| Step | What it does |
|------|----------------|
| Setup Bun | `oven-sh/setup-bun@v2` — version from root `packageManager` (`bun@1.3.14`) |
| Cache Bun deps | `actions/cache@v4` on `~/.bun/install/cache`, keyed by `bun.lock` |
| Install | `bun install` |
| Turbo cache | `rharkor/caching-for-turbo@v2.5.0` — restores/saves `.turbo` via GitHub Actions cache |

### Inputs

| Input | Default | Purpose |
|-------|---------|---------|
| `bun-version` | `1.3.14` | Bun runtime (match `packageManager` in root `package.json`) |
| `cache-prefix` | `edaya-backend-turbo-` | Isolate Turbo cache keys per repo |

### Usage in a workflow

```yaml
- name: Setup Bun and Turbo cache
  uses: ./.github/actions/ci-bun-turbo
```

With a custom Turbo cache prefix (e.g. when copying into `edaya_web`):

```yaml
- name: Setup Bun and Turbo cache
  uses: ./.github/actions/ci-bun-turbo
  with:
    cache-prefix: edaya-web-turbo-
```

## Workflows that use it

| Workflow | Job | Notes |
|----------|-----|-------|
| [`_verify.yml`](../../.github/workflows/_verify.yml) | `verify` | Runs `bun run verify` |
| [`_deploy-api.yml`](../../.github/workflows/_deploy-api.yml) | `deploy` | Wrangler deploy for `@edaya/api` |
| [`_coverage.yml`](../../.github/workflows/_coverage.yml) | `coverage` | Informational; `continue-on-error: true` |

Other jobs use inline `setup-bun` + `bun install` when they need extra steps (Docker login, GHCR, migrations) and do not benefit from Turbo cache alone.

## Merge pipeline (`deploy_push.yml`)

On push to `staging` / `main` (or manual **Run workflow**):

```text
gate (path filter)
  → migrate (school schema)
  → publish-api-dev-image / publish-api-client (when API paths changed)
  → deploy-api (Wrangler → staging.api.edayaplus.com or api.edayaplus.com)
```

Central Identity has its own repository pipeline, Worker, and database migration. Deploy identity before the school Worker when changing the JWT or directory contract.

| Push branch | Channel | Migrate target |
|-------------|---------|----------------|
| `staging` | staging | staging Neon |
| `main` | production | production Neon |

On push, `dorny/paths-filter` sets `deploy_api` from `apps/api/**`, `package/**`, and root lockfiles. Manual dispatch keeps explicit toggles for migrate, API deploy, and api-dev image publish. Verify and integration run on PRs only (`deploy_pr.yml`), not on merge deploy.

### Secrets (`edaya_backend` → Settings → Secrets and variables → Actions)

| Secret | Used by |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | `deploy-api` — Wrangler deploy (`apps/api/wrangler.jsonc`) |
| `STAGING_DATABASE_URL` | `migrate` on `staging` channel |
| `PRODUCTION_DATABASE_URL` | `migrate` on `production` channel |

Wrangler **worker secrets** (Account encryption/signing keys, R2, FCM) are uploaded separately via `wrangler secret bulk` — not GitHub Actions secrets. See [deploy-staging.md](./deploy-staging.md).

Configured in [`deploy_push.yml`](../../.github/workflows/deploy_push.yml).

## Verify entry point

The verify job always runs:

```sh
bun run verify
```

Which expands to:

```sh
bun repo verify && turbo run quality && turbo run build && turbo run test -- --dots
```

Repo hygiene (doctor, OpenAPI drift, boundaries, test naming) runs **first** and fails fast before the Turbo graph. See [repo-cli.md](./repo-cli.md).

Integration tests (`bun run test:integration`) are a **separate** PR job after verify — not part of `bun run verify`. Locally, run both blocking PR jobs with:

```sh
bun repo verify --full
```

After the first successful publish of `edaya-api-dev`, grant consumer repos read access to the GHCR package (one-time, org admin):

1. [edaya-api-dev package settings](https://github.com/orgs/Maya-Invest/packages/container/edaya-api-dev/settings)
2. **Manage Actions access** → add `edaya_web` and `edaya_mobile` with **Read**

Or set the package to **Public** so CI can pull without cross-repo token setup.

## Adopting in another repo

1. Copy `.github/actions/ci-bun-turbo/` into the target repo.
2. Set `cache-prefix` to a repo-specific value.
3. Replace inline `setup-bun` + `bun install` in `_verify.yml` with the composite action.
4. Keep `bun run verify` as the only verify-step command (no workflow-specific check logic).



## API client GitHub Packages (`@maya-invest/edaya-api-client`)

[`_publish-api-client.yml`](../../.github/workflows/_publish-api-client.yml) publishes both backend-owned clients on main merges and non-staging branch runs. Staging publication belongs to [`release-staging.yml`](../../.github/workflows/release-staging.yml) after full qualification; `validate_only=true` skips publication. Both packages use the same backend source commit, and immutable versions may only be reused when that source matches. Clients publish to **GitHub Packages** (`npm.pkg.github.com`) with the corresponding channel dist-tag.

### Secrets (`edaya_backend` repo settings)

Publish uses `GITHUB_TOKEN` (`packages: write` and `contents: write` on `deploy_push`) — no extra tokens required.

### Consumer package access (one-time, org admin)

After the first publish, grant consumer repos **Read** on the `@maya-invest/edaya-api-client` GitHub Package (same flow as [edaya-api-dev](#adopting-in-another-repo) GHCR access). Or set the package to **Public**.

### Consumer `.npmrc` (repo root)

```ini
@maya-invest:registry=https://npm.pkg.github.com
```

CI adds `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}` during install when resolving from the registry.

### Install

```sh
bun add @maya-invest/edaya-api-client@staging
bun add @maya-invest/edaya-api-client@production
```

**Local development in this monorepo** — root `package.json` override:

```json
"overrides": {
  "@maya-invest/edaya-api-client": "workspace:*"
}
```

**Sibling repos** — `file:../edaya_backend/package/api-client`.

## Deploy API to Cloudflare (GitHub Actions)

Deploy runs from GitHub Actions — not Cloudflare Workers Builds. See [`deploy_push.yml`](../../.github/workflows/deploy_push.yml) (push to `staging` / `main`).

| Step | What happens |
|------|----------------|
| `verify` | `bun run verify` (same as PR CI) |
| `migrate` | School schema when enabled (before deploy) |
| `deploy-api` | `wrangler deploy` for `@edaya/api` |

**Smoke (manual):** API staging smoke (`bun repo smoke-test staging`) is not run in merge CI until staging seed is stable. Vendor smokes remain ad-hoc: `bun repo smoke-test notify`, `bun repo smoke-test r2`.

**One-time repo secret:** `CLOUDFLARE_API_TOKEN` with Workers Scripts edit (+ routes if using custom domains). Wrangler reads it from the environment. Worker secrets (Account encryption/signing keys, R2, FCM, etc.) stay in the Cloudflare dashboard — not GitHub Actions.

Branch mapping:

| Branch | Migrate target | Wrangler env |
|--------|----------------|--------------|
| `staging` | `staging` | `--env staging` |
| `main` | `production` | `--env prod` |

Manual deploy: **Actions → Push / Merge → Run workflow** (toggle migrate / publish / deploy independently).

Local equivalent: `bun repo deploy api staging` or `bun repo deploy api production` after `bun run verify` and migrations when schema changed.

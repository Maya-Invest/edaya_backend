# @edaya/seeding

HTTP seed orchestration for local dev, staging, and integration tests.

## Commands (repo root)

| Command | Purpose |
|---------|---------|
| `bun repo seed` | Full local demo seed |
| `bun repo seed --staging` | Full staging seed |
| `bun repo seed --scope doctor` | Diagnose seed health (sign-in, grants, data checks) |
| `bun repo seed --scope doctor --repair` | Diagnose and run minimal HTTP repair chain |
| `bun repo seed clean` | Wipe local `.data/` (stop `bun repo dev` first) |
| `bun repo seed clean --staging` | Wipe Neon staging + Better Auth D1 (destructive) |

Granular scopes (power users): `bun repo seed --scope <name>` — see `bun repo seed --help`.

| Scope | Purpose |
|-------|---------|
| `auth` | Better Auth accounts only |
| `auth:link` | Re-link auth subjects to staff/guardian records |
| `access` | Staff permission + class assignments |
| `profile-pictures` | Upload fixture profile photos |
| `school` | Domain data without auth/access bootstrap |
| `service-account` | Provision seeding service account |
| `validate` | Manifest entity counts + dashboard queries |

Staging smoke: `bun repo smoke-test staging` (full tier-1 checks in `@edaya/integration-tests`).

## Environment (repo root `.env`)

Copy `.env.example` → `.env` at the **repo root** (gitignored). `apps/api/.env` is also loaded for `BETTER_AUTH_URL`.

| Variable | Used by | Default |
|----------|---------|---------|
| `SEED_REFERENCE_DATE` | Fixture rolling dates | `2026-06-16` in `@edaya/fixtures` |
| `SEED_API_URL` | `bun repo seed`, `bun repo seed --scope doctor`, … | `BETTER_AUTH_URL` → `http://localhost:9999` |
| `SEED_APP_ORIGIN` | Local Better Auth `Origin` header | `http://localhost:5173` |
| `SEED_STAGING_API_URL` | `bun repo seed --staging` | `https://api-staging.edaya.softilab.dev` |
| `SEED_STAGING_APP_ORIGIN` | Staging Better Auth `Origin` header | `https://app-staging.edaya.softilab.dev` |

Optional secrets in the same file: `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`.

```sh
bun repo seed clean --yes && bun repo seed              # local fresh start
bun repo seed clean --staging --yes && bun repo seed --staging   # staging fresh start
# or
bun repo seed --clean
bun repo seed --staging --clean
```

## Local dev flow

1. Start the API: `bun repo dev`
2. Seed: `bun repo seed`
3. Log in at http://localhost:5173/login

After `rm -rf .data`, **stop `bun repo dev` first**, then restart before seeding. See [docs/reference/local-dev.md](../../docs/reference/local-dev.md).

### Profile photos

Profile photo seed uploads fixture JPEGs through the API file-storage flow. Local dev requires **`@edaya/local-files-server`** on port **9200**, started automatically by `bun repo dev`.

| Situation | Behavior |
|-----------|----------|
| `bun repo dev` running (API + local-files) | Photos seed normally |
| API only (no local-files) | `bun repo seed` **auto-skips** photos with a clear message |
| Explicit opt-out | `bun repo seed --skip-profile-photos` |
| Staging / remote API | API uses R2-backed storage |

### Repair without wipe

`bun repo seed --scope doctor --repair` runs the minimal chain (`auth:link` → `service-account` → `access` → `profile-pictures`) based on repairable findings. Broken state (missing auth or school) still requires `bun repo seed` or a wipe.

## Architecture

```text
src/
  domains/<vertical>/   port.ts, workflow.ts, adapters/http|in-process
  transport/http/       Low-level HTTP client, catalog, entity helpers
  diagnostics/          Doctor, validation, profile-photo preflight
  runtime/              HTTP scope orchestrator + scopes/
  orchestration/        Shared domain scope routing
  bootstrap/            Auth, session, service-account
  cleanup/              Local and staging wipe
  support/              Env, CLI parsing, repo-root resolution
```

Seeding API keys come from `@edaya/fixtures` school profiles (`seedingApiKey`). No `.env` secret required for local dev.

See [src/README.md](src/README.md) and [seed-contract.md](seed-contract.md).

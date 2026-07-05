# @edaya/seeding

HTTP seed orchestration for local dev, staging, and integration tests.

## Commands (repo root)

| Command | Purpose |
|---------|---------|
| `bun seed` | Full local demo seed |
| `bun seed:staging` | Full staging seed |
| `bun seed:doctor` | Diagnose seed health (sign-in, grants, data checks) |
| `bun seed:doctor --repair` | Diagnose and run minimal HTTP repair chain |
| `bun seed:clean` | Wipe local `.data/` (stop `bun dev` first) |
| `bun seed:clean:staging` | Wipe Neon staging + Better Auth D1 (destructive) |

Granular scopes (power users): `bun seed --scope <name>` — see `bun seed --help`.

| Scope | Purpose |
|-------|---------|
| `auth` | Better Auth accounts only |
| `auth:link` | Re-link auth subjects to staff/guardian records |
| `access` | Staff permission + class assignments |
| `profile-pictures` | Upload fixture profile photos |
| `school` | Domain data without auth/access bootstrap |
| `service-account` | Provision seeding service account |
| `validate` | Manifest entity counts + dashboard queries |

Staging smoke: `bun smoke:staging` (full tier-1 checks in `@edaya/integration-tests`).

## Environment (repo root `.env`)

Copy `.env.example` → `.env` at the **repo root** (gitignored). `apps/api/.env` is also loaded for `BETTER_AUTH_URL`.

| Variable | Used by | Default |
|----------|---------|---------|
| `SEED_REFERENCE_DATE` | Fixture rolling dates | `2026-06-16` in `@edaya/fixtures` |
| `SEED_API_URL` | `bun seed`, `bun seed:doctor`, … | `BETTER_AUTH_URL` → `http://localhost:9999` |
| `SEED_APP_ORIGIN` | Local Better Auth `Origin` header | `http://localhost:5173` |
| `SEED_STAGING_API_URL` | `bun seed --staging` | `https://api-staging.edaya.softilab.dev` |
| `SEED_STAGING_APP_ORIGIN` | Staging Better Auth `Origin` header | `https://app-staging.edaya.softilab.dev` |

Optional secrets in the same file: `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`.

```sh
bun seed:clean --yes && bun seed              # local fresh start
bun seed:clean:staging --yes && bun seed --staging   # staging fresh start
# or
bun seed --clean
bun seed --staging --clean
```

## Local dev flow

1. Start the API: `bun dev`
2. Seed: `bun seed`
3. Log in at http://localhost:5173/login

After `rm -rf .data`, **stop `bun dev` first**, then restart before seeding. See [docs/reference/local-dev.md](../../docs/reference/local-dev.md).

### Profile photos

Profile photo seed uploads fixture JPEGs through the API file-storage flow. Local dev requires **`@edaya/local-files-server`** on port **9200**, started automatically by `bun dev`.

| Situation | Behavior |
|-----------|----------|
| `bun dev` running (API + local-files) | Photos seed normally |
| API only (no local-files) | `bun seed` **auto-skips** photos with a clear message |
| Explicit opt-out | `bun seed --skip-profile-photos` |
| Staging / remote API | API uses R2-backed storage |

### Repair without wipe

`bun seed:doctor --repair` runs the minimal chain (`auth:link` → `service-account` → `access` → `profile-pictures`) based on repairable findings. Broken state (missing auth or school) still requires `bun seed` or a wipe.

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

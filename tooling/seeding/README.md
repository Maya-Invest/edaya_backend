# @edaya/seeding

HTTP seed orchestration for local dev, staging, and integration tests.

## Commands (repo root)

| Command | Purpose |
|---------|---------|
| `bun repo seed` | Full local demo seed |
| `bun repo seed --staging` | Full staging seed |
| `bun repo seed --scope doctor` | Diagnose seed health (sign-in, grants, data checks) |
| `bun repo seed --scope doctor --repair` | Diagnose and run minimal HTTP repair chain |
| `bun repo seed clean` | Wipe local school `.data/` (stop `bun repo dev` first) |
| `bun repo seed clean --staging` | Wipe Neon staging school DB (destructive) |

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

Copy `.env.example` → `.env` at the **repo root** (gitignored). `apps/api/.env` is also loaded for local school and identity URLs.

| Variable | Used by | Default |
|----------|---------|---------|
| `SEED_REFERENCE_DATE` | Fixture rolling dates | `2026-06-16` in `@edaya/fixtures` |
| `SEED_API_URL` | School API for `bun repo seed` | `http://localhost:9999` |
| `SEED_AUTH_URL` | Central identity API for auth provisioning | `http://localhost:9900` |
| `SEED_APP_ORIGIN` | Local identity `Origin` header | `http://localhost:5173` |
| `SEED_STAGING_API_URL` | `bun repo seed --staging` | `https://staging.api.school.edayaplus.com` |
| `SEED_STAGING_AUTH_URL` | Staging Central Identity API | `https://staging.identity.edayaplus.com` |
| `SEED_STAGING_APP_ORIGIN` | Staging identity `Origin` header | `https://staging.app.school.edayaplus.com` |

Optional secrets in the same file: `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`.

```sh
bun repo seed clean --yes && bun repo seed              # local school fresh start
bun repo seed clean --staging --yes && bun repo seed --staging   # staging school fresh start
# Identity users: from edaya_identity, `bun repo db wipe local --yes` (or staging)
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


## Admitted bootstrap mutations

Minimal school bootstrap calls the existing school, staff and guardian commands in one selected-school transaction. It disables invitation delivery and leaves no partial school/staff state when guardian creation fails. Another existing school does not suppress the selected fixture. A completed selected-school bootstrap is safe to repeat.

The in-process auth-link adapter uses its resolved dataset school and scoped entity reads. Initial owner assignment calls the service's internal fixture-owner capability; it cannot replace an existing owner, override a pending owner invitation or change unrelated school settings. The shared workflow refuses owner replacement before either the HTTP or in-process adapter is invoked. HTTP keeps its existing authenticated ownership command and does not gain a fixture-only public endpoint. Existing ownership changes must use the normal ownership flow.

Direct application-repository uses remaining in seed domains are read-only fixture diagnostics or state lookups; mutation paths use admitted managed entities or named commands. The fixture owner operation adds an atomic reference-only receipt/audit. It requires the runtime's transactional command journal, supplied by normal API composition.

# @edaya/seeding

HTTP seed orchestration for local dev, staging, and integration tests.

## Commands (repo root)

| Command | Purpose |
|---------|---------|
| `bun repo ops seed` | Full local demo seed |
| `bun repo ops seed staging` | Full staging seed |
| `bun repo ops seed --scope doctor` | Diagnose seed health (sign-in, grants, data checks) |
| `bun repo ops seed --scope doctor --repair` | Diagnose and run minimal HTTP repair chain |
| `bun repo ops seed clean` | Wipe local school `.data/` (stop `bun repo dev` first) |
| `bun repo ops seed clean staging` | Wipe Neon staging school DB (destructive) |

Granular scopes (power users): `bun repo ops seed --scope <name>` — see `bun repo ops seed --help`.

| Scope | Purpose |
|-------|---------|
| `auth` | Better Auth accounts only |
| `auth:link` | Re-link auth subjects to staff/guardian records |
| `access` | Staff permission + class assignments |
| `profile-pictures` | Upload fixture profile photos |
| `school` | Domain data without auth/access bootstrap |
| `service-account` | Provision seeding service account |
| `validate` | Manifest entity counts + dashboard queries |

Staging smoke: `bun repo ops smoke api staging` (full tier-1 checks in `@edaya/integration-tests`).

## Environment (repo root `.env`)

Copy `.env.example` → `.env` at the **repo root** (gitignored). `apps/api/config.local.jsonc` is also loaded for local school and identity URLs.

| Variable | Used by | Default |
|----------|---------|---------|
| `SEED_REFERENCE_DATE` | Fixture rolling dates | `2026-09-17` |
| `SEED_API_URL` | School API for `bun repo ops seed` | `http://localhost:9999` |
| `SEED_API_URL` | Central identity API for auth provisioning | `http://localhost:9999` |
| `SEED_APP_ORIGIN` | Local identity `Origin` header | `http://localhost:5173` |
| `SEED_STAGING_API_URL` | `bun repo ops seed staging` | `https://staging.api.edayaplus.com` |
| `SEED_STAGING_API_URL` | Staging Central Identity API | `https://staging.api.edayaplus.com` |
| `SEED_STAGING_APP_ORIGIN` | Staging identity `Origin` header | `https://staging.app.edayaplus.com` |

Optional secrets in the same file: `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`.

```sh
# Stop bun repo dev first. This command owns temporary API/file services.
bun repo ops seed local --clean --yes                          # reset + full local reseed
bun repo ops seed clean staging --yes && bun repo ops seed staging   # staging school fresh start
# Account/auth data: `bun repo ops db wipe identity local --yes` (or staging)
# or (API stopped)
bun repo ops seed --clean                 # prompts; add --yes for automation
bun repo ops seed staging --clean       # prompts; add --yes for automation
```

## Local dev flow

1. Start the API: `bun repo dev`
2. Seed: `bun repo ops seed`
3. Log in at http://localhost:5173/login

Local fixture OTP sign-in reads and acknowledges the current draft terms when preview mode is enabled. Published terms require operator-authenticated sessions supplied through `SEED_AUTH_SESSIONS_FILE`; the seeder does not accept published agreements automatically.

After `rm -rf .data`, **stop `bun repo dev` first**, then restart before seeding. See [docs/reference/local-dev.md](../../docs/reference/local-dev.md).

For a complete local reset, stop `bun repo dev`, run `bun repo ops seed local --clean --yes`, then restart `bun repo dev`. The combined command starts temporary services without file watching, waits for both API and file storage readiness, and shuts down only its own services on success or failure. Identity data is retained. A running API, including one returning HTTP 500, blocks deletion of the school database.

### Profile photos

Profile photo seed uploads fixture JPEGs through the API file-storage flow. Local dev requires **`bun tooling/repo/dev/local-files.ts`** on port **9200**, started automatically by `bun repo dev`.

Fixture photos are stable per owner. Rerunning the full seed repairs missing portraits even when school data already exists. Completed seed portraits are reused; interrupted PUT/completion requests retry the same identity and bytes. Expired or conflicting upload intents receive a newly authorized replacement, which is reused after publication. Unknown conflicts and authorization errors fail the seed rather than being reported as completed uploads.

| Situation | Behavior |
|-----------|----------|
| `bun repo dev` running (API + local-files) | Photos seed normally |
| API only (no local-files) | `bun repo ops seed` **auto-skips** photos with a clear message |
| Explicit opt-out | `bun repo ops seed --skip-profile-photos` |
| Staging / remote API | API uses R2-backed storage |

### Repair without wipe

`bun repo ops seed --scope doctor --repair` runs the minimal chain (`auth:link` → `service-account` → `access` → `profile-pictures`) based on repairable findings. Broken state (missing auth or school) still requires `bun repo ops seed` or a wipe.

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

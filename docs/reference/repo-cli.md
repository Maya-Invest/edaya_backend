# Repository commands

`bun repo` is the backend development/operations interface. Root `bun run` scripts run workspace quality and integration tasks. Package scripts remain available for focused iteration. Deployment workflows remain separate: staging owns reset/seeding/qualification; production owns its migration/deployment process.

## Command reference

This table and top-level help come from `tooling/repo/cli/catalog.ts`. Unsupported arguments fail before the operation. `bun repo <command> --help` is non-mutating and does not require credentials or running services.

<!-- repo-commands:start -->

| Command | Behavior |
| --- | --- |
| `dev` | Start local API/auth and file service (writes local data). |
| `seed [clean] [--staging] [--scope NAME] [--clean] [--yes] [--repair] [--skip-profile-photos] [--skip-attachments] [--no-progress]` | Seed local/staging data. clean deletes data; --clean prompts unless --yes. Scopes: all, school, auth, auth:link, access, profile-pictures, service-account, validate, doctor. |
| `db migrate <school\|identity> <local\|staging\|production>`<br>`db reset school <staging\|production> [--yes]`<br>`db wipe identity <local\|staging> [--yes]`<br>`db generate`<br>`db flatten [--yes]`<br>`db browser school` | Migrate schemas, reset school schemas, wipe Account data, generate migrations, replace migration history, or browse local school data. Legacy db migrate/reset without school remain aliases. |
| `check <openapi\|boundaries\|test-naming\|commands>` | Read-only artifact, import, test-name and generated command-documentation checks. |
| `doctor` | Check configuration ownership, Worker parity, environment files and repository layout. |
| `verify [--ci\|--full]` | Default: repository hygiene. --ci: workflow lint, quality/build/unit checks and both Worker builds. --full: --ci plus all backend integrations (requires pg_config). |
| `smoke api staging`<br>`smoke notify local`<br>`smoke r2 staging [--curl-only]` | Explicit live checks: API exercises staging; notify creates/publishes an announcement; R2 uploads, checks and deletes an object. --curl-only prints a short-lived signed upload command without uploading. |
| `vars push api <staging\|production> [--dry-run] [--replace-secret NAME]...`<br>`vars delete api <staging\|production> NAME [--dry-run]` | Merge config or explicitly delete variables; preserves secrets and resource bindings. Requires Cloudflare account/token. |
| `secrets push api <staging\|production> [--dry-run]`<br>`secrets list api <staging\|production>`<br>`secrets delete api <staging\|production> NAME [--dry-run]` | Validate and upload the selected private secrets JSON, list names, or delete one secret. Never displays values. Requires Cloudflare account/token. |
| `pause <api\|scheduler\|jobs\|all> <staging\|production> [--dry-run]` | Enable only the selected pause controls through a settings-only update. |
| `resume <api\|scheduler\|jobs\|all> <staging\|production> [--dry-run]` | Disable only the selected pause controls through a settings-only update. |
| `status api <staging\|production>` | Read Worker deployment versions and pause controls; no configuration or credential values are printed. |
| `deploy api <staging\|production> [--dry-run]` | Code-only Worker deployment; --dry-run builds without deploying. Does not migrate, seed, apply config, or coordinate a release. |
| `openapi export [--output PATH]`<br>`openapi generate` | Export the OpenAPI fixture, or export and regenerate repository client artifacts. |
| `codegen <generate\|check> --input <file\|url> [--client-dir PATH] [--schema-out PATH] [--bindings-out PATH] [--client-out PATH] [--openapi-out PATH] [--repo-root PATH] [--runtime-version VERSION] [--header "Name: value"]` | Low-level client generation or drift checking. Detailed option combinations: bun repo codegen --help. |
| `smoke-test <staging\|notify\|r2> [--curl-only]` | Compatibility alias: staging → smoke api staging; notify → smoke notify local; r2 → smoke r2 staging. |
| `identity-migrate [local\|staging\|production]` | Compatibility alias for db migrate identity. Without a target, requires exactly one configured database URL; explicit targets are preferred. |
| `identity-wipe <local\|staging> [--yes]` | Compatibility alias for db wipe identity; omitted target retains local behavior. |

<!-- repo-commands:end -->

## Development and databases

```sh
bun repo dev
bun dev:test
bun repo seed
bun repo seed --staging --scope school
bun repo seed clean --yes
bun repo seed --staging --clean --yes
bun repo db migrate school local
bun repo db migrate identity staging
bun repo db wipe identity local --yes
bun repo db reset school staging --yes
```

School reset drops and recreates school/notification schemas. Seed cleanup removes local school files or truncates staging school data, retaining schema. Identity wipe is separate and has no production target. Stop the local API before wiping its database. `--clean` now prompts like `clean`; non-interactive invocations require `--yes`, and cancellation stops seeding.

Identity migration targets are explicit: local reads API local configuration/secrets, staging uses `STAGING_AUTH_DATABASE_URL`, production uses `PRODUCTION_AUTH_DATABASE_URL`. The old no-target `identity-migrate` only accepts one distinct URL across the legacy environment variables, warning about deprecation. It refuses ambiguous targets. The old `db migrate <environment>`, `db reset <environment>`, and `identity-wipe` forms remain compatibility aliases.

`db flatten` changes tracked migration history, not database state. It prompts unless `--yes`, generates in a temporary directory, validates the result, then replaces the old directory while retaining a private-to-the-checkout ignored backup. Generation failure leaves original migrations unchanged. Review before committing; do not reset a production database merely because a baseline was generated.

Local application settings come from `apps/api/config.local.jsonc`, credentials from `apps/api/.env`. Root `.env` supplies repository/remote tooling credentials. See [configuration ownership](api-configuration.md).

## Verification levels

| Entry point | Checks |
| --- | --- |
| `bun repo verify` | Command docs, repository doctor, OpenAPI drift, release contract, import boundaries, test naming |
| `bun run verify` | CI-script tests, hygiene, quality, client build, unit tests |
| `bun repo verify --ci` | Workflow/shell lint, root verification, staging and production Worker dry-run builds |
| `bun repo verify --full` | Everything in `--ci`, then service/HTTP, seed, and native PostgreSQL integration |

The CI verification job calls `bun repo verify --ci`; local full verification uses the same steps plus `.github/scripts/run-backend-integration.sh`. Native integration requires `pg_config`, `initdb`, and `pg_ctl`. Workflow lint may download the pinned validator on first use. Worker dry runs upload no code.

Root workspace commands are `build`, `quality`, `check`, `lint`, `lint:fix`, `test`, and `test:coverage`. Integration commands are `test:integration`, `test:integration:api`, `test:integration:http`, `test:integration:seed`, and `test:integration:native`; the default integration command includes API and HTTP only. Use `bun --filter <package> <script>` for package-scoped iteration.

## Operations

```sh
bun repo deploy api production --dry-run
bun repo vars push api staging --dry-run
bun repo secrets push api staging --dry-run
bun repo status api staging
bun repo pause scheduler staging --dry-run
bun repo pause all staging
bun repo resume api staging
bun repo smoke api staging
bun repo smoke notify local
bun repo smoke r2 staging
```

Code deployment preserves remote variables and does not apply configuration, run migrations, seed data, or perform a coordinated release. Use the staging release workflow when those steps are required.

Secrets push chooses `apps/api/secrets.staging.json` or `apps/api/secrets.prod.json`. Its dry-run validates the file and prints names only, without Cloudflare calls. Remote operations require `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Push merges supplied secrets; delete is explicit and rejects non-secret bindings. Secret values travel to Wrangler through stdin, not command arguments. Read-back checks confirm binding presence/type, not secret values (Cloudflare does not reveal them).

Pause/resume changes only the selected remote control: API → `PAUSE_API`, scheduler → `PAUSE_SCHEDULER`, jobs → `PAUSE_JOBS`, all → all three. Status reports active version traffic and these controls only. It does not print arbitrary settings or credentials. A later full `vars push` reapplies tracked flag values; do not overlap configuration pushes with releases or maintenance.

Smoke checks have real effects. API smoke exercises deployed staging; notification smoke creates/publishes local test announcements and can deliver through configured providers; R2 smoke performs PUT/HEAD/DELETE. Only API/staging, notify/local and R2/staging are supported. The legacy `smoke-test staging|notify|r2` forms map to those exact combinations. R2's `--curl-only` emits a short-lived signed URL without uploading; treat that output as a credential.

## Generated API artifacts

`openapi export [--output PATH]` exports the fixture. `openapi generate` exports the default fixture and regenerates the repository client, with no custom arguments. Use `codegen generate|check` for custom inputs/outputs; `bun repo codegen --help` explains option combinations. `check openapi` verifies generated artifacts without updating tracked files.

## Adding a command

Add its syntax, effect and routing mode to the command catalog, then add its strict parser and dispatcher/script mapping. Regenerate the table with `bun tooling/repo/cli/command-docs.ts --write`; `bun repo check commands` detects drift. Add tests for unknown arguments, safe help, target selection and side effects. Keep domain logic outside the CLI and retain distinct staging/production release orchestration.

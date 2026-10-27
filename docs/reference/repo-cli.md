# Repository commands

Use `bun repo ops <command>` for operational commands. `maintenance` and the old standalone CLI entry point have been removed. Use `--help` at any command depth for its arguments and options.

## Backend commands

```sh
bun install --frozen-lockfile
bun run repo check
bun run repo test tooling
bun run repo ci verify
bun run repo test integration
bun run repo build staging
bun run repo ci qualify staging
```

`ci qualify` runs unit verification, all package SQL/composition and service/HTTP, seed and native PostgreSQL integrations, then the separate handwritten API regressions, an informational historical schema comparison and the environment-specific dry-run Worker build. `bun run test:integration` and `bun run repo test integration` select the same complete aggregate. Large performance datasets run only with `bun run test:benchmarks`. PostgreSQL commands (`pg_config`, `initdb`, `pg_ctl`) must be available; CI setup exports their binary directory. No consumer checkout is needed.

Clients are expected to upgrade with the backend; compatibility with older clients does not block release. Checksum-pinned oasdiff 1.11.7 reports historical contract changes in `.ci-evidence/contract-changes.json`. PRs compare to the target-branch SHA; releases compare to the API definition in the last successful deployment commit for that environment, falling back to the preserved `tooling/repo/fixtures/compatibility/bootstrap.json` snapshot when no successful deployment exists. Comparison/tool errors still fail qualification. The existing `compatibility` evidence key requires the handwritten HTTP, actor-assurance and tenant-scope regression suites to pass; schema changes cannot suppress those tests. Current OpenAPI drift, generated-client and application regression checks also remain mandatory. Qualify matching frontend and mobile clients before rolling out a contract change.

## Cloudflare and migrations

Configure environment secrets `CLOUDFLARE_API_TOKEN`, `STAGING_DATABASE_URL`, `STAGING_AUTH_DATABASE_URL`, `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL` as applicable, and environment variable `CLOUDFLARE_ACCOUNT_ID`. The deployment job explicitly migrates identity and school databases before deploying the verified Worker bundle. Normal deployment never resets or seeds.

For an emergency use `bun repo ops emergency-deploy staging --dry-run`, then an explicit `--yes` to apply. It creates build evidence and uploads that build without implicit migrations/reset. This is an emergency bypass of ordinary qualification and is marked in its evidence.

## Separate staging maintenance

The **Staging maintenance** workflow shares the staging deployment concurrency group. Its default is a read-only dry run. Applying reset/reseed or recovery requires typing `STAGING MAINTENANCE` and turning dry run off. It requires dedicated staging DB roles, direct TLS connections, and deployed Hyperdrive bindings matching the configured targets.

Configure non-secret environment variables `STAGING_DATABASE_HOST`, `STAGING_SCHOOL_DATABASE`, `STAGING_IDENTITY_DATABASE`, `STAGING_IDENTITY_ROLE`, plus the staging database/Cloudflare credentials. Seed authentication uses the existing seed configuration. Queue edit and Worker settings permissions are required for maintenance only.

Reset/reseed pauses API, scheduler, jobs and queue delivery, drains work, checks HTTP maintenance state, resets the two staging databases while preserving signing keys, seeds, then restores owned controls. Failure retains the pause. Inspect sanitized maintenance evidence and `bun repo ops status staging` before requesting the explicit recovery operation. Recovery resumes paused controls; it does not retry reset or seed. Settings operations performed outside Actions must also be serialized by the operator.

## Package scripts and repository commands

`bun repo check` runs repository hygiene checks; `bun run check` runs workspace type checks. `bun run verify` delegates to `bun repo ci verify`, the broader verification pipeline. Root package scripts remain available for workspace development. Repository commands are the canonical interface for operations and release workflows.

<!-- repo-commands:start -->

```text
Usage: bun repo <command>

Backend repository commands. Use <command> --help for details.

Commands:
  dev                      Start the local API/auth and file services with Bun.
  check                    Run all repository checks.
  test                     Run test suites.
  build                    Build release artifacts without deployment.
  generate                 Generate repository artifacts.
  ops                      Manage data, configuration and operational state.
  ci                       Run CI verification, release and fixture operations.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo <command> --help

Usage: bun repo dev

Start the local API/auth and file services with Bun.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo dev

Usage: bun repo check [command]

Run all repository checks.

Commands:
  doctor                   Check configuration and repository layout.
  commands                 Check generated command documentation.
  openapi                  Check API/client artifact drift.
  boundaries               Check package import boundaries.
  test-naming              Check test naming conventions.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check

Usage: bun repo check doctor

Check configuration and repository layout.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check doctor

Usage: bun repo check commands

Check generated command documentation.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check commands

Usage: bun repo check openapi

Check API/client artifact drift.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check openapi

Usage: bun repo check boundaries

Check package import boundaries.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check boundaries

Usage: bun repo check test-naming

Check test naming conventions.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo check test-naming

Usage: bun repo test <command>

Run test suites.

Commands:
  unit                     Run workspace unit tests.
  tooling                  Run the complete tooling package test suite.
  integration              Run supervised integration suites.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo test <command> --help

Usage: bun repo test unit

Run workspace unit tests.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo test unit

Usage: bun repo test tooling

Run the complete tooling package test suite.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo test tooling

Usage: bun repo test integration [options]

Run supervised integration suites.

Options:
  -h, --help               Show help for this command.
  --group <group>
      Run one isolated integration group; default: all. Values: services, adapters-http, seed-native.

Examples:
  bun repo test integration

Usage: bun repo build <staging|production>

Build release artifacts without deployment.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo build staging

Usage: bun repo generate <command>

Generate repository artifacts.

Commands:
  openapi                  Export the API schema and refresh repository clients.
  schema                   Export only the API schema.
  client                   Generate client/schema/bindings, or check existing artifacts with --check.
  templates                Precompile document templates.
  commands                 Regenerate the full command reference and saved help.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo generate <command> --help

Usage: bun repo generate openapi

Export the API schema and refresh repository clients.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo generate openapi

Usage: bun repo generate schema [options]

Export only the API schema.

Options:
  -h, --help               Show help for this command.
  --output <path>
      Output path. Default: tooling/repo/fixtures/openapi.json.

Examples:
  bun repo generate schema

Usage: bun repo generate client [options]

Generate client/schema/bindings, or check existing artifacts with --check.

Options:
  -h, --help               Show help for this command.
  --check
      Check for drift instead of updating artifacts.
  --input <file-or-url>
      Required OpenAPI input file or URL.
  --client-dir <path>
      Generated client package directory.
  --bindings-out <path>
      Generated bindings output.
  --schema-out <path>
      Schema types output; defaults to schema.d.ts in --client-dir.
  --client-out <path>
      Generated single-file client output.
  --openapi-out <path>
      OpenAPI artifact to compare with --check.
  --repo-root <path>
      Repository root for --check; defaults to the working directory.
  --runtime-version <version>
      Client runtime version.
  --header <Name: value> (repeatable)
      Header for fetching the input URL.

Examples:
  bun repo generate client --input schema.json --client-dir package/client
  bun repo generate client --check --input schema.json --client-dir package/client

Usage: bun repo generate templates

Precompile document templates.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo generate templates

Usage: bun repo generate commands

Regenerate the full command reference and saved help.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo generate commands

Usage: bun repo ops <command>

Manage data, configuration and operational state.

Commands:
  db                       Manage database schemas and data.
  seed                     Populate demo data while supervising background-work pauses.
  vars                     Manage configuration variables.
  secrets                  Manage secrets without displaying values.
  pause                    Enable selected pause controls.
  resume                   Disable selected pause controls.
  status                   Inspect operational state without exposing credentials.
  smoke                    Run explicit live smoke checks.
  reset                    Coordinate staging reset/reseed with pause and recovery controls.
  recover                  Resume controls left paused by staging maintenance; does not retry reset or seed.
  emergency-deploy         Build and deploy through the emergency qualification bypass; does not migrate or seed.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops <command> --help

Usage: bun repo ops db <command>

Manage database schemas and data.

Commands:
  migrate                  Apply database migrations.
  reset                    Reset school database schemas.
  wipe                     Delete identity data.
  generate                 Generate school migration files.
  flatten                  Replace school migration history.
  browser                  Open the local school database browser.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops db <command> --help

Usage: bun repo ops db migrate <school|identity> <local|staging|production>

Apply database migrations.

Arguments:
  database                 Values: school, identity.
  target                   Values: local, staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops db migrate school local

Usage: bun repo ops db reset <school> <staging|production> [options]

Reset school database schemas.

Arguments:
  database                 Values: school.
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.
  -y, --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops db reset school staging

Usage: bun repo ops db wipe <identity> <local|staging> [options]

Delete identity data.

Arguments:
  database                 Values: identity.
  target                   Values: local, staging.

Options:
  -h, --help               Show help for this command.
  -y, --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops db wipe identity local

Usage: bun repo ops db generate

Generate school migration files.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops db generate

Usage: bun repo ops db flatten [options]

Replace school migration history.

Options:
  -h, --help               Show help for this command.
  -y, --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops db flatten

Usage: bun repo ops db browser <school>

Open the local school database browser.

Arguments:
  database                 Values: school.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops db browser school

Usage: bun repo ops seed [command] [local|staging] [options]

Populate demo data while supervising background-work pauses.

Commands:
  clean                    Delete school data without reseeding. Stop local dev before deleting local data.

Arguments:
  target                   Values: local, staging. Default: local.

Options:
  -h, --help               Show help for this command.
  --scope <scope>
      Seed scope. Default: all. Values: all, school, auth, auth:link, access, profile-pictures, service-account, s2s-clients, validate, doctor.
  --clean
      Delete school data before seeding; prompts unless --yes.
  -y, --yes
      Explicitly confirm the operation.
  --repair
      Run the repair chain with --scope doctor.
  --skip-profile-photos
      Skip profile-photo uploads.
  --skip-attachments
      Skip fixture attachment registration.
  --no-progress
      Disable interactive progress bars.

Examples:
  bun repo ops seed
  bun repo ops seed staging --scope doctor
  bun repo ops seed local --clean --yes

Usage: bun repo ops seed clean [local|staging] [options]

Delete school data without reseeding. Stop local dev before deleting local data.

Arguments:
  target                   Values: local, staging. Default: local.

Options:
  -h, --help               Show help for this command.
  -y, --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops seed clean local
  bun repo ops seed clean staging --yes

Usage: bun repo ops vars <command>

Manage configuration variables.

Commands:
  push                     Merge configured variables while preserving secrets and bindings.
  delete                   Delete a configuration variable.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops vars <command> --help

Usage: bun repo ops vars push <staging|production> [options]

Merge configured variables while preserving secrets and bindings.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.
  --replace-secret <name> (repeatable)
      Explicitly replace this secret with a variable.

Examples:
  bun repo ops vars push staging

Usage: bun repo ops vars delete <staging|production> <name> [options]

Delete a configuration variable.

Arguments:
  environment              Values: staging, production.
  name                     Required value.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops vars delete staging <name>

Usage: bun repo ops secrets <command>

Manage secrets without displaying values.

Commands:
  push                     Validate and upload configured secrets.
  list                     List secret names.
  delete                   Delete a secret.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops secrets <command> --help

Usage: bun repo ops secrets push <staging|production> [options]

Validate and upload configured secrets.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops secrets push staging

Usage: bun repo ops secrets list <staging|production>

List secret names.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops secrets list staging

Usage: bun repo ops secrets delete <staging|production> <name> [options]

Delete a secret.

Arguments:
  environment              Values: staging, production.
  name                     Required value.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops secrets delete staging <name>

Usage: bun repo ops pause <api|scheduler|jobs|all> <local|staging|production> [options]

Enable selected pause controls.

Arguments:
  control                  Values: api, scheduler, jobs, all.
  target                   Values: local, staging, production.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops pause api local

Usage: bun repo ops resume <api|scheduler|jobs|all> <local|staging|production> [options]

Disable selected pause controls.

Arguments:
  control                  Values: api, scheduler, jobs, all.
  target                   Values: local, staging, production.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops resume api local

Usage: bun repo ops status <local|staging|production>

Inspect operational state without exposing credentials.

Arguments:
  target                   Values: local, staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops status local

Usage: bun repo ops smoke <command>

Run explicit live smoke checks.

Commands:
  api                      Exercise the staging API.
  notify                   Create and publish a local notification.
  r2                       Upload, check and delete a staging storage object.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops smoke <command> --help

Usage: bun repo ops smoke api <staging>

Exercise the staging API.

Arguments:
  environment              Values: staging.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops smoke api staging

Usage: bun repo ops smoke notify <local>

Create and publish a local notification.

Arguments:
  environment              Values: local.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ops smoke notify local

Usage: bun repo ops smoke r2 <staging> [options]

Upload, check and delete a staging storage object.

Arguments:
  environment              Values: staging.

Options:
  -h, --help               Show help for this command.
  --curl-only
      Print a short-lived signed upload command without uploading.

Examples:
  bun repo ops smoke r2 staging

Usage: bun repo ops reset <staging> [options]

Coordinate staging reset/reseed with pause and recovery controls.

Arguments:
  environment              Values: staging.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.
  --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops reset staging --dry-run

Usage: bun repo ops recover <staging> [options]

Resume controls left paused by staging maintenance; does not retry reset or seed.

Arguments:
  environment              Values: staging.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.
  --yes
      Explicitly confirm the operation.

Examples:
  bun repo ops recover staging --dry-run

Usage: bun repo ops emergency-deploy <staging|production> [options]

Build and deploy through the emergency qualification bypass; does not migrate or seed.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.
  --yes
      Explicitly confirm the operation.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ops emergency-deploy staging --dry-run
  bun repo ops emergency-deploy staging --yes

Usage: bun repo ci <command>

Run CI verification, release and fixture operations.

Commands:
  verify                   Run repository checks, workflow lint, tooling tests, quality, builds and unit tests.
  quality                  Run repository checks, workflow lint, lint and type checks.
  build                    Build workspace and release artifacts once.
  finalize                 Qualify the built artifacts from complete matching stage evidence.
  qualify                  Verify, integrate, build and qualify a release.
  deploy                   Deploy existing qualified release artifacts.
  workflows                Validate workflow definitions.
  setup                    Prepare CI tools and framework files where applicable.
  archive-inputs           Copy lockfile inputs into release evidence.
  fixture                  Run a child command against disposable local services.
  migrate                  Migrate identity and school databases using qualified release evidence.
  resolve                  Emit the current source commit as a CI output.
  maintenance              Run staging maintenance from MAINTENANCE_DRY_RUN, MAINTENANCE_OPERATION and MAINTENANCE_CONFIRMATION workflow inputs.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci <command> --help

Usage: bun repo ci verify

Run repository checks, workflow lint, tooling tests, quality, builds and unit tests.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci verify

Usage: bun repo ci quality [command]

Run repository checks, workflow lint, lint and type checks.

Commands:
  checks                   Run repository and workflow checks.
  lint                     Run workspace ESLint checks.
  types                    Run complete incremental workspace type checks.
  finalize                 Join successful quality phases without rerunning checks.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci quality

Usage: bun repo ci quality checks

Run repository and workflow checks.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci quality checks

Usage: bun repo ci quality lint

Run workspace ESLint checks.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci quality lint

Usage: bun repo ci quality types

Run complete incremental workspace type checks.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci quality types

Usage: bun repo ci quality finalize

Join successful quality phases without rerunning checks.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci quality finalize

Usage: bun repo ci build <staging|production>

Build workspace and release artifacts once.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci build staging

Usage: bun repo ci finalize <staging|production>

Qualify the built artifacts from complete matching stage evidence.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci finalize staging

Usage: bun repo ci qualify <staging|production>

Verify, integrate, build and qualify a release.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci qualify staging

Usage: bun repo ci deploy <staging|production> [options]

Deploy existing qualified release artifacts.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.
  --dry-run
      Preview without applying remote changes.

Examples:
  bun repo ci deploy staging

Usage: bun repo ci workflows

Validate workflow definitions.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci workflows

Usage: bun repo ci setup

Prepare CI tools and framework files where applicable.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci setup

Usage: bun repo ci archive-inputs

Copy lockfile inputs into release evidence.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci archive-inputs

Usage: bun repo ci fixture <cwd> -- <command...>

Run a child command against disposable local services.

Arguments:
  cwd                      Required value.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci fixture . -- bun test tests/integration

Usage: bun repo ci migrate <staging|production>

Migrate identity and school databases using qualified release evidence.

Arguments:
  environment              Values: staging, production.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci migrate staging

Usage: bun repo ci resolve

Emit the current source commit as a CI output.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci resolve

Usage: bun repo ci maintenance

Run staging maintenance from MAINTENANCE_DRY_RUN, MAINTENANCE_OPERATION and MAINTENANCE_CONFIRMATION workflow inputs.

Options:
  -h, --help               Show help for this command.

Examples:
  bun repo ci maintenance
```

<!-- repo-commands:end -->

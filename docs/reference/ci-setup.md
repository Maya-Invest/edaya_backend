# Independent verification and releases

Each repository verifies and releases its own revision. Backend changes do not require synchronized consumer source changes, client package publication, or release manifests in sibling repositories. Cloudflare application deployments remain; no container publication is configured.

| Event | Required behavior |
| --- | --- |
| PR into `main` or `staging` | Full verification and integrations; no deployment |
| Other branch push | Quality and unit/tooling tests in parallel; no integration or release build |
| Push to `staging` | Qualify that commit, release staging |
| Push to `main` | Qualify that commit, release production |
| Manual deployment | Run `deploy.yml` on workflow branch `staging` or `main`; optionally override the source revision |
| Manual validation | Run `pr_validation.yml`; select target (default `staging`) and optional source revision; never migrate or deploy |

Deployments are serialized per repository/environment without cancelling active deployments. They depend on successful qualification; failure, cancellation or skipped qualification cannot deploy. Artifact restoration selects the unique qualified artifact from the same run and attempt, checks out its recorded source commit, restores frozen dependencies, and verifies file checksums. Deployment never resolves another backend branch or generates another client.

## Deployment prerequisites

Release workflows proceed automatically after successful qualification and migration. Migration and deployment retain their configured GitHub environment approvals and protections. No additional repository opt-in variable is required.

Deploy the backend tooling changes to the destination branches before consumers qualify against those branches: consumer integration uses the backend's typed fixture command. The `pr_validation` entry point retains caller job ID `qualification` and the reusable finalizer's inner name **Full validation**. Extracting the finalizer can change the displayed required-check context, for example to `qualification / Full validation`. Confirm the exact context on a non-deploying PR/manual rehearsal before any separately authorized branch-protection update. This consolidation does not change required checks.

Bun remains pinned to 1.3.14, Flutter to 3.44.8. Ubuntu CI and macOS development use native Git, Node.js 22+ for the third-party Wrangler CLI, archive tools and PostgreSQL binaries where needed. Validators are downloaded at pinned versions and verified against committed SHA-256 checksums. No first-party Python or Node operational runtime is required.

## Release evidence

`.ci-evidence/qualification.json` records source identity and mandatory outcomes. `.release/manifest.json` records source commit, environment, tool version, API fingerprint, artifact hashes and status. Consumer evidence includes backend commit and generated-client checksums. Evidence is an output; it does not pin another repository's future release. Private fixtures are disposable and logs are sanitized before they become retained evidence.

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

`ci qualify` composes quality, units, one workspace/release build, three integration groups and finalization. Compatibility tests and informational historical schema comparison belong exclusively to the adapters/HTTP group. Each destination push freshly qualifies its actual commit before migrating and deploying. PostgreSQL commands (`pg_config`, `initdb`, `pg_ctl`) must be available; CI setup exports their binary directory. No consumer checkout is needed.

Clients are expected to upgrade with the backend; compatibility with older clients does not block release. Checksum-pinned oasdiff 1.11.7 reports historical contract changes in `.ci-evidence/contract-changes.json`. PRs compare to the target-branch SHA; releases compare to the API definition in the last successful deployment commit for that environment, falling back to the preserved `tooling/repo/fixtures/compatibility/bootstrap.json` snapshot when no successful deployment exists. Comparison/tool errors still fail qualification. The existing `compatibility` evidence key requires the handwritten HTTP, actor-assurance and tenant-scope regression suites to pass; schema changes cannot suppress those tests. Current OpenAPI drift, generated-client and application regression checks also remain mandatory. Qualify matching frontend and mobile clients before rolling out a contract change.

## Verification execution and test fixtures

Consumer browser fixtures allocate available loopback API and file-storage ports. `EDAYA_CI_API_PORT` and `EDAYA_CI_FILES_PORT` override that selection and fail if occupied. Each invocation supplies a fresh private signing secret to the API, storage and seeder. Services publish a private PID/nonce marker only after binding; a healthy unrelated listener cannot satisfy readiness. Service exit or cancellation aborts the supervised command, cleans up only owned process groups, and retains sanitized diagnostics. Fixture ownership regressions run in the central API integration suite.


`ci verify` runs repository/workflow checks, root `quality` (Turbo lint and type-check tasks), builds, and the unit-only workspace test graph. Package `test` commands exclude `*.integration.test.ts` and load a guard that rejects database allocation and listening servers. API unit discovery includes all `src` test folders, including import recovery. Pure timetable calculations and local-file token/object-store checks stay on push; SQL workflows, local HTTP storage and Chrome rendering run as integration. The tooling suite is part of that graph and runs once. Package-level `quality` commands remain available for targeted development. CI output streams with task prefixes and timestamped verification phase durations. Command failures distinguish a timeout from `SIGINT` or `SIGTERM`; shutdown signals are not reported as timeouts.

Ordinary SQL tests can call `usePooledDatabases()` at test-file scope to borrow migrated PGlite databases. Each lease gets new repository/transaction wrappers. Release clears tables and sequences, restores initialized cron schedules, and checkpoints deferred relation files. The service application helper uses the explicit empty baseline. File hooks release leases after failed tests and close owned storage; callers can release a database earlier through `releaseDatabase(db)`. Do not use pooled fixtures for migration, schema-changing, initialization or shutdown tests. Those keep fresh constructors, as do native PostgreSQL concurrency suites.

For measurements, set `EDAYA_TEST_POOL_METRICS=true` to print initialization and acquisition counts at pool shutdown. This diagnostic variable passes through Turbo without changing task inputs. Shared fixture support and workflow definitions are included in Turbo global inputs so fixture or CI-routing changes invalidate cached checks and tests across package boundaries. Compare verification with caches bypassed and the same Bun/runtime settings; retain test counts and isolation checks alongside timings.

## Integration selection and benchmarks

`bun run test:integration` is the complete integration aggregate. Turbo runs each package’s `test:integration` command once, including the central service/HTTP, seed and native slices. `bun run repo test integration` calls that same aggregate. Package SQL tests retain their ownership and use the `*.integration.test.ts` suffix; package unit tests exclude that suffix explicitly rather than relying on inherited Bun configuration.

The HTTP slice owns production-session actor and school-repository scope regressions. Historical contract comparison runs only the separate handwritten compatibility suite, without repeating those two files. The generated-client recording assertion runs under repo codegen tests rather than living unexecuted inside generated source.

Large dashboard/enrollment benchmarks require `bun run test:benchmarks`. The native runner selects a separate benchmark directory and only sets benchmark output variables in that mode; inherited output variables cannot activate large datasets in normal integration. Normal native tests retain a small enrollment query-count/persistence regression. Required native results still fail on errors, empty reports or skipped tests. Live R2 checks remain explicit through `bun --filter @edaya/adaptor-r2 test:live`.

PRs into `staging` or `main` and release qualification run the complete integration aggregate. Feature pushes run unit verification. Destination pushes retain full qualification, exact-artifact restoration, migrations and deployment; deployment requires successful qualification and migration, plus any configured GitHub environment approvals.

## Cloudflare and migrations

Configure environment secrets `CLOUDFLARE_API_TOKEN`, `STAGING_DATABASE_URL`, `STAGING_AUTH_DATABASE_URL`, `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL` as applicable, and environment variable `CLOUDFLARE_ACCOUNT_ID`. The deployment job explicitly migrates identity and school databases before deploying the verified Worker bundle. Normal deployment never resets or seeds.

For an emergency use `bun repo ops emergency-deploy staging --dry-run`, then an explicit `--yes` to apply. It creates build evidence and uploads that build without implicit migrations/reset. This is an emergency bypass of ordinary qualification and is marked in its evidence.

## Separate staging maintenance

The **staging maintenance** workflow (`staging_maintenance.yml`) shares the staging deployment concurrency group. Its default is a read-only dry run. Applying reset/reseed or recovery requires typing `STAGING MAINTENANCE` and turning dry run off. It requires dedicated staging DB roles, direct TLS connections, and deployed Hyperdrive bindings matching the configured targets.

Configure non-secret environment variables `STAGING_DATABASE_HOST`, `STAGING_SCHOOL_DATABASE`, `STAGING_IDENTITY_DATABASE`, `STAGING_IDENTITY_ROLE`, plus the staging database/Cloudflare credentials. Seed authentication uses the existing seed configuration. Queue edit and Worker settings permissions are required for maintenance only.

Reset/reseed pauses API, scheduler, jobs and queue delivery, drains work, checks HTTP maintenance state, resets the two staging databases while preserving signing keys, seeds, then restores owned controls. Failure retains the pause. Inspect sanitized maintenance evidence and `bun repo ops status staging` before requesting the explicit recovery operation. Recovery resumes paused controls; it does not retry reset or seed. Settings operations performed outside Actions must also be serialized by the operator.

## Entrypoint migration inventory

| Previous entrypoints | Replacement or disposition |
| --- | --- |
| `.github/scripts/run-backend-integration.sh`, workflow fragments | `tooling/repo/ops/main.ts` test/CI commands; existing native/service harnesses retained |
| `scripts/release-contract.py`, sibling manifest comparisons | Removed; independent `.release` evidence and compatibility gates |
| `publish-client.mjs`, `client-publication.mjs`, client recording helpers | Removed; consumers build from pinned backend source |
| `staging-*.mjs`, `qualify-staging.sh`, `rehearse-staging.mjs`, readiness/coordinator scripts | Independent workflows, `release.ts`, `restore.ts`, `compatibility.ts`, guarded `maintenance.ts`; no consumer deployment orchestration |
| `ci_support.py`, workflow tests, workflow lint launcher | Bun evidence/workflow/process tests; checksum-pinned actionlint |
| Configuration and worker-vars `.mjs`/`.d.mts` | Typed modules in their existing configuration/operations owners |
| Local service launchers and hooks | Central process-group supervision; minimal host shell hook invoking Bun |

Backend qualification requires its handwritten HTTP suite, actor-assurance and tenant-scope regressions, and retains a checksum-pinned oasdiff report of client upgrade changes. The generated-client tests remain separate. Explicit maintenance validates both direct database connections and deployed bindings before pausing, drains background work, purges stale queue/authentication state, resets/migrates, provisions private fixture sessions, and reseeds. Failure keeps maintenance controls paused; recovery is explicit.

## Local migration rehearsal — 2026-10-11

The complete `ci qualify staging` command passed against the local working tree: repository/workflow checks, all TypeScript checks, builds, unit tests, service/HTTP integrations, seed integrations, native PostgreSQL integrations, schema compatibility and the environment-specific Worker build. All **141** tooling tests and **12** handwritten compatibility regressions passed. Native PostgreSQL reported **60** passing tests; its three optional projection benchmarks remained skipped and are not required release checks.

Staging and production Worker bundles both passed deployment dry runs using the already built bundle and explicit application configuration. No deployment, database migration, reset or reseed was performed against a hosted environment. Local evidence identifies the working tree and must not be treated as a qualified committed release candidate.

GitHub-hosted qualification, artifact handoff, deployment-history permissions, environment configuration and matching-client qualification remain operational release prerequisites.

## Reusable task composition

Every entry-point job calls a reusable workflow directly; entry points contain no inline execution jobs.

| File / workflow name | Triggers | Reusable jobs |
| --- | --- | --- |
| `branche_check.yml` / `branche_check` | Branch pushes outside `main`/`staging` | `_prepare` → `_quality_check` + `_unit_test` |
| `pr_validation.yml` / `pr_validation` | PRs into `main`/`staging`, manual dispatch | `_prepare` → quality + unit + build → integration → `_finalize` |
| `deploy.yml` / `deploy` | Pushes to `main`/`staging`, manual dispatch | Full qualification → `_migration` → `_deployment` |
| `staging_maintenance.yml` / `staging maintenance` | Manual dispatch only | `_maintenance` |

`_prepare.yml` resolves one immutable source SHA. Quality, units and build start independently after preparation; integration waits for quality and units. Caller `qualification` runs with `always()` and passes all prerequisite results to `_finalize.yml`. Its first step requires every named prerequisite to exist and succeed before checkout or artifact restoration. Failed, cancelled, skipped or missing jobs cannot publish a qualified artifact. Branch checks have no build, integration or finalization jobs.

PR validation uses the PR merge SHA and base branch (`main` → production, `staging` → staging), retaining the base SHA for compatibility checks. Manual validation accepts `target` (default `staging`) and optional `source_ref`, without migration or deployment. Branch and PR runs cancel superseded runs; manual validation has a separate `validation-<workflow-ref>-<target>` cancellation group.

Deployment has no environment selector. Its selected workflow branch determines the destination, even when `source_ref` selects another revision. `_prepare.yml` rejects tags, branches other than `main`/`staging`, and a target that disagrees with that branch before checkout or qualification. Both push and manual release use `deploy-staging` or `deploy-production` with cancellation disabled. `_maintenance.yml` keeps the staging environment gate, reset/reseed and recovery commands, dry-run default and explicit confirmation; its entry point shares `deploy-staging`.

The integration matrix has three independent runners, with sequential execution inside each: `services` (service/authorization and headless integration), `adapters-http` (remaining adapters, API/HTTP and compatibility), and `seed-native` (seed and native PostgreSQL). Each group is selectable with `bun run repo test integration --group <group>`; the default runs all three once. Discovery rejects unknown integration locations and excludes only explicit benchmark/live suites. No Bun file concurrency is added. Unit and integration results are uncached: removing dependency type-check tasks must not let imported workspace changes reuse stale test results.

Stage reports carry commit, target, run ID, attempt, result and elapsed time. Finalization invalidates any older qualification first, requires exactly one successful report per required stage, and qualifies the existing build. Starting a new local qualification also clears the previous success. Migration and deployment restore the same qualified artifact; deployment also requires matching migration evidence. These jobs preserve the existing environment protections and successful prerequisite requirements. Environments used by both jobs retain their configured review rules.

The local setup composite verifies checkout identity and shares pinned Bun/frozen installation. A checkout step precedes it because GitHub must load local actions from an existing checkout. Migration and deployment each receive only their required credentials.

For rollout, run the PR/manual graph without deployment first, verify all three integration groups and the final check display name, and then update branch protection if needed. Existing deployment concurrency and staging maintenance serialization remain in place.

## Quality timing, caching and type-check ownership

The reusable quality workflow retains one required job and exposes separate **Repository and workflow checks**, **ESLint**, **TypeScript**, and **Finalize quality evidence** steps. `bun run repo ci quality` remains the local aggregate. The workflow invokes its `checks`, `lint`, `types`, and `finalize` subcommands individually so GitHub displays each duration. Three fresh successful phase reports from the same commit, target, run and attempt are required to emit the existing `quality` stage report. Failed or skipped phases cannot qualify a candidate.

Shared setup restores Bun's package download cache and still performs `bun install --ignore-scripts --frozen-lockfile` on every run. Quality restores `.cache/quality/` (Turbo lint results and TypeScript build information) and checksum-verified validator downloads. Keys include runner OS/architecture, the lockfile, compiler/linter configuration and checker/setup implementation, with a source-SHA suffix and a compatible prior-SHA restore prefix. Cache restoration never skips a quality step. Turbo may still print `Remote caching disabled`: the lint cache is restored local data, without a hosted Turbo cache service. Neither qualification evidence, test results, release outputs nor `node_modules` is cached.

Lint cache inputs explicitly include the shared root ESLint configuration and import-order rules. Workflow-only edits no longer invalidate every Turbo task; workflow validation and uncached workflow unit tests still run against the current files.

`bun run check` discovers every workspace `check` command and runs the TypeScript compiler directly, with one incremental state file per compiler project and two workers by default. `EDAYA_TYPECHECK_CONCURRENCY=1..4` changes that bound. Unrecognized check commands fail instead of being omitted. Document-template freshness validation remains mandatory on warm runs. Standalone package checks remain available.

API source/tests, central integration tests and API-facing repository tools share the integration compiler project: **24 compiler invocations become 22**. All other original projects retain their settings. Before consolidation, the runner verifies every absorbed root file, compiler constraint and existing alias is retained. A future incompatible configuration or missing file fails the plan. TypeScript still runs on every invocation and validates imported-file changes through its incremental engine; no cached success marker bypasses the compiler. Compiler durations and outcomes are uploaded in the separate quality-details artifact.

Pinned Bun 1.3.14 local verification measured **73.63 seconds cold / 14.20 seconds warm** for all 22 compiler projects with identical source fingerprints across both runs. Cold ESLint took **49.52 seconds**; a subsequent run took **6.80 seconds** with 19 of 20 task results reused after a tooling edit. A subsequent full warm local quality aggregate passed with 19.28 seconds of phase time, and the full unit lane passed 1,390 tests across 298 files in 24 seconds (including concurrent seeding changes). These are local measurements, not GitHub runner promises; the first hosted run must populate the new caches. A warm-cache regression check changes an imported type, verifies the compiler rejects it, repairs the consumer, and verifies recovery without deleting incremental state.

The owned testing API runs serial background heartbeats so bounded grading, billing, import and document jobs finish as they do under scheduled execution. This loop is enabled only for an owned fixture with its readiness identity. A heartbeat failure terminates that fixture; shutdown stops scheduling and awaits active work before closing the database runtime.

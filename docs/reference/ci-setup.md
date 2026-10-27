# Independent verification and releases

Each repository verifies and releases its own revision. Backend changes do not require synchronized consumer source changes, client package publication, or release manifests in sibling repositories. Cloudflare application deployments remain; no container publication is configured.

| Event | Required behavior |
| --- | --- |
| PR into `main` or `staging` | Full verification and integrations; no deployment |
| Other branch push | Repository checks, lint/types, builds and unit/tooling tests; SQL/composition suites excluded |
| Push to `staging` | Qualify that commit, release staging |
| Push to `main` | Qualify that commit, release production |
| Manual deployment | Select revision in the environment's deployment workflow; use the same qualification and deployment jobs |
| Manual validation | Select environment, revision, and optionally a backend reference; never deploy |

Deployments are serialized per repository/environment without cancelling active deployments. They depend on successful qualification; failure, cancellation or skipped qualification cannot deploy. Artifact restoration selects the unique qualified artifact from the same run and attempt, checks out its recorded source commit, restores frozen dependencies, and verifies file checksums. Deployment never resolves another backend branch or generates another client.

## Adoption gate

Replacement deployment jobs require repository variable `ENABLE_INDEPENDENT_RELEASES=true`. Leave it unset until full local verification, both destination builds, all integration suites, artifact handoff, and non-deploying GitHub rehearsals pass. No production release is implied by installing this tooling.

Deploy the backend tooling changes to the destination branches before consumers qualify against those branches: consumer integration uses the backend's typed fixture command. Configure branch protection to require **qualification / Full validation** from the PR workflow (confirm the exact displayed check name on the first rehearsal). Remove obsolete coordinator/publication checks only after that required check succeeds. GitHub may display the caller workflow name as an additional prefix.

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

`ci qualify` runs verification, package SQL/composition tests, service/HTTP, seed and native PostgreSQL integrations, then the separate handwritten API regressions, an informational historical schema comparison and the environment-specific dry-run Worker build. PostgreSQL commands (`pg_config`, `initdb`, `pg_ctl`) must be available; CI setup exports their binary directory. No consumer checkout is needed.

Clients are expected to upgrade with the backend; compatibility with older clients does not block release. Checksum-pinned oasdiff 1.11.7 reports historical contract changes in `.ci-evidence/contract-changes.json`. PRs compare to the target-branch SHA; releases compare to the API definition in the last successful deployment commit for that environment, falling back to the preserved `tooling/repo/fixtures/compatibility/bootstrap.json` snapshot when no successful deployment exists. Comparison/tool errors still fail qualification. The existing `compatibility` evidence key requires the handwritten HTTP, actor-assurance and tenant-scope regression suites to pass; schema changes cannot suppress those tests. Current OpenAPI drift, generated-client and application regression checks also remain mandatory. Qualify matching frontend and mobile clients before rolling out a contract change.

## Verification execution and test fixtures

`ci verify` runs repository/workflow checks, root `quality` (Turbo lint and type-check tasks), builds, and the unit-only workspace test graph. Package `test` commands exclude `*.integration.test.ts` and load a guard that rejects database allocation and listening servers. API unit discovery includes all `src` test folders, including import recovery. Pure timetable calculations and local-file token/object-store checks stay on push; SQL workflows, local HTTP storage and Chrome rendering run as integration. The tooling suite is part of that graph and runs once. Package-level `quality` commands remain available for targeted development. CI output streams with task prefixes and timestamped verification phase durations. Command failures distinguish a timeout from `SIGINT` or `SIGTERM`; shutdown signals are not reported as timeouts.

Ordinary SQL tests can call `usePooledDatabases()` at test-file scope to borrow migrated PGlite databases. Each lease gets new repository/transaction wrappers. Release clears tables and sequences, restores initialized cron schedules, and checkpoints deferred relation files. The service application helper uses the explicit empty baseline. File hooks release leases after failed tests and close owned storage; callers can release a database earlier through `releaseDatabase(db)`. Do not use pooled fixtures for migration, schema-changing, initialization or shutdown tests. Those keep fresh constructors, as do native PostgreSQL concurrency suites.

For measurements, set `EDAYA_TEST_POOL_METRICS=true` to print initialization and acquisition counts at pool shutdown. This diagnostic variable passes through Turbo without changing task inputs. Shared fixture support and workflow definitions are included in Turbo global inputs so fixture or CI-routing changes invalidate cached checks and tests across package boundaries. Compare verification with caches bypassed and the same Bun/runtime settings; retain test counts and isolation checks alongside timings.

## Integration selection and benchmarks

`bun run test:integration` is the complete integration aggregate. Turbo runs each package’s `test:integration` command once, including the central service/HTTP, seed and native slices. `bun run repo test integration` calls that same aggregate. Package SQL tests retain their ownership and use the `*.integration.test.ts` suffix; package unit tests exclude that suffix explicitly rather than relying on inherited Bun configuration.

The HTTP slice owns production-session actor and school-repository scope regressions. Historical contract comparison runs only the separate handwritten compatibility suite, without repeating those two files. The generated-client recording assertion runs under repo codegen tests rather than living unexecuted inside generated source.

Large dashboard/enrollment benchmarks require `bun run test:benchmarks`. The native runner selects a separate benchmark directory and only sets benchmark output variables in that mode; inherited output variables cannot activate large datasets in normal integration. Normal native tests retain a small enrollment query-count/persistence regression. Required native results still fail on errors, empty reports or skipped tests. Live R2 checks remain explicit through `bun --filter @edaya/adaptor-r2 test:live`.

PRs into `staging` or `main` and release qualification run the complete integration aggregate. Feature pushes run unit verification. Destination pushes retain full qualification, exact-artifact restoration, migrations and deployment; deployment remains gated by `ENABLE_INDEPENDENT_RELEASES`.

## Cloudflare and migrations

Configure environment secrets `CLOUDFLARE_API_TOKEN`, `STAGING_DATABASE_URL`, `STAGING_AUTH_DATABASE_URL`, `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL` as applicable, and environment variable `CLOUDFLARE_ACCOUNT_ID`. The deployment job explicitly migrates identity and school databases before deploying the verified Worker bundle. Normal deployment never resets or seeds.

For an emergency use `bun repo ops emergency-deploy staging --dry-run`, then an explicit `--yes` to apply. It creates build evidence and uploads that build without implicit migrations/reset. This is an emergency bypass of ordinary qualification and is marked in its evidence.

## Separate staging maintenance

The **Staging maintenance** workflow shares the staging deployment concurrency group. Its default is a read-only dry run. Applying reset/reseed or recovery requires typing `STAGING MAINTENANCE` and turning dry run off. It requires dedicated staging DB roles, direct TLS connections, and deployed Hyperdrive bindings matching the configured targets.

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

GitHub-hosted qualification, artifact handoff, deployment-history permissions, environment configuration and matching-client qualification remain required before enabling the adoption gate.

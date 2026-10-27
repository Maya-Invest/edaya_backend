# Backend test suite analysis and cleanup plan

**Status:** Proposal · **Date:** 2026-10-26 · **Scope:** Backend tests, CI qualification and deployment triggers

The backend needs a clear separation between fast unit feedback and tests that compose databases, services and HTTP. The current CI events largely match the requested workflow, but the suite called “unit” contains substantial integration work. The first cleanup should correct that boundary and remove proven repeat execution. Consolidation and retirement should follow only where the surviving test covers the same failure.

The requested outcome is unit tests on branch pushes, strong integration coverage on PRs into `staging` or `main`, and deployment on pushes to those destination branches. Coverage means protection of important behavior; the historical near-100% line-coverage campaign should remain closed.

## Inventory and measurements

The working tree contains **493 TypeScript test files**, **52,002 lines in those files**, and **2,373 lexical test declarations**. Parameterized tests and loops expand at runtime, so declarations are not executed test counts. Support files and snapshots are not included in the line total.

| Area | Files | Test code lines | Files with detected PGlite dependencies |
| --- | ---: | ---: | ---: |
| Domain core | 65 | 4,143 | 0 |
| Domain service | 137 | 21,078 | 77 |
| API including identity tests | 83 | 8,407 | At least 17 |
| Postgres adaptor | 40 | 3,236 | 28 |
| Authorization | 19 | 1,845 | 10 |
| Integration package | 49 | 6,285 | Not a classification metric for this package |
| Other packages and tooling | 100 | 7,008 | At least 7 |

At least **139 files outside the integration package** reach a PGlite fixture, representing 22,196 lines of test code. This is a dependency-based lower bound: the scan follows local test/support imports and does not follow every production composition path. A file can mix pure and database cases; the count does not mean every test in it uses SQL. API identity/runtime tests require additional manual classification.

There are 491 committed test files at `5d20b668`; two additional pool tests are untracked. Existing modifications span test fixtures, test callers, CI documentation and verification orchestration. This proposal preserves that work.

Sequential local samples on the current working tree passed:

| Sample | Executed tests | Process wall time | Fixture observation |
| --- | ---: | ---: | --- |
| Entire core package | 330 | 0.18 s | Pure domain tests |
| Entire authorization package | 112 | 29.36 s | Ten SQL pools initialized |
| Guardian relationship policy file | 3 | 2.10 s | One initialization, three leases |
| Mixed timetable generation file | 45 | 7.58 s | One initialization, 31 leases |
| Pure timetable solver equivalence file | 24 | 0.34 s | No SQL fixture |
| API command-policy parity file | 4 | 3.17 s | One initialization, four leases |

These **518 passing tests** are diagnostic samples, not a full qualification. Local Bun is **1.4.4** while CI pins **1.3.14**; use the pinned runtime for acceptance measurements. Existing pooling changes are included. Retained Turbo logs separately show service at 371 s, API at 212 s and Postgres at 105 s, but those logs span different executions and fixture revisions; adding them would not produce a valid current CI duration.

The [inventory and diagnostic logs](../../../bin/backend-test-suite-audit-2026-10-26/) preserve file classifications, dependency paths, timings and methodology.

## What changed from the original design

The July [test pyramid plan](test-pyramid-plan.md) called for hermetic package unit tests, explicit integration slices, and operational smokes outside the unit gate. The [current unit-test policy](../reference/unit-test-coverage.md) already says to keep a test only when it is the cheapest protection for a distinct behavior. Those remain sound principles.

Committed test files grew from 357 at the July 7 snapshot to 407 on September 25, 443 on October 11 and 491 at the current HEAD. Historical package counts are affected by the core/service/authorization split and package removals, so file growth alone does not establish waste. The clearer drift is that shared helpers now compose production SQL, while package scripts still call the resulting suites unit tests.

### Database composition has entered the unit lane

`package/domain-service/tests/support/create-test-app.ts` builds production repositories, transactions, a command journal and durable work. Its database helper reaches the Postgres fixture, whose `repositories.init()` runs school migrations. A local database remains an integration dependency even when it is embedded and needs no network.

Ten files under authorization `tests/unit-auth/` directly use Postgres fixture helpers. They verify valuable policy-to-SQL behavior, but they are integration tests. The API's `tests/support/native-policy-app.ts` also uses PGlite despite its name. Notification tests use a PGlite runtime that applies four historical migration files directly.

The current preload imports service database cleanup for all root test files and all service package files. This does not allocate a database for every test, but it couples the ordinary test bootstrap to the SQL harness. The package-specific `bunfig.toml` files also mean root configuration is not a sufficient control over workspace test discovery.

**Treatment:** preserve SQL assertions, move them into explicit integration ownership, and give pure unit tests a bootstrap without database lifecycle hooks. Split mixed files before moving them. Do not replace production authorization SQL with a second hand-written authorization implementation just to label those tests unit.

### Qualification repeats some suites

`tooling/repo/ops/execute.ts` runs service/HTTP integration, seed integration and native integration. It then calls `compatibility.ts`, which runs the handwritten compatibility suite plus:

- `src/auth/production-session-actor.integration.test.ts`
- `src/routes/test-school-repository-scope.integration.test.ts`

Those two files already run in the HTTP integration slice. Their second execution is confirmed overlap. The handwritten `src/compatibility` tests are a separate suite and must still run once.

Committed verification also runs the tooling suite explicitly before running the workspace test graph, which includes tooling. Existing uncommitted changes already remove that extra invocation. Do not redo that fix. The current working tree also changes root quality from package `quality` scripts to separate lint/check tasks; retain its intended removal of repeated type checking through the Turbo dependency graph.

**Treatment:** define one integration aggregation path, execute each required suite once, and derive qualification evidence from those outcomes. Keep schema comparison reporting independent from execution of behavioral tests.

### Performance work has become an ordinary release requirement

The native runner sets `EDAYA_BENCHMARK_OUTPUT` to a default path. The dashboard benchmark enables itself whenever that variable exists. Consequently the normal native run enables the 30, 300 and 3,000 student benchmark cases, including reference calculations and `EXPLAIN ANALYZE`. Older CI documentation describes those cases as optional/skipped.

The enrollment benchmark has a different contract: without its own output variable it still runs a small three-student query-count regression. That small protection should be reviewed separately from the large benchmark datasets.

**Treatment:** make large benchmarks explicitly opt-in through a separate command. Keep small deterministic correctness and query-count checks in ordinary integration. Required tests should still fail on unexpected skips; intentional benchmark exclusions belong in suite selection, not a weakened result validator.

### Migration tests need lifecycle ownership

The Postgres package has **19 files with “migration” in their filename** and **53 school SQL migrations**. There is valuable diversity here:

- `notification-schema-migration.test.ts` checks fresh installation, rerun safety and preservation of legacy delivery state.
- `permission-profile-cutover-migration.test.ts` checks a destructive-cutover guard and unchanged legacy data on rejection.
- `flat-guardian-contacts-migration.test.ts` checks defaults and refusal to discard populated contacts.
- `drizzle-journal-parity.test.ts` checks filesystem metadata and needs no database.

These should not all run on every feature push. They also should not all be deleted as historical clutter. Some fixtures build isolated predecessor schemas, while others replay a substantial migration prefix; their cost and safety value differ.

**Treatment:** retain fast journal checks on push. Run fresh installation, rerun safety, supported upgrade paths and destructive-change guards in PR integration against disposable native PostgreSQL. Initially retain existing migration cases while relocating them. Later consolidate repeated table-existence/default checks into the fresh-schema contract. Retire a historical transition only after deployment evidence shows no supported environment or restore baseline still needs it. Test retirement does not authorize deleting shipped SQL migrations.

### Execution ownership and documentation are inconsistent

The root integration command includes service/HTTP slices but excludes seed, native and compatibility; `repo test integration` aggregates more suites. The difference is documented in places but easy to miss. A live R2 integration test still lives in its adaptor with a separate script. Conversely, the integration package contains pure tests of the native result parser and mocked staging smoke behavior.

`package/api-client/src/generated/create-client.test.ts` has no workspace `test` script and is excluded by root Bun discovery. It can return successfully without asserting anything if bindings are empty. Preserve useful generated-client behavior in the existing codegen or HTTP contract owner, assert that expected bindings exist, and remove the orphan once that protection is established.

`unit-test-coverage.md` says PRs run an informational coverage job, but current workflows do not invoke coverage. Root Turbo test tasks also declare no lcov outputs for cache restoration. Fix documentation and reporting together; avoid a second full test pass on every push merely to collect coverage.

## Desired test ownership

Use package-local unit tests for domain invariants, calculations, parsers, policy composition with small port fakes, transport mapping and error translation. Tests that require production repository behavior remain integration tests. An in-process HTTP request with mocked ports can be a unit test; an in-process request composing identity, services and SQL is integration even without a listening server.

Use `tooling/integration-tests` as the final home for composed backend tests, restoring the existing pyramid plan. Its support code owns shared SQL and application fixtures rather than importing another package's private test harness. Keep test fixtures narrowly scoped and preserve separation between school and identity persistence.

Proposed integration folders describe responsibilities: `persistence`, `services`, `http`, `migrations`, `native`, and `seed`. Keep large `benchmarks` outside the ordinary integration selector. These folders do not require a new abstraction framework or a registry entry for every test.

| Behavior | Primary owner | Additional protection worth retaining |
| --- | --- | --- |
| Validation, money arithmetic, report aggregation, solver rules | Pure unit | One persisted business journey where composition matters |
| Actor/grant construction and policy decision branches | Unit with narrow port fakes where practical | Production SQL scope semantics, pagination/count filtering and live relationship changes |
| Generic repository CRUD/filter/batch behavior | Shared persistence contract | Entity-specific mappings, precision, JSONB and custom queries |
| HTTP parsing, status/error mapping, authentication wiring | HTTP contract integration or isolated route unit | A generated-client journey through the actual router |
| Finance writes, commands, outbox and cron | Service integration | Native independent connections for locking, idempotency, lease ownership and concurrency |
| Schema installation and supported upgrades | Migration integration | Destructive-change refusal and preserved data |
| Seed plan construction and input validation | Unit | Small real HTTP seed journey; full datasets on relevant changes |

Both policy and HTTP tests can be justified when they prove different failures. Remove a higher-layer case only when its inputs, failure mechanism and observable result are already protected and it adds no mapping, persistence or composition branch.

## Proposed CI and deployment behavior

| Event | Required execution | Deployment |
| --- | --- | --- |
| Push to a feature branch | Repository/workflow checks, lint/types, necessary generated-artifact checks, pure unit suite | None |
| PR targeting staging or main | Integration over persistence, service journeys, HTTP, supported migrations and native concurrency; small seed journey | None |
| Push to staging | Qualify the actual release revision, build staging artifact, apply identity/school migrations, deploy, bounded smoke | Staging |
| Push to main | Qualify the actual release revision, build production artifact, apply identity/school migrations, deploy, bounded smoke | Production |
| Explicit performance or provider validation | Large benchmarks, full seed rehearsal or live provider checks | None unless separately requested |

The existing YAML already implements the main event routing. Feature pushes currently run full `ci verify`, including lint/types, workspace build and the mislabeled unit graph. PRs run full qualification. Destination pushes run full qualification again before deployment. `ENABLE_INDEPENDENT_RELEASES` gates the deployment job; the repository variable's live value was not established by this local audit. Deployment environments and branch protection also need a one-time settings check during implementation.

Preserve serialized deployments, qualified artifact restoration, artifact checksum checks and migrations before deployment. Ordinary deployment must not reset or seed hosted databases. Keep emergency and staging-maintenance paths separate.

Do not skip a release qualification merely because its PR was green. A PR merge reference, feature HEAD, squash commit and release SHA may differ. Initially keep qualification of the actual destination commit, using the smaller corrected suites. Later reuse successful evidence only when the source revision, inputs and target build match; otherwise run the needed checks. Production still needs its own environment-specific bundle. Likewise, a PR should revalidate units against a changed merged tree when only the feature HEAD was checked on push.

Full demo seeding should be required for PR changes affecting seeding, fixtures, onboarding, identity composition, runtime/migration wiring or seed contracts; use a small smoke journey on ordinary PRs. Start conservatively with the existing full seed requirement until a reliable dependency rule is agreed. No nightly automation is needed for the initial cleanup.

## Phased implementation

### Phase 1 Establish the baseline and remove confirmed repetition

1. Record the current working tree and preserve the pending pool/orchestration changes as a separate baseline.
2. Measure uncached push and PR lanes on pinned Bun 1.3.14. Record suite counts, initialization counts and wall time; include cold fixture startup.
3. Confirm tooling executes once, remove the two repeated compatibility invocations, and retain the handwritten HTTP regressions once.
4. Separate large dashboard benchmarks from mandatory native integration. Keep the small enrollment query-count regression.
5. Correct stale coverage and benchmark documentation.

Acceptance: identical required behavioral coverage, each required suite executes once, no large benchmark activated merely by choosing an evidence output path, and no change to release approval/evidence requirements.

### Phase 2 Restore the unit and integration boundary

1. Classify the detected SQL files and manually inspect API runtime/identity cases missed by the helper scan.
2. Pilot the split in authorization and the mixed timetable file. Keep pure solver/resolver cases on push; move SQL policy scope and workflow cases to integration without weakening assertions.
3. Move service SQL cases, repository/migration cases, notification persistence and composed API cases in small package-sized batches. A temporary `tests/unit` versus `tests/integration` split is acceptable while moving to the central integration owner.
4. Relocate shared fixtures before updating callers. Pure unit bootstrap must not own SQL cleanup. Integration bootstrap must clean its own databases after failed cases.
5. Give `test`/`test:unit` unambiguous unit-only semantics and one documented PR integration aggregate. Keep explicit diagnostic slices; do not add overlapping default entrypoints.
6. Fold a small fixture-import rule into the existing boundary checker to prevent SQL harnesses returning to the unit selector.

Acceptance: the push test selector initializes no database, launches no application server and requires no provider credentials. Every relocated case appears in the PR selector. Files mixing pure and SQL tests are split rather than moved wholesale. Integration continues to cover both staff and family/teacher portals.

### Phase 3 Consolidate repeated behavior

Review these areas first:

| Candidate | Concrete action | Protection to preserve |
| --- | --- | --- |
| `authorization-policies-pglite.test.ts` and policy-focused service/authorization suites | Split the 895-line omnibus by behavior; compare scope, revocation, delegation and workflow cases before deleting repeats | Production SQL filters, existing/proposed targets, tenant/year restrictions |
| `entity-config-save-gates`, delete/edge/tenant gate suites | Share generic managed-entity operation cases; retain custom gates separately | Atomic batches and domain-specific rejects |
| `timetable-generation.test.ts` and integration timetable lifecycle/native regeneration | Keep pure algorithm rules local; consolidate overlapping persisted lifecycle scenarios | Rollback, academic locking, preserved sessions and occupancy |
| `query-services` and dedicated query suites | Keep query calculations with small inputs; assert SQL scoping in one integration owner | Counts/pagination, year and tenant scope |
| Generic Postgres store, entity store and repository CRUD suites | One generic persistence contract plus custom mapping cases | Filtering, chunk boundaries, decimal/date/JSONB conversions |
| Notification unit-looking SQL harness and native outbox suite | Keep format/recipient calculations pure; consolidate persistence coverage by delivery behavior | Tenant isolation, committed intent, retry and deduplication |
| Generated-client orphan and existing codegen/HTTP tests | Give the useful assertion one executing owner, then remove orphan code | Router/client request and response contract |

For each deletion, record the surviving assertion and the failure it detects in the PR. Compare by behavior and failure boundary, not matching filenames. Avoid adding hundreds of synthetic tests or a permanent test registry to justify the cleanup. Preserve small readable cases over huge matrices with opaque failures.

Acceptance: fewer redundant scenarios and helpers, preserved distinct failure protections, and a smaller maintenance surface. There is no percentage-of-tests-to-delete target.

### Phase 4 Consolidate migration history and simplify release execution

1. Add or identify one native fresh-install and rerun contract for school and identity schemas.
2. Identify supported upgrade/restore baselines from actual environment history. Keep their transformations and destructive guards; retire obsolete transitions only with that evidence.
3. Make required check names explicit for units and integration, updating branch protection only after the new checks have succeeded. During migration, preserve the existing aggregate qualification check so protection cannot silently disappear.
4. Confirm push-to-staging/main deployment wiring and adoption-gate settings. Preserve qualification evidence and exact-artifact requirements when changing orchestration.
5. Add a small post-deployment smoke against read/auth paths that the deployed runtime must serve; keep provider/load checks separate. Resolve the credentials and fixture scope before enabling a live smoke.
6. Consider evidence reuse only after the corrected lanes are stable and exact-revision identity is proven.

Acceptance: supported migrations run against native PostgreSQL; destination pushes release the qualified revision; smoke failure is visible and cannot be reported as a healthy release. No implicit reset/reseed or automatic rollback is introduced.

## Completion criteria

- Fast push feedback is bounded by lint/types and pure tests, with a proposed test-only budget of **under 30 seconds** and total push check budget of **under five minutes** on the chosen CI runner.
- PR integration has a proposed **under ten minutes** critical-path budget, measured before deciding whether independent jobs or sharding are necessary. Budgets are targets, not measured promises or reasons to drop unique protections.
- Required PR coverage includes actor assurance and revocation; staff/teacher/guardian/student boundaries; school/year scope before pagination/counts; proposed and current write targets; finance atomicity; command/outbox/cron concurrency; private-file access/lifecycle; marks and published report behavior; timetable locking; supported migrations; and representative onboarding/seed wiring.
- Coverage reports are informational and clearly scoped. Do not introduce a global near-100% target; use missing decision branches in important modules to guide review.
- Every test file is intentionally owned by an executing lane, an explicit opt-in suite or a documented retirement. Unexpected zero-test success and unexpected required skips remain failures.
- The default local commands, CI commands and documentation describe the same lanes. `AGENTS.md`, package scripts, Bun configuration, repo CLI, Turbo tasks and required check names change together where necessary.

The recommended first implementation is Phases 1 and 2. Most immediate value comes from correcting execution ownership while preserving assertions. Phase 3 then reduces actual maintenance duplication, and Phase 4 retires history only where operational evidence supports it.

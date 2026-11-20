# Backend test suite analysis and cleanup plan

**Status:** Lane cleanup implemented; consolidation backlog remains · **Updated:** 2026-10-27 · **Audit base:** `53a45742` · **Scope:** Backend tests, CI qualification and deployment triggers

The committed optimizations improve fixture reuse, cleanup, task orchestration and visibility. They resolve the duplicate tooling invocation and reduce database setup work. The remaining cleanup is primarily a separation between fast unit feedback and tests that compose databases, services and HTTP, plus repeated integration execution and historical test consolidation.

The requested outcome is unit tests on branch pushes, strong integration coverage on PRs into `staging` or `main`, and deployment on pushes to those destination branches. Coverage means protection of important behavior; the historical near-100% line-coverage campaign should remain closed.

## Implemented cleanup

The implementation following this audit keeps package ownership and uses explicit `*.integration.test.ts` selectors. There are **292 unit files**, **203 integration files** (including the separate handwritten compatibility suite), **two opt-in benchmark files**, and **one explicit live R2 file**. Of the integration files, 157 belong to their application/adaptor/domain packages; composed cross-package journeys remain in `tooling/integration-tests`.

- Push verification runs package unit commands with an exclusion for integration files and a preload that rejects PGlite allocation and listening servers. SQL cleanup hooks load only for service integration.
- Pure timetable solver/resolver cases, local-file token/object-store cases and mocked PDF transport cases remain on push. SQL workflows, listening HTTP storage and real Chrome rendering run as integration.
- `bun run test:integration` and `bun run repo test integration` select the same complete package/service/HTTP/seed/native aggregate. Qualification delegates once to that aggregate, with seed/native selected there instead of through additional root invocations.
- Compatibility comparison runs its separate handwritten HTTP suite once. Production-session actor and school-repository scope cases execute only in their HTTP slice.
- `bun run test:benchmarks` selects a separate benchmark directory on disposable native PostgreSQL. Ordinary native/seed runs remove inherited benchmark-output variables and retain the small enrollment query-count/persistence check. Required native results still reject failures, empty reports and unexpected skips.
- API unit discovery now includes all `src` test folders, executing the two import-recovery tests. The generated-client assertion now executes in repo codegen tests, rejects missing bindings and is no longer emitted as an unexecuted generated source file. Pure native-result and mocked-smoke tests also run in the tooling unit lane.
- PRs into staging/main retain full qualification. Pushes to staging/main retain full qualification, exact-artifact restoration, migrations and deployment with qualification, migration and environment protections. The temporary migration opt-in has since been removed. No hosted setting, deployment or migration was applied during implementation.

Final verification on Bun 1.3.14 passed **1,372 unit tests across all 292 unit files** and **1,288 integration tests across 203 files** across the aggregate and affected-slice rerun. `bun run verify` passed repository/workflow checks, lint/types, builds and units; its test phase took 20.39 seconds and its complete cold verification about 4½ minutes locally. The initial complete integration aggregate took about 23 minutes and exposed two stale native publication fixtures. After supplying reviewed-draft tokens and an explicit two-decimal grading scale, all 76 native tests passed in a full native-slice rerun. The race tests now exercise admitted reviewed requests, reject stale publication and verify successful publication after regeneration/review. Production rules were not changed. The already passing package, service/HTTP and seed slices were not redundantly rerun. The separate handwritten compatibility suite passed three tests. [Execution evidence](../../../bin/backend-test-suite-audit-2026-10-27/implementation-verification.json) records the results and initial failure. Large benchmarks and live R2 tests were not run. The earlier proposed ten-minute budget is superseded by behavior-preserving optimization without a fixed runtime target; further runtime work should target fixture startup, seed cost and bounded parallelism. The earlier findings and measurements below describe the audit base before this implementation; the completed execution changes are no longer backlog items. Behavioral consolidation and retirement of historical migrations remain separate follow-up work.

## Optimization review

Commit `53a45742` contains the earlier pending optimizations. Most of that implementation was already present in the first audit's working tree and timing samples; those samples must not be presented as an unoptimized baseline.

| Change | Current assessment | Effect on the cleanup plan |
| --- | --- | --- |
| Explicit tooling run removed from `ci verify` | Resolved; tooling participates once through the workspace graph | Remove duplicate-tooling work from the backlog |
| Root quality invokes Turbo `lint check` directly | Implemented; explicit check tasks can share dependency results instead of repeating nested package quality scripts | Preserve the orchestration change |
| Shared PGlite pool and file-scoped lease hooks | Implemented across authorization, repository, service and API cases | Preserve fixture reuse; SQL cases still belong to integration |
| New repository and transaction wrappers per lease | Implemented and exercised by isolation tests | Reuse storage without retaining application wrappers |
| Reset covers secondary application schemas | Implemented; application tables and sequences are cleared while migration history remains | Preserve the targeted regression test; it protects fixture correctness |
| Pool failure cleanup, leak detection and checkpoints | Implemented and exercised by pool/lifecycle tests | Retain these protections when relocating the harness |
| Streaming logs, phase durations and pool metrics | Implemented | Use existing diagnostics instead of creating another timing framework |
| Shared fixture directories included in Turbo global inputs | Implemented; fixture changes invalidate cached dependent work across package boundaries | Preserve cache correctness; broad invalidation is a deliberate tradeoff, not a reason to remove the dependency inputs |
| Unit versus integration selection | Still pending | Highest remaining structural priority |
| Two repeated compatibility regression suites | Still pending | Remove duplicate execution while preserving required outcomes |
| Large dashboard benchmarks in native default | Still pending | Separate benchmark selection from required integration |

No test files were added, removed or moved relative to the first audit's working-tree inventory. One secondary-schema isolation case was added to an existing pool test file: **20 lines and one lexical declaration**. That focused protection supports the optimization rather than indicating renewed coverage-driven expansion.

## Inventory and measurements

The audited revision contains **493 TypeScript test files**, **52,022 lines in those files**, and **2,374 lexical test declarations**. Parameterized tests and loops expand at runtime, so declarations are not executed test counts. Support files and snapshots are not included in the line total.

| Area | Files | Test code lines | Files with detected PGlite dependencies |
| --- | ---: | ---: | ---: |
| Domain core | 65 | 4,143 | 0 |
| Domain service | 137 | 21,078 | 77 |
| API including identity tests | 83 | 8,407 | At least 17 |
| Postgres adaptor | 40 | 3,256 | 28 |
| Authorization | 19 | 1,845 | 10 |
| Integration package | 49 | 6,285 | Not a classification metric for this package |
| Other packages and tooling | 100 | 7,008 | At least 7 |

At least **139 files outside the integration package** reach a PGlite fixture, representing 22,216 lines of test code. This is a dependency-based lower bound: the scan follows local test/support imports and does not follow every production composition path. A file can mix pure and database cases; the count does not mean every test in it uses SQL. API identity/runtime tests require additional manual classification. Pooling reduces setup work but does not change this classification.

All 493 test files are now committed at `53a45742`; the working tree was clean when the refresh began. The earlier audit used committed base `5d20b668` plus pending fixture/orchestration changes, including two then-untracked pool test files.

Fresh sequential samples using **Bun 1.3.14**, the CI-pinned version, passed at the audited revision:

| Sample | Executed tests | Process wall time | Fixture observation |
| --- | ---: | ---: | --- |
| Entire core package | 330 | 0.29 s | Pure domain tests |
| Entire authorization package | 112 | 20.33 s | Ten initializations for 65 leases |
| Guardian relationship policy file | 3 | 4.48 s | One initialization, three leases |
| Mixed timetable generation file | 45 | 6.71 s | One initialization, 31 leases |
| Pure timetable solver equivalence file | 24 | 0.40 s | No SQL fixture |
| API command-policy parity file | 4 | 5.59 s | One initialization, four leases |
| Shared pool isolation and failure lifecycle | 8 | 12.34 s | Includes secondary-schema reset and cleanup after intentionally failed child tests |
| Service pool and preload lifecycle | 3 | 1.96 s | One initialization, six leases |
| Verification runtime and workflow contracts | 14 | 3.77 s | Process supervision and CI/deployment contracts |
| Import recovery file run explicitly | 2 | 0.07 s | Pure async lifecycle tests currently outside the API package selector |

These **545 passing tests** are diagnostic samples, not a full qualification. Process wall times include startup. The initial repeat used local Bun 1.4.4; the table uses a separate run with the already installed Bun 1.3.14, including that executable on child-process PATH. Single-run variation and runtime differences prevent a controlled comparison with the first audit's samples.

Newer retained Turbo logs provide supporting evidence that the expensive packages are faster:

| Package | Earlier retained duration quoted by first audit | Newer retained duration | Tests in newer log |
| --- | ---: | ---: | ---: |
| Service | 371.25 s | 223.93 s | 1,013 |
| API | 211.82 s | 144.24 s | 416 |
| Postgres | 105.22 s | 80.57 s | 236 |

The newer logs report Bun 1.3.14 and were written before the optimization commit. They support the working-tree optimization results, but are not exact-commit CI proof or a controlled before/after benchmark. Do not sum these package times into a claimed pipeline duration. No fresh full push, PR or release qualification was run for this documentation refresh.

The [refreshed inventory and diagnostic logs](../../../bin/backend-test-suite-audit-2026-10-27/) preserve classifications, inventory differences, current task-graph inputs and measurements. The [first audit evidence](../../../bin/backend-test-suite-audit-2026-10-26/) remains available for historical comparison.

## What changed from the original design

The July [test pyramid plan](test-pyramid-plan.md) called for hermetic package unit tests, explicit integration slices, and operational smokes outside the unit gate. The [current unit-test policy](../reference/unit-test-coverage.md) already says to keep a test only when it is the cheapest protection for a distinct behavior. Those remain sound principles.

Committed test files grew from 357 at the July 7 snapshot to 407 on September 25, 443 on October 11, 491 at the first audit's committed base and 493 at `53a45742`. Historical package counts are affected by the core/service/authorization split and package removals, so file growth alone does not establish waste. The clearer drift is that shared helpers compose production SQL, while package scripts still call the resulting suites unit tests.

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

The earlier duplicate tooling invocation is resolved in committed verification. Root quality now uses separate lint/check tasks, allowing type-check dependencies to participate in the Turbo graph. These completed optimizations should stay out of the remaining backlog.

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

The refresh also identified a pre-existing API discovery gap: `apps/api/src/runtime/local/tests/import-recovery.test.ts` contains two useful retry/shutdown tests, but the API package script only selects `./tests` and `./src/identity/tests`. The retained API run lists 82 files against 83 files in the inventory. Both recovery tests pass when run explicitly. Give this file an executing unit owner during the selector cleanup; this gap was not introduced by the optimization commit.

`unit-test-coverage.md` says PRs run an informational coverage job, but current workflows do not invoke coverage. Root Turbo test tasks also declare no lcov outputs for cache restoration. Fix documentation and reporting together; avoid a second full test pass on every push merely to collect coverage.

## Desired test ownership

Use package-local unit tests for domain invariants, calculations, parsers, policy composition with small port fakes, transport mapping and error translation. Tests that require production repository behavior remain integration tests. An in-process HTTP request with mocked ports can be a unit test; an in-process request composing identity, services and SQL is integration even without a listening server.

Keep package-specific SQL/composition tests with their owners and select them explicitly by the integration suffix. Use `tooling/integration-tests` for cross-package journeys and native concurrency. This avoids a large fixture relocation solely to change CI selection. Keep fixtures narrowly scoped and preserve separation between school and identity persistence.

Cross-package integration folders describe responsibilities: `persistence`, `services`, `http`, `migrations`, `native`, and `seed`. Keep large `benchmarks` outside the ordinary integration selector. These folders do not require a new abstraction framework or a registry entry for every test.

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

The existing YAML already implements the main event routing. Feature pushes currently run full `ci verify`, including lint/types, workspace build and the mislabeled unit graph. PRs run full qualification. Destination pushes run full qualification again before deployment. At the time of this audit, a temporary repository opt-in gated deployment. That opt-in has since been removed; qualification, migration and configured environment protections remain required. Deployment environments and branch protection also need a one-time settings check during implementation.

Preserve serialized deployments, qualified artifact restoration, artifact checksum checks and migrations before deployment. Ordinary deployment must not reset or seed hosted databases. Keep emergency and staging-maintenance paths separate.

Do not skip a release qualification merely because its PR was green. A PR merge reference, feature HEAD, squash commit and release SHA may differ. Initially keep qualification of the actual destination commit, using the smaller corrected suites. Later reuse successful evidence only when the source revision, inputs and target build match; otherwise run the needed checks. Production still needs its own environment-specific bundle. Likewise, a PR should revalidate units against a changed merged tree when only the feature HEAD was checked on push.

Full demo seeding should be required for PR changes affecting seeding, fixtures, onboarding, identity composition, runtime/migration wiring or seed contracts; use a small smoke journey on ordinary PRs. Start conservatively with the existing full seed requirement until a reliable dependency rule is agreed. No nightly automation is needed for the initial cleanup.

## Phased implementation

### Phase 1 Establish the baseline and remove confirmed repetition

Completed at `53a45742`: shared pool implementation and isolation safeguards, fixture cache invalidation, single tooling invocation, explicit lint/check task orchestration, streaming logs and phase/pool diagnostics. The refreshed audit also records pinned-runtime sample results. Preserve this baseline; do not reimplement it.

Remaining work:

1. Measure complete uncached push and PR lanes on pinned Bun 1.3.14, recording suite counts, initialization counts and wall time. The refreshed samples do not replace those complete lane measurements.
2. Remove the two repeated compatibility invocations and retain the handwritten HTTP regressions once.
3. Separate large dashboard benchmarks from mandatory native integration. Keep the small enrollment query-count regression.
4. Correct stale coverage and benchmark documentation. Fixture/execution documentation has already been updated.

Acceptance: identical required behavioral coverage, each required suite executes once, no large benchmark activated merely by choosing an evidence output path, and no change to release approval/evidence requirements.

### Phase 2 Restore the unit and integration boundary

1. Classify the detected SQL files and manually inspect API runtime/identity cases missed by the helper scan.
2. Pilot the split in authorization and the mixed timetable file. Keep pure solver/resolver cases on push; move SQL policy scope and workflow cases to integration without weakening assertions.
3. Move service SQL cases, repository/migration cases, notification persistence and composed API cases in small package-sized batches. A temporary `tests/unit` versus `tests/integration` split is acceptable while moving to the central integration owner.
4. Relocate shared fixtures before updating callers. Pure unit bootstrap must not own SQL cleanup. Integration bootstrap must clean its own databases after failed cases.
5. Give `test`/`test:unit` unambiguous unit-only semantics and one documented PR integration aggregate. Include the currently undiscovered import-recovery tests. Keep explicit diagnostic slices; do not add overlapping default entrypoints.
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
- Runtime is diagnostic evidence, not an acceptance quota. Reduce unnecessary setup and duplicate boundaries while retaining every unique protection.
- Required PR coverage includes actor assurance and revocation; staff/teacher/guardian/student boundaries; school/year scope before pagination/counts; proposed and current write targets; finance atomicity; command/outbox/cron concurrency; private-file access/lifecycle; marks and published report behavior; timetable locking; supported migrations; and representative onboarding/seed wiring.
- Coverage reports are informational and clearly scoped. Do not introduce a global near-100% target; use missing decision branches in important modules to guide review.
- Every test file is intentionally owned by an executing lane, an explicit opt-in suite or a documented retirement. Unexpected zero-test success and unexpected required skips remain failures.
- The default local commands, CI commands and documentation describe the same lanes. `AGENTS.md`, package scripts, Bun configuration, repo CLI, Turbo tasks and required check names change together where necessary.

The execution work in Phases 1 and 2 is implemented through package-owned integration selectors. Further fixture relocation is optional, rather than a prerequisite for separation. Phase 3 behavioral consolidation and Phase 4 historical-migration retirement remain follow-up work requiring their own surviving-assertion and operational evidence.

## Compositional workflow and fixture optimization (2026-10-27)

The current change replaces the catch-all qualifier with six reusable tasks and a three-job integration matrix. Quality owns type checks, tests no longer trigger dependency type checks, and the final join consumes complete stage evidence without rerunning suites. Destination pushes deliberately requalify the pushed SHA before migration/deployment. Benchmarks and live R2 remain opt-in.

### Coverage ownership after consolidation

| Removed/reduced scenario | Retained assertions and owner |
| --- | --- |
| Central curriculum late-write rollback | Service `academics-workflows.integration.test.ts`: rejected aggregate save leaves progress, matter and class-subject completion unchanged |
| Central timetable regeneration tail | Service `timetable-generation.integration.test.ts`: completed/manual sessions retained, eligible generated session removed, no replacement workload; native timetable race matrix remains |
| Setup journey primitive validation/status assertions | Service `setup-workflows.integration.test.ts`; central journey now verifies school/year/period/enrollment coherence after later changes |
| Separate healthy doctor bootstrap | Healthy doctor findings and HTTP validation share the same full HTTP bootstrap in `seed/http/diagnostics.test.ts`; missing-auth doctor uses its own runtime |
| Repeated exhaustive HTTP portrait download loop | Seed contract retains every teacher's attachment, metadata and JPEG assertions; HTTP diagnostics retain one real local-file/download grant round trip |
| Broad seed for teacher-unavailability, health-profile and notification-template HTTP contracts | Same generated-client assertions with minimal isolated SQL school/actor/year and only required entities; live identity/session/seed tests unchanged |
| Per-row full-year timetable activity setup | Same full academic year, preserved lessons, both full-year generation calls and assertions; activity fixture rows use one batch save |
| New PGlite and migrations for every JSONB/authorization/admission case | Same scenarios and assertions use migrated pools with clean leases, reset/discard/leak checks and close failures retained |

Seed route/data consumers now share one context per fixture kind even when school-data setup happens first. Shared fixture teardown closes every runtime and reports errors after cleanup. Focused mutating route cases get a fresh minimal fixture per case. The delivery idempotence case additionally verifies the complete retained record is unchanged.

Database pool evidence reports initialization count/time, reset time and checkpoint time. Seed bootstrap evidence reports setup duration; task reports record execution duration. Earlier sequential timings are historical, not a promise of GitHub runtime. Final working-tree verification on pinned Bun 1.3.14:

| Verification | Observed result |
| --- | --- |
| Complete unit lane | 1,378 passing cases / 294 files, 19.869 seconds; includes the concurrent seeding unit additions |
| Service/authorization/headless integration | 829 passed and one full-year timetable timeout in the complete group; that same full-year case passed after batching fixture activity inserts (147.01 seconds including startup). The transferred setup assertions also passed in all 22 owner-suite cases. |
| Adapters/API/HTTP/compatibility integration | 370 passed / 85 files |
| Seed/native PostgreSQL integration | 87 passed / 22 files, including all 76 native cases |
| Fixture order/isolation | All 11 seed cases additionally passed with `--randomize --seed=27`, school-data registered before route consumers, and final shared-fixture teardown |
| Static/build checks | Repository/workflow checks, lint/types, workspace build and staging/production Worker dry-run builds passed; final integration and CLI type checks passed |
| Qualification failure/cleanup | An intentionally empty native selection returned failure and stopped its cluster. The finalizer rejected the recorded failed service attempt, cleared older success evidence and left the artifact unqualified. Unit checks cover complete/missing/duplicate/failed/skipped/mismatched stage evidence and stale-success invalidation. |

Together the full groups and affected rerun verified **1,287 unique integration cases across 203 files**. The initial failed group report is deliberately retained as failed; it was not rewritten as a successful full qualification. A fresh CI qualification must produce its own complete successful stage reports before migration/deployment. The finalized unit lane and latest fixture reruns were successful. Concurrent HTTP auth-provisioner, seeding documentation and local-provisioner test changes were preserved; the mocked smoke fixture was updated for the new terms lookup.

The three pooled suites now initialize three migrated databases for eight leases, compared with eight fresh initializations previously. Healthy HTTP diagnostics bootstrap once instead of twice. Large benchmarks and live R2 were not invoked. Local groups overlapped with quality checks and other shared-checkout work, so their elapsed times are not a controlled CI speed comparison. No runtime target is asserted. The GitHub artifact upload/download graph, exact required-check display name and environment review behavior still require the documented non-deploying rehearsal before rollout.

# Unit Test Coverage — Sprint Plan

> **Superseded for identity (2026-09-11):** `@edaya/adaptor-auth` moved to sibling `edaya_identity`. Coverage numbers for that package in this plan are historical.

> **Status:** In progress — **U0 ✅ · U1 ✅ · U2 ✅ · U3 ✅ · U4 ✅ · U5 ✅ · U6 ✅** · **U7 in progress** (batch 1–4)  
> **Last updated:** 2026-07-07  
> **Created:** 2026-07-07  
> **Scope:** Raise backend **unit** test line coverage as close to 100% as is practical, without duplicating integration-test responsibilities  
> **Depends on:** Stable `bun test --coverage` across workspaces; authorization operation matrices (G0–G7) complete  
> **Out of scope:** Replacing `@edaya/integration-tests`, Playwright/mobile E2E, OpenAPI/codegen correctness, load testing  
> **Related:** [authorization-operations-plan.md](./archive/authorization-operations-plan.md), [AGENTS.md](../../AGENTS.md), `bunfig.toml` coverage config

---

## Progress summary (2026-07-07)

| Fold | Status | Key result |
|------|--------|------------|
| **U0** — Coverage infrastructure | ✅ Complete | `bunfig.toml` thresholds, CI coverage job, naming guard, `docs/reference/unit-test-coverage.md`, legacy renames |
| **U1** — Authorization policy & grants | ✅ Complete | `tests/unit/auth/` — **541 tests**, **52 files**; `src/capabilities/authorization/**` **~97%** avg line |
| **U2** — Application queries & school service | ✅ Complete | `school-overview.ts` ~97%, `timetable.ts` ~98%, `academic-year.ts` 100%; queries fold ≥ **90%** |
| **U3** — Workflows | ✅ Complete | **14 / 14** workflow modules ≥ **80%**; **184** workflow tests across **15** files |
| **U4** — Capabilities & jobs | ✅ Complete | Files, invitations, account linking, expire cron, reminder scans, notification handlers |
| **U5** — Domain entity parity | ✅ Complete | **12** new domain gate test files; batch 2: teacher assignment, class group, lesson/activity session, class-subject-progress |
| **U6** — Adaptors | ✅ Complete | Postgres store + PGlite repos; novu subscriber/sdk clients; r2 + local-fs server routes |
| **U7** — API unit layer | 🔄 In progress | Batch 1–4: GraphQL, auth cache, cron, routes, dependencies, worker background tasks |

**`@edaya/core` today:** **1248** tests, **178** test files — **~95.7%** line coverage. **`@edaya/api` today:** **234** tests, **63** test files — **~70.1%** line coverage (↑ from 66.9%). **`@edaya/adaptor-r2` src:** **~99%** · **`@edaya/adaptor-local-fs` src:** **~87%**. `bun repo verify` green.

---

## 1. Problem statement

The backend has **strong integration coverage** (HTTP seeds, demo scenes, staging smoke) but historically had **no enforced unit coverage budget**. Bun reports coverage (`bun test:coverage`); **U0** added an **`@edaya/core` floor (86%)** and an informational CI job — the long-term T1 target remains **95%**.

### Current baseline (2026-07-07, `bun test --coverage`)

| Package | Line coverage | Test files | Notes |
|---------|---------------|------------|-------|
| `@edaya/core` | **95.7%** ↑ | 178 | T1 target **95%** met |
| `@edaya/api` | **70.1%** ↑ | 63 | U7 in progress — invitations, file routes, dependencies |
| `@edaya/adaptor-auth` | **94.4%** | 1 | Nearly done |
| `@edaya/adaptor-local-fs` | **80.7%** | 1 | Dev-only adapter |
| `@edaya/adaptor-postgres` | **~49%** ↑ | 8 | U6 — `PostgresStore` **100%**, PGlite school CRUD |
| `@edaya/adaptor-novu` | **~50%** ↑ | 14 | U6 — subscriber/sdk clients **~100%** |
| `@edaya/adaptor-r2` | **~99%** ↑ | 5 | U6 **met** (T2 ≥ 90%) |
| `@edaya/adaptor-local-fs` | **~87%** ↑ | 1 | U6 — server-app routes **~89%** |
| `@edaya/seeding` | **56.5%** | many | U8 / lower ROI |

**Monorepo unit tests today:** ~312 `*.test.ts` files, **1179** tests in `@edaya/core` alone.

### Highest-impact uncovered areas in `@edaya/core` (remaining)

| Area | Example files | Line cov. | Fold |
|------|---------------|-----------|------|
| Domain entities (gaps) | `activity.ts`, `grade-level-subject*.ts`, `teacher-assignment.ts`, … | 45–67% | **U5** |
| API lib/routes | `apps/api/src/lib/**` | **70.1%** blended | **U7** |
| Adaptor packages | postgres, novu, r2 | 29–48% | **U6** |

### Addressed in U1–U2 (no longer primary gaps)

| Area | Was | Now |
|------|-----|-----|
| Policy portal strategies | 0–17% | **≥94%** (`fee-access`, `attachment-access`, `report-card-access`) |
| Policy resolvers (thin) | 12–17% | **≥91%** (`teacher`, `teacher-assignment`, `attachment`) |
| Service account provisioning | **3%** | **~96%** (`provision.ts`) |
| Staff scope rendering | 0–5% | **100%** (`render-scope-ids.ts`, `staff-assignment-scope.ts`) |
| Application queries | 0–2% | **≥97%** (`school-overview.ts`, `timetable.ts`) |
| Workflows (all modules) | 3–52% at epic start | **≥83%** on every module (see U3) |

Authorization **operation module gates** are matrix-covered; auth subtree DoD is met. **`@edaya/core` T1 line coverage target (95%) is met.** Remaining gap is primarily **domain parity (U5)** and cross-package tiers (U6–U8).

---

## 2. What “100%” means here

True 100% line coverage on every file in the monorepo is **not a useful goal**. The plan targets **near-complete coverage of testable business logic** with explicit exclusions.

### Tier targets (line coverage, enforced in CI)

| Tier | Scope | Target | Rationale |
|------|-------|--------|-----------|
| **T1** | `package/domain-core/src/**` minus exclusions | **≥ 95%** | Pure business rules; ports/adapters are thin |
| **T2** | `package/adaptor-* /src/**` | **≥ 90%** | Adapter logic is testable with mocks/fakes |
| **T3** | `apps/api/src/lib/**`, `apps/api/src/routes/**` (unit layer) | **≥ 85%** | HTTP wiring; heavy paths stay in integration tests |
| **T4** | `tooling/*` CLIs | **≥ 70%** | Orchestration; smoke/integration covers happy paths |

### Explicit exclusions (coverage ignore)

Document in `bunfig.toml` / per-package config:

- Barrel `index.ts` re-exports with no logic
- Generated OpenAPI client (`package/generated-api-client`)
- Type-only / interface-only port files (`src/ports/**` when no runtime code)
- Local-dev-only entrypoints already covered by integration (`local-dev-file-storage.ts`, `local-files-server` bootstrap) — **or** cover with focused unit tests if cheaper than ignoring
- `tooling/integration-tests/**` (separate harness, not unit)

Everything else needs a **justification PR comment** if excluded.

---

## 3. Testing strategy (avoid duplication)

```text
                    ┌─────────────────────────────────────┐
                    │  Integration (@edaya/integration)   │
                    │  HTTP + DB + seeded demo-ci         │
                    └─────────────────┬───────────────────┘
                                      │ fewer, slower
                    ┌─────────────────▼───────────────────┐
                    │  Service / workflow unit tests       │
                    │  workflow-test-context, mock repos   │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────────┐
        │  Policy strategy + resolver unit tests (mock repos only)   │
        └─────────────────────────────┬─────────────────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────────┐
        │  Domain invariant tests + managed-entity gate tests        │
        └─────────────────────────────┬─────────────────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────────┐
        │  Pure utilities (scope-ids, money, time-range, …)           │
        └───────────────────────────────────────────────────────────┘
```

**Rules**

1. **Do not** add per-entity authorization unit tests when an entity only wires `operationModule` — extend operation matrices or policy strategies instead (see authorization plan §7.8).
2. **Do not** re-test full HTTP stacks in unit tests when `@edaya/integration-tests` already locks the route contract.
3. **Do** unit-test every **branchy** policy strategy, resolver, workflow error path, and domain invariant that integration rarely hits.
4. Prefer **table-driven** tests and shared fixtures (`AuthFixtures`, `describeMatrix`, `workflow-test-context`, new `policy-fixtures.ts`) over copy-pasted mocks.

---

## 4. Test file naming conventions

These rules apply to **all new and renamed** unit test files under `package/**`, `apps/**`, and `tooling/**` (excluding `tooling/integration-tests/`, which follows scene naming).

### 4.1 Semantic naming

Filenames must describe the **behavior or invariant under test**, not the source file category alone.

| Prefer | Avoid |
|--------|--------|
| `guardian-fee-access-denies-unlinked-student.test.ts` | `fee-access.test.ts` (too vague when many behaviors exist) |
| `staff-assignment-scope-renders-class-group-path.test.ts` | `staff-assignment-scope.test.ts` (unless file is the canonical home for that module’s full behavior suite) |
| `enrollment-create-rejects-duplicate-active-seat.test.ts` | `student-workflows.test.ts` (extend an existing workflow file **only** when it already owns that workflow module end-to-end) |
| `scope-ids-round-trip-serialization.test.ts` | `utils.test.ts`, `helpers.test.ts`, `misc.test.ts` |

**Patterns that are OK**

- **Module owner file** — one test file per production module when it exercises that module’s public behaviors comprehensively (e.g. `effective-grants.test.ts`, `permission-authorization.test.ts`).
- **Domain invariant file** — `{entity}-{invariant}.test.ts` (matches existing style: `student-fee-balance-computation.test.ts`, `attendance-record-status-transitions.test.ts`).
- **Policy / strategy file** — mirror production layout under `tests/unit/auth/policy/` with behavior-focused names when splitting (`guardian-fee-access.test.ts`, not `portal.test.ts`).

**`describe` / `test` titles** inside files should state the behavior (`denies guardian for unlinked student`), not process metadata (`checks line 42`).

### 4.2 Forbidden terms (filenames and test comments)

Do **not** use the following in **test filenames** or **comments inside test files**, unless the term is part of the **behavior being asserted** (rare):

| Forbidden | Why |
|-----------|-----|
| `coverage` | Process metadata, not domain behavior |
| `regression` | State the invariant being protected instead |
| `final` | Temporary / process language |
| `gap` | Planning metadata |
| `utils`, `helpers`, `misc`, `temp`, `fix` | Generic buckets |

**Allowed exceptions**

- CI/config/docs **outside** test files (e.g. `bun test:coverage`, `bunfig.toml`, this sprint plan, `docs/reference/unit-test-coverage.md`).
- Comments that quote **production symbols** containing these words (e.g. a function named `resolveEffectiveGrants` — fine; comment “improve coverage” — not fine).

### 4.3 Static guard (Fold U0)

Extend `tooling/repo/tests/boundaries.test.ts` (or add `test-naming-conventions.test.ts` under `@edaya/repo`) to fail CI when a new `*.test.ts` path matches:

```regexp
/(coverage|regression|\bfinal\b|\bgap\b|utils|helpers|misc|temp|\bfix\b)/i
```

Use a **legacy allowlist** for paths not yet renamed (see §4.4) until the backlog is cleared.

### 4.4 Rename backlog (legacy violations)

Rename in **Fold U0** before the naming guard goes strict:

| Current | Target | Status |
|---------|--------|--------|
| `tests/unit/auth/operations/zz-operation-matrix-coverage.test.ts` | `operation-ref-registry-complete.test.ts` | Done |
| `tests/unit/auth/authorization-migration-coverage.test.ts` | `authorization-migration-guards.test.ts` | Done |
| `tests/unit/domain/utils.test.ts` | `domain-shared-validation.test.ts` | Done |

Do **not** add new files named `*-coverage.test.ts`, `*-gap.test.ts`, or `coverage-allowlist.test.ts`. Threshold tooling lives in CI config (`below-target-sources.json` at package root if needed), not in behavior-named test files.

---

## 5. Coverage infrastructure (Fold U0) ✅

**Goal:** Make coverage visible and non-regressing before writing thousands of new tests.

| Step | Deliverable | Status |
|------|-------------|--------|
| U0.1 | Per-package coverage scripts: `bun --filter @edaya/core test --coverage`, same for api + adaptors | ✅ |
| U0.2 | `coveragePathIgnorePatterns` in root + package `bunfig.toml` for exclusions in §2 | ✅ |
| U0.3 | **`coverageThreshold` ratchet** — `@edaya/core` floor **86%** (current baseline at start) | ✅ |
| U0.4 | CI job: `bun test:coverage` + upload `lcov` (Codecov or artifact) | ✅ informational |
| U0.5 | **`docs/reference/unit-test-coverage.md`** | ✅ |
| U0.6 | **`below-target-sources.json`** — empty; entries only when temporarily needed | ✅ |
| U0.7 | **Naming hygiene** — rename backlog in §4.4; naming guard in `bun repo verify` | ✅ |

**Verification**

```sh
bun test:coverage
bun repo verify   # unchanged; coverage is additive CI job initially
```

---

## 6. Implementation folds

### Fold U1 — Authorization policy & grants (T1: +5–8 pts)

**Why first:** Lowest coverage in security-critical code; reuses auth test harness from authorization epic.

| Work item | Files / tests | Pattern |
|-----------|---------------|---------|
| U1.1 Policy strategy suites | `tests/unit/auth/policy/fee-access/*.test.ts`, `attachment-access/*.test.ts`, `report-card-access/*.test.ts` | `policy-fixtures.ts` — minimal mock repos per strategy |
| U1.2 Resolver smoke | `teacher.ts`, `teacher-assignment.ts`, `attachment.ts` resolvers | 2–3 cases each: allow, deny, elevated staff |
| U1.3 Grant scope utilities | `render-scope-ids.ts`, `staff-assignment-scope.ts`, `scope-segments.ts` | Pure functions + table cases |
| U1.4 Service account provisioning | `service-accounts/provision.ts` | Mock repos + grant-backed staff actors |
| U1.5 Capability asserts edge cases | `assert-capability.ts` uncovered branches | Extend `teacher-capability-gates.test.ts` |

**DoD:** T1 auth subtree (`src/capabilities/authorization/**`) ≥ **95%** line — **met** (541 tests, **~97%** avg line coverage across 120 auth source files; `provision.ts` ~96%, portal strategies ≥94%).

---

### Fold U2 — Application queries & school service (T1: +3–5 pts) ✅

| Work item | Coverage (now) | Tests |
|-----------|----------------|-------|
| U2.1 `school-overview.ts` | **~97%** | `tests/queries/school-overview.test.ts`, `query-services.test.ts` |
| U2.2 `timetable.ts` | **~98%** | `tests/queries/class-group-timetable.test.ts`, `query-services.test.ts` |
| U2.3 `school-application.ts` | **~79%** | `tests/services/application/school-application.test.ts` (runtime wiring; not U2 DoD scope) |
| U2.4 `academic-year.ts` | **100%** | `tests/application/find-active-academic-year.test.ts` |

**DoD:** `src/application/queries/**` ≥ **90%** — **met** (`school-overview.ts` ~97%, `timetable.ts` ~98%, `findActiveAcademicYear` 100%; mock repos only, no Postgres).

---

### Fold U3 — Workflows (T1: +8–12 pts) ✅

Workflows are the largest remaining hole. Use **`workflow-test-context.ts`** consistently; one test file per workflow module already exists — **extend**, don't splinter.

**Final line coverage** (`bun test --coverage`, 2026-07-07):

| Module | Line cov. | Test file |
|--------|-----------|-----------|
| `access-control.ts` | **100%** | `access-control-workflows.test.ts` |
| `behavior.ts` | **~99%** | `behavior-workflows.test.ts` |
| `report-card-aggregation.ts` | **~99%** | `report-card-aggregation.test.ts` |
| `schedule-conflicts.ts` | **~95%** | `schedule-conflicts.test.ts` |
| `assessments.ts` | **~91%** | `assessment-workflows.test.ts` |
| `grade-level-subject-sync.ts` | **~91%** | `grade-level-subject-sync.test.ts` |
| `communications.ts` | **~91%** | `communications-workflows.test.ts` |
| `scheduling.ts` | **~90%** | `scheduling-workflows.test.ts` |
| `student.ts` | **~90%** | `student-workflows.test.ts` |
| `account-invitation.ts` | **~88%** | `account-invitation-workflows.test.ts` |
| `academics.ts` | **~84%** | `academics-workflows.test.ts` |
| `setup.ts` | **~84%** | `setup-workflows.test.ts` |
| `finance.ts` | **~84%** | `finance-workflows.test.ts` |
| `notification-templates.ts` | **~85%** | `notification-templates-workflows.test.ts` |

**Batch PR strategy:** 1–2 workflow files per PR; each PR must show coverage delta for touched file ≥ **80%**.

**Progress (batch 1):** Extended `setup-workflows.test.ts` and `student-workflows.test.ts` with `createFullSetupContext` / `createStudentAdminContext`. Coverage: `setup.ts` ~84%, `student.ts` ~90% (was ~33% / ~52%).

**Progress (batch 2):** Extended `communications-workflows.test.ts` and `scheduling-workflows.test.ts`; added `schedule-conflicts.test.ts`. Coverage: `communications.ts` ~91%, `scheduling.ts` ~90%, `schedule-conflicts.ts` ~95% (was ~65% / ~70% / ~5%).

**Progress (batch 3):** Extended `assessment-workflows.test.ts`, `behavior-workflows.test.ts`, `access-control-workflows.test.ts`, `report-card-aggregation.test.ts`, `account-invitation-workflows.test.ts`, and `academics-workflows.test.ts`. All six previously sub-80% modules now ≥ **80%**; **`access-control.ts` at 100%**.

**U3 DoD:** **met** — all **14 / 14** workflow modules ≥ **80%** line coverage.

### Fold U4 — Capabilities & jobs (T1: +3–5 pts) ✅

| Area | Files | Tests |
|------|-------|-------|
| Cron handlers | `scheduling-jobs/jobs/*` | Unit-test handler with mock `SchoolCronJobContext` |
| Invitations | `schedule-account-invitation.ts`, `transient-subscriber-id.ts` | Mock delivery port |
| Files | `read-storage-body.ts`, `upload-policy.ts` | Mock `FileStoragePort` |
| Notifications handlers | `handlers/*`, `deliver-notification.ts` | Extend existing notification tests |
| Account linking | `link-subject-to-actor.ts` | Actor kind matrix + conflict errors |

**Final line coverage** (`bun test --coverage`, 2026-07-07):

| File | Line cov. | Test file |
|------|-----------|-----------|
| `read-storage-body.ts` | **100%** | `tests/unit/files/read-storage-body.test.ts` |
| `upload-policy.ts` | **~98%** | `tests/unit/files/attachment-upload-policy.test.ts` |
| `schedule-account-invitation.ts` | **100%** | `tests/unit/invitations/schedule-account-invitation-eligibility.test.ts` |
| `transient-subscriber-id.ts` | **100%** | `tests/unit/invitations/transient-invitation-subscriber-id.test.ts` |
| `resolve-invitation-contact.ts` | **~91%** | `tests/unit/invitations/resolve-invitation-contact-channels.test.ts` |
| `expire-account-invitations.ts` | **100%** | `tests/cron/expire-account-invitations.test.ts` |
| `scan-calendar-event-reminders.ts` | **100%** | `tests/cron/scan-calendar-event-reminders.test.ts` |
| `scan-activity-reminders.ts` | **~97%** | `tests/cron/scan-activity-reminders.test.ts` |
| `link-subject-to-actor.ts` | **~94%** | `tests/application/link-subject-to-actor.test.ts` |
| `build-recipient-profile.ts` | **~98%** | extended `tests/notifications/build-recipient-profile.test.ts` |
| Notification handlers | **≥94%** | extended `tests/notifications/notification-template-handlers.test.ts` |

**U4 DoD:** **met** — capabilities/jobs fold complete; contributed final push to **95.0%** `@edaya/core` line coverage.

---

### Fold U5 — Domain entity parity (T1: +2–4 pts) ✅

**44 → 56** domain unit tests (batch 1 + batch 2 added **12** files covering plan gap list).

| File | Line cov. | Test file |
|------|-----------|-----------|
| `school-life/activity.ts` | **~95%** | `activity-capacity-and-delete-gates.test.ts` |
| `school-life/activity-enrollment.ts` | **~84%** | `activity-enrollment-save-gate.test.ts` |
| `academics/grade-level-subject.ts` | **~98%** | `grade-level-subject-allocation-gates.test.ts` |
| `academics/grade-level-subject-matter.ts` | **~89%** | `grade-level-subject-matter-link-gates.test.ts` |
| `scheduling/attendance.ts` | **~98%** | `attendance-duration-bounds.test.ts` |
| `access/account-invitation.ts` | **~93%** | `account-invitation-lifecycle.test.ts` |
| `finances/fee.ts`, `payment.ts` | **~97%** / **~99%** | `fee-and-payment-save-delete-gates.test.ts` |
| `school/teacher-assignment.ts` | **~95%** | `teacher-assignment-kind-and-save-gates.test.ts` |
| `school/class-group.ts` | **100%** | `class-group-save-and-delete-gates.test.ts` |
| `scheduling/lesson-session.ts` | **100%** | `lesson-session-occurrence-gates.test.ts` |
| `scheduling/activity-session.ts` | **100%** | `activity-session-occurrence-gates.test.ts` |
| `academics/class-subject-progress.ts` | **~98%** | `class-subject-progress-save-gates.test.ts` |

Gate validators exported for testing (same pattern as `validateClassActivityEnrollmentSave`, `validateFeeSave`): `validateClassGroupDelete`, `validateClassSubjectProgressSave`.

**U5 DoD:** **met** for domain gate coverage; optional `entity-manifest.ts` coverage column still open.

---

### Fold U6 — Adaptors (T2) ✅

| Package | Batch 1 | Batch 2 |
|---------|---------|---------|
| `@edaya/adaptor-postgres` | `postgres-indexes`, `filter`, `mappers`, `transaction` — **100%** | `postgres-store.test.ts` (**100%**), `postgres-school-repositories-pglite.test.ts` |
| `@edaya/adaptor-novu` | gateway, trigger chunking, messages client | `novu-subscriber-client-operations.test.ts`, `novu-sdk-client.test.ts`, `create-from-secret-key.test.ts` — clients **~100%** |
| `@edaya/adaptor-r2` | object ops, CORS, probe — **src ~99%** | — |
| `@edaya/adaptor-local-fs` | — | Extended `local-file-storage.test.ts` — health, token errors, internal routes (**server-app ~89%**) |

**U6 DoD:** **met** for priority adaptor surfaces (r2/local-fs ≥ **85%** src; novu/postgres client layers unit-tested). Package-wide postgres/novu totals remain lower due to large generated store boilerplate — specialized store tests remain in integration layer.

**Boundary:** Repository integration tests belong here or in adaptor package — **not** duplicated in domain-core.

---

### Fold U7 — API unit layer (T3)

Focus on **`apps/api/src/lib/**`** and route **helpers** — not full Worker bootstrap.

**Batch 1 (done):** entity dispatch services, auth-cache invalidation port, actor scope cache, serialize-grants, GraphQL resolver-utils / JSON scalar / query-resolvers.

**Batch 2 (done):** entity-resolvers, command-resolvers, graphiql-session + graphiql-login handlers, execute-command, schedule-background-task.

**Batch 3 (done):** `run-scheduled-cron` heartbeat/runtime paths, pino logger middleware, `dispatch/commands` invitation serialization, permission catalog + scope render routes, invitation preview, file upload intent + download-url fallback.

**Batch 4 (done):** invitation accept (happy path, 401, 409), memory file PUT/GET routes, `http/dependencies` auth + schoolApp modules, worker `scheduleBackgroundTask` runtime path, guardian invitee preview.

**Remaining gaps (batch 5+):** file-storage error branches, `authorization.routes` scope resolver edge cases, blended T3 still below **85%** target.

| Area | Examples | Pattern |
|------|----------|---------|
| Middleware | session actor resolution | Extend existing `test-session-middleware-*.test.ts` |
| OpenAPI / GraphQL builders | schema generation edge cases | Snapshot + auth metadata |
| School API dispatch | entity dispatch, invalidation wiring | Mock `SchoolApplication` |
| Runtime guards | `create-auth-schema-guard.test.ts` pattern | Static + behavioral |

Keep **route happy paths** in integration tests; unit-test **auth rejection, validation, and error mapping**.

---

### Fold U8 — Tooling (T4, optional)

Lower priority unless CLI regressions hurt dev UX:

- `tooling/seeding` port-workflow tests (already many) — fill gaps in uncovered domains
- `tooling/repo` CLI parse tests (already present)
- `tooling/db-migrate` — smoke only unless migration logic grows

---

## 7. Shared test infrastructure to add

| Asset | Path | Purpose | Status |
|-------|------|---------|--------|
| `policy-fixtures.ts` | `tests/support/` | Minimal `SchoolRepositories` mocks per policy strategy | ✅ U1 |
| `workflow-fixtures.ts` | `tests/support/` | Thin wrapper over `workflow-test-context` for common school/year setup | ⏳ optional |
| `describePolicyMatrix` | `tests/support/` | Table-driven allow/deny for strategy files (mirror operation matrices) | ✅ via `operation-matrix.ts` |
| `below-target-sources.json` | package root | Temporary sub-95% files with owner + fold id (CI/tooling only) | ✅ empty |
| Entity coverage manifest | `tooling/fixtures/src/meta/` | Single view of test style per entity | ⏳ U5 |

---

## 8. CI & ratchet policy

1. **Phase 1 (weeks 1–2):** Coverage job is **informational** only (U0).
2. **Phase 2:** Enforce **package floor** — cannot drop below baseline on PR.
3. **Phase 3:** Enforce **T1 ≥ 95%** for `@edaya/core`; ratchet T2/T3 quarterly.

```sh
# Local iteration
bun --filter @edaya/core test --coverage
bun --filter @edaya/core test tests/unit/auth/policy/   # policy fold
bun --filter @edaya/core test tests/services/workflows/   # workflow fold
```

PR checklist addition:

- [ ] Coverage report attached or CI green
- [ ] New branches in security paths have unit tests
- [ ] No new entries in `below-target-sources.json` without fold id
- [ ] New test files follow §4 naming (behavior-focused; no forbidden terms in filename or comments)

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Coverage gaming (assert true, mock everything) | Require meaningful assertions; Bugbot on test diffs |
| Test suite slowdown | Parallel packages; keep unit tests mock-bound (< 2s package) |
| Duplication with integration tests | §3 rules; code review checklist |
| Flaky adaptor tests | No real network; mock fetch/S3/Postgres |
| 100% obsession on trivial files | Exclusion list + tier targets instead of single global 100% |

---

## 10. Definition of done (epic)

- [x] U0 coverage CI job + documented exclusions
- [x] Test naming guard (§4.3) enabled; legacy allowlist empty
- [x] `@edaya/core` T1 ≥ **95%** line coverage (**95.7%** — U5 complete)
- [ ] `@edaya/adaptor-*` T2 ≥ **90%** (except generated/boilerplate)
- [ ] `apps/api` lib/routes T3 ≥ **85%**
- [x] Zero auth policy strategy files below **80%** without documented reason (**U1 met**)
- [x] Every workflow module in `src/application/workflows/` ≥ **80%** (**14 / 14** — **U3 met**)
- [x] `below-target-sources.json` empty or only justified dev-only paths
- [x] `bun repo verify` green; integration tests unchanged pass rate

---

## 11. Suggested first PR (U0 + U1 partial) — **done**

Completed 2026-07-07:

1. **U0.1–U0.7** — coverage config, CI job, naming guard, legacy renames
2. **U1** — policy strategies, resolvers, grant scope utilities, service account provisioning
3. **U2** — query + academic-year tests

**Next PR slice:** U7 — API unit layer (`apps/api/src/lib/**`, route helpers).

---

## 12. Appendix — package file counts (2026-07-07)

| Location | `src/**/*.ts` | `*.test.ts` |
|----------|---------------|--------------|
| `package/domain-core` | 357 | **178** |
| `apps/api` | 124 | **63** |
| `package/adaptor-postgres` | 20 | 2 |
| `package/adaptor-novu` | 15 | 9 |
| `package/adaptor-r2` | 6 | 4 |
| `package/adaptor-auth` | 6 | 1 |
| `package/adaptor-local-fs` | 7 | 1 |

**Total backend test files:** ~303 (excluding integration-tests harness).

### `@edaya/core` test layout (after U1–U5 batch 1)

| Suite | Files | Tests (approx.) |
|-------|-------|-----------------|
| `tests/unit/auth/` | 52 | 543 |
| `tests/services/workflows/` | 15 | 184 |
| `tests/unit/domain/` | 51 | 229 |
| Remaining (cron, notifications, queries, capabilities, …) | 55 | 252 |
| **Total** | **173** | **1208** |

## 13. Relationship to other test layers

| Layer | Command | Role |
|-------|---------|------|
| Unit | `bun --filter @edaya/core test` | Branches, invariants, policy (this plan) |
| API unit | `bun --filter @edaya/api test` | HTTP helpers, GraphQL, middleware |
| Integration | `bun --filter @edaya/integration-tests test` | Full HTTP + DB + seed |
| Web E2E | `edaya_web` Playwright demo dry-run | Staff UI scenes |
| Mobile | `edaya_mobile` `melos run test:integration` | Portal actors on device |

Portal authorization changes must still be validated per [demo-accounts.md](../../../edaya_web/docs/reference/demo-accounts.md) after auth/policy folds — U1 complete; re-check after U3 workflow folds touch portal paths.

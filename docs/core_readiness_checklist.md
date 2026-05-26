# Core Readiness Checklist For Adapters And UI

## Goal

Track the work required for `packages/core` to become a stable application
boundary for two parallel implementation tracks:

- persistence adapters implementing the existing ports and transaction
  boundary; and
- a UI initially developed against the in-memory implementation, then wired
  through an authenticated application/server client.

This checklist concerns **core readiness**, not completion of adapters or UI.
Adapter database mappings, real-transaction verification, screens, and browser
journeys occur after the relevant core contract is ready.

Checklist convention: `[x]` is verified in the current core or its in-memory
tests. `[ ]` is required to consider the selected core contract ready.

## Current Status

- [ ] Core ready for adapters and the full selected UI workflow scope.
- [x] In-memory workflow baseline established for the current public facade.
- [x] Service construction, current actor-bound authorization, atomic compound
  writes, and known session/attendance integrity fixes are implemented.
- [ ] Remaining blockers are stable UI-facing query/error contracts,
  authorization closure for the selected UI surface, and final core evidence
  tests.

Read-only UI work that uses existing overview, directory, timetable, and
attendance-review projections can proceed against the in-memory application.
Interactive screens should not freeze their contracts until the applicable
unchecked items below are complete.

## Boundary Rules

These rules govern all work that follows this checklist:

- The UI consumes public application contracts, not repositories or adapter
  implementations.
- Command operations execute through the actor-bound modules exposed by
  `SchoolHeadlessApp`.
- Reads execute through `SchoolQueryService`; focused services in
  `modules/queries.ts` are composition details, not UI entry points.
- Interactive inputs never supply audit identity. Attribution is resolved from
  trusted `ActorMetadata`.
- Persistence adapters stay actor-agnostic and implement atomicity through
  `AtomicExecutionPort`.
- New UI workflows do not pull deferred domains into scope without an explicit
  contract update in this checklist.

## Selected Scope

First-release core workflow scope:

- Setup required for school, academic year/period, class, staff, subject, and
  report-card operation.
- Student enrollment and guardian association.
- Timetable, attendance, and curriculum progress.
- Assessments, grade entry, and report-card publication.
- Student fees, payments, and reversals.
- Announcements, targets, publishing, and delivery results.
- Workspace, overview, directory, timetable, attendance-review, and necessary
  detail/query projections for those screens.

Deferred unless deliberately selected later:

- Activities and activity enrollment.
- Incidents and disciplinary actions.
- Attachments and resources.
- Exam-specific assessment workflows.
- Automatic delivery-recipient resolution.
- Enrollment lifecycle workflows such as promotion, withdrawal, and transfer.

## Verified Foundation

### Application Boundary

- [x] `SchoolHeadlessApp` exposes the selected eight-module facade:
  `setup`, `academics`, `scheduling`, `assessments`, `students`, `finance`,
  `communications`, and `queries`.
- [x] Public module services are constructed through shared `ServiceArgs`.
- [x] Each command module exposes one authorization-owning service class.
- [x] `queries.ts` intentionally retains focused read-projection services
  composed behind `SchoolQueryService`.
- [x] `SchoolApplication.forActor(...)` constructs an immutable actor-bound
  facade over shared dependencies.

### Authorization And Audit

- [x] `ActorMetadata` supports staff, guardian, student, and system actor
  forms with validated immutable construction.
- [x] All currently exposed facade commands and query entry points invoke the
  authorization policy.
- [x] Current sensitive reads use distinct actions rather than one broad
  school-read permission.
- [x] Current teacher mutation/read checks resolve assignment context.
- [x] Current guardian/student finance and attendance reads are link/self
  scoped.
- [x] Interactive write inputs do not accept caller-supplied audit actor
  fields; stored attribution is actor-derived.
- [x] Current permission evaluation reloads staff, guardian, and student state
  so revoked/inactive actors lose access on subsequent calls.

### Consistency And Atomicity

- [x] Attendance review requires an explicit selected `classGroupId`, validates
  school and optional academic-year context, and rejects a session from
  another class.
- [x] Session creation validates supplied `schoolId` against the resolved
  class group.
- [x] Schedule and session creation validate optional `classSubjectId` belongs
  to the selected class group.
- [x] `AtomicExecutionPort` protects curriculum-progress recording, generated
  session materialization, bulk attendance capture, report-card publication,
  payment recording, and payment reversal.
- [x] A reusable base repository behavior contract exists for later adapters.

### Existing In-Memory Evidence

- [x] Public workflow integration journeys cover setup, scheduling/attendance,
  academics/progress, assessments/report cards, finance/communications, and
  operational queries.
- [x] Atomic rollback tests cover each current compound-write workflow.
- [x] Authorization journeys cover assigned teacher writes and attribution,
  accountant payment authorization, guardian/student scoped reads, sensitive
  projection denial, and actor revocation.
- [x] Tenant-boundary tests cover selected missing/foreign identifier paths
  and the completed session/attendance integrity fixes.

## Core Readiness Gates

### Gate 1: Finalize Screen Query Contracts

Existing read-only projections support early UI work. The following contracts
are required before their corresponding interactive/detail screens and
persistence read shapes are considered stable:

- [ ] Add a reference-data projection for active academic year, periods, grade
  levels, class groups, staff, subjects, and grade scales.
- [ ] Add a student detail projection including enrollment, guardians,
  attendance summary, current balance, and published report cards.
- [ ] Add a curriculum progress detail/history projection.
- [ ] Add a finance ledger projection with fee assignments, payments, status,
  and summary.
- [ ] Add a report-card detail projection with sections, attendance summary,
  and publication state.
- [ ] Add a communications projection for announcements, targets, and
  deliveries.
- [ ] Add actor-scoped teacher, guardian, and student projections required by
  selected UI journeys; do not expose arbitrary owner identifiers to
  self-service callers.

Exit condition:

- [ ] Every selected first-release screen obtains its required data through
  public application query contracts only.

### Gate 2: Stabilize Query And Failure Shapes

- [ ] Define pagination and filtering inputs for directory/list projections
  that will be used against persisted datasets.
- [ ] Define stable ordering for student, class, announcement, and finance
  list projections.
- [ ] Replace UI-visible raw domain `Error` failures with documented typed
  application failures or discriminated results for selected workflows.
- [ ] Decide whether first-release timetable/attendance behavior requires a
  `Session` to link to `GroupedSession`; add a command/query contract only if
  that UI workflow needs it.

Exit condition:

- [ ] Input, output, sorting/paging, and expected failure contracts are stable
  enough for UI and adapter implementations to rely on them.

### Gate 3: Close Authorization For The Selected UI Surface

Already established for current APIs:

- [x] Immutable actor-bound construction and policy invocation.
- [x] Data-sensitive current query actions and actor-derived mutation audit.
- [x] Active/revoked actor checks.
- [x] Representative role and tenant-boundary tests.

Required closure:

- [ ] Maintain an explicit method/action/role manifest for every API selected
  by the first-release UI, including newly added projections.
- [ ] Add allow/deny tests for every method and supported actor category in
  that selected manifest.
- [ ] Add paired missing/foreign identifier tests for every caller-selected
  resource path in the manifest, ensuring stable non-disclosing denial.
- [ ] Add denied-mutation tests proving no repository state changes for every
  selected command family.
- [ ] Add shared-repository concurrency tests for multiple actor-bound
  facades.
- [ ] Enforce the supported client import boundary so UI/application code
  cannot use repository ports or internal query composition services as
  alternate entry points.
- [ ] Decide whether any selected UI or adapter workflow requires assurance
  enforcement; implement policy use of `ActorAssuranceLevel` or explicitly
  remove it from the selected contract.
- [ ] Define allowlisted `SystemActorMetadata` permissions only for selected
  imports/jobs/workers; no system capability is required until such a workflow
  is selected.

Exit condition:

- [ ] The selected UI/API manifest has executable permission, tenant,
  mutation-denial, and concurrency evidence without a facade bypass.

### Gate 4: Confirm The In-Memory Adapter Surface

This gate does not require a database adapter. It makes the public port
surface stable enough to implement one.

- [x] Repository ports support the current selected in-memory workflows.
- [x] `AtomicExecutionPort` defines the transaction boundary for compound
  writes.
- [x] The reusable repository behavior contract can be executed by a future
  adapter.
- [ ] Confirm newly added query contracts from Gate 1 do not require
  persistence-specific behavior in command services.
- [ ] Add in-memory workflow tests for each newly selected query or error
  contract introduced while closing Gates 1 and 2.

Exit condition:

- [ ] The in-memory suite and core ports define the behavior adapters must
  reproduce, without unresolved selected-screen contract gaps.

## Authorization Contract Reference

Current method-to-action groupings that new APIs must preserve or extend:

| Module | Public Operation Group | Authorization Action |
| --- | --- | --- |
| `setup` | school registration | `setup.register_school` |
| `setup` | calendar, level, class, and staff setup | `setup.manage` |
| `setup` | staff assignments | `setup.assign_staff` |
| `academics` | curriculum setup | `academics.manage_curriculum` |
| `academics` | progress write/read | `academics.record_progress`, `academics.read_progress` |
| `scheduling` | schedule/session setup | `scheduling.manage` |
| `scheduling` | attendance write/read | `attendance.record`, `attendance.read` |
| `assessments` | definition setup | `assessments.manage_configuration` |
| `assessments` | grade write/read | `assessments.record_grade`, `assessments.read_grades` |
| `assessments` | report-card publication | `assessments.publish_report_card` |
| `students` | enrollment/guardian management | `students.manage_enrollment`, `students.manage_guardians` |
| `finance` | fee/payment write/read | `finance.manage`, `finance.read` |
| `communications` | announcement/delivery mutation | `communications.manage` |
| `queries` | current operational projections | distinct `queries.read_*` actions |

Current role baseline:

| Actor | Current Core Access Baseline |
| --- | --- |
| Admin/principal staff | Selected-school setup and school-wide operations |
| Coordinator staff | Selected academic/scheduling operations granted by policy |
| Teacher staff | Assigned instructional, grade, and attendance scope only |
| Accountant staff | Selected-school fee/payment scope |
| Guardian | Existing linked-student permitted reads only |
| Student | Existing self-scoped permitted reads only |
| System | Denied until explicit selected job permissions are defined |

## Evidence And Verification

Current evidence lives in:

- `packages/core/tests/auth/actor-metadata.test.ts`
- `packages/core/tests/auth/service-authorization.integration.test.ts`
- `packages/core/tests/services/integration/tenant-boundaries.integration.test.ts`
- `packages/core/tests/services/integration/atomic-workflows.integration.test.ts`
- `packages/core/tests/services/integration/operations-queries.integration.test.ts`
- `packages/core/tests/services/integration/scheduling-attendance.integration.test.ts`
- `packages/core/tests/services/integration/curriculum-progress.integration.test.ts`
- `packages/core/tests/services/integration/assessments.integration.test.ts`
- `packages/core/tests/support/in-memory-repository-contract.test.ts`

Verification commands:

```bash
bun run check
bun --filter=maya_school_core test
npx eslint packages/core/src packages/core/tests
```

## Work After Core Readiness

The following work consumes the ready core and must not be mistaken for
remaining core prerequisites:

- Implement persistence adapters, migrations, indexes, and native
  `AtomicExecutionPort` transactions.
- Run repository contracts, workflow journeys, authorization journeys, and
  rollback tests against the real adapters.
- Build UI screens against the in-memory application/client and later wire
  authenticated server execution through `SchoolApplication.forActor(...)`.
- Add component and browser role journeys once application/server delivery
  exists.


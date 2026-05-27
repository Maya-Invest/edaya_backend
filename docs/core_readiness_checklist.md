# Core Readiness Checklist For Adapters And UI

## Goal

Track the work required for `packages/core` to become a stable application
boundary before starting either implementation track:

- persistence adapters implementing the approved ports and transaction
  boundary; and
- a UI developed against the approved in-memory application contracts, then
  wired through an authenticated application/server client.

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
- [ ] Remaining blockers are stable UI-facing query/error contracts, all
  selected domain workflow contracts, authorization closure for the selected
  UI surface, and final core evidence tests.

UI and persistence adapter implementation should begin only after all
unchecked core contracts and evidence below are complete.

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
- `GroupedSession` is the cross-class scheduling anchor for selected exam and
  activity workflows; class attendance continues to operate through linked
  class-specific `Session` records.
- New UI workflows do not expand the selected domain contract without an
  explicit update in this checklist.

## Selected Scope

First-release core workflow scope:

- Setup required for school, academic year/period lifecycle, calendar, class
  configuration, staff, subject, and report-card operation.
- Student profile and status management, guardian association/contact
  preferences, student notes, and class enrollment.
- Timetable, attendance capture/justification, and curriculum progress.
- Assessments, exam-specific workflows, grade entry, and report-card
  publication.
- Activities and activity enrollment, including activities involving multiple
  classes.
- Incidents, disciplinary actions, and applied student discipline.
- Attachments and resource catalog/assignment for selected domain workflows.
- Student class-enrollment lifecycle, including completion, promotion,
  retention, transfer, and withdrawal.
- Student fees, fee adjustments/cancellations, payments, reversals, and
  payment cancellations.
- Announcements, targets, publishing, automatic recipient resolution, and
  delivery lifecycle/results.
- Workspace, overview, directory, timetable, attendance-review, and necessary
  detail/query projections for those screens.

No currently identified core domain workflow is deferred from this readiness
gate. Future domain additions still require an explicit scope decision.

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

The following contracts are required before UI or persistence read shapes are
considered stable:

- [x] Add a reference-data projection for active academic year, periods, grade
  levels, class groups, staff, subjects, and grade scales through
  `getWorkspaceContext(...)`.
- [ ] Add a student detail projection including enrollment, guardians,
  guardian contact/relationship preferences, authorized student notes,
  student status and health/emergency fields, attendance summary, current
  balance, and published report cards.
- [ ] Add calendar projections for school, grade-level, and class-scoped
  events consumed by timetable/session screens.
- [ ] Add attendance detail projections including reason, notes,
  justification attribution/state, and permitted actor visibility.
- [ ] Add a curriculum progress detail/history projection.
- [x] Add a finance ledger projection with fee assignments, payments, status,
  and summary through `getFinanceLedger(...)`.
- [ ] Add a report-card detail projection with sections, attendance summary,
  and publication state.
- [ ] Add exam workflow projections for exam configuration, participating
  classes, subject assessments, result/publication state, and associated
  grouped sessions.
- [ ] Add activity projections for activity details, scheduled grouped/class
  sessions, participant enrollments, and attendance where selected.
- [ ] Add a communications projection for announcements, targets, and
  deliveries.
- [ ] Add incident and discipline projections for incident detail, student
  involvement, applied actions, and current resolution state.
- [ ] Add attachment and resource projections for selected owners and for
  class/session/grouped-session assignments.
- [ ] Add enrollment lifecycle/history projections including current status,
  outcome, previous enrollment, and transition audit state.
- [ ] Add actor-scoped teacher, guardian, and student projections required by
  selected UI journeys; do not expose arbitrary owner identifiers to
  self-service callers.

Exit condition:

- [ ] Every selected first-release screen obtains its required data through
  public application query contracts only.

### Gate 2: Stabilize Query And Failure Shapes

- [ ] Define pagination and filtering inputs for directory/list projections
  that will be used against persisted datasets.
- [x] Define stable ordering for student, class, announcement, and finance
  list projections: directories are name/id ordered, announcements are
  newest-first, and finance ledger entries/payments use date/id ordering.
- [ ] Replace UI-visible raw domain `Error` failures with documented typed
  application failures or discriminated results for selected workflows.
- [ ] Define and implement the `GroupedSession` contract for selected
  multi-class exam and activity workflows, including the creation and query
  shape of linked class-specific `Session` records.
- [ ] Define how activity/exam grouped sessions participate in attendance,
  staff assignment, and assessment linkage where applicable.
- [ ] Define stable recipient expansion, deduplication, and delivery
  materialization rules for announcements with overlapping targets.
- [ ] Define allowed attachment owners and resource-assignment targets,
  lifecycle rules, and ordering for selected screens.
- [ ] Define student-note visibility enforcement and confidential
  health/emergency-field visibility for all selected actor roles.
- [ ] Define guardian contact method and relationship-preference rules used
  for reports, alerts, pickup/emergency contact, billing, and recipient
  resolution.
- [ ] Define valid student class-enrollment status/outcome transitions and
  how they affect current enrollment reads and workflow eligibility.
- [ ] Define fee adjustment/cancellation and payment cancellation rules,
  including recalculated balances, summaries, and immutable financial audit
  history.
- [ ] Define attendance correction/justification rules and visibility for
  reason and note fields.
- [ ] Define how `AttendanceStatus.Excused` contributes to attendance
  summaries and report cards; it is modeled but not represented by the
  current `AttendanceSummary`.
- [ ] Define setup lifecycle semantics for school/class configuration, active
  academic years, published academic periods, and inactive staff records.
- [ ] Decide and implement `AttendanceMode.Daily` behavior or remove it from
  the selected class contract; current attendance capture is session-based.
- [ ] Define class-capacity enforcement during initial enrollment and
  lifecycle transitions when capacity is configured.
- [ ] Define whether fee installment templates materialize student-fee
  installments during assignment or are removed from the selected contract.

Exit condition:

- [ ] Input, output, sorting/paging, and expected failure contracts are stable
  enough for UI and adapter implementations to rely on them.

### Gate 3: Implement Exam And Activity Workflows

Available domain building blocks:

- [x] Entities and repository ports exist for `Exam`, `ExamSubject`,
  `ClassExam`, `Activity`, `StudentActivityEnrollment`, and `GroupedSession`.
- [x] A grouped session can be created and staffed through the public facade.
- [x] Report-card calculation can filter already-linked assessments by
  `examId`.
- [x] `Session` supports `groupedSessionId` and `activityId` references.

Required exam workflows:

- [ ] Add public exam configuration commands to create an exam and its
  selected subjects with school/year/subject validation.
- [ ] Add public class-exam lifecycle commands for the participating classes,
  periods, and statuses.
- [ ] Link exam assessments and class-specific sessions to the selected
  exam/grouped-session model without requiring direct repository writes.
- [ ] Complete the exam result/publication flow through public commands and
  exam-specific query contracts.

Required activity workflows:

- [ ] Select and expose the public activity command owner: extend an
  existing module deliberately or add an `activities` facade module.
- [ ] Add public activity setup and scheduling commands, including
  multi-class grouped activity sessions where applicable.
- [ ] Add activity enrollment and withdrawal commands with selected
  eligibility and lifecycle validation.
- [ ] Connect activity participation to linked class sessions and attendance
  recording where the activity requires attendance.
- [ ] Expose activity catalog, participation, enrollment, and selected
  attendance state through public query contracts.

Exit condition:

- [ ] Exam and activity journeys can be implemented by the UI solely through
  public application contracts, including cross-class scheduling behavior.

### Gate 4: Implement Remaining Selected Workflows

Available domain building blocks:

- [x] Entities and repository ports exist for incidents, disciplinary
  actions, student incident involvement, and applied disciplinary actions.
- [x] Entities and repository ports exist for attachments, resources, and
  resource assignments.
- [x] `StudentClassEnrollment` models completion, promotion, retention,
  transfer, and withdrawal state; basic initial enrollment is public.
- [x] `Student` models status and health/emergency data; `StudentNote` has a
  repository port with explicit visibility modes.
- [x] Guardian registration accepts embedded `GuardianContactMethod` values,
  and `GuardianStudentLink` models communication, legal, pickup, emergency,
  and billing preferences.
- [x] `CalendarEvent` has a repository port and session generation currently
  consumes non-school days.
- [x] `AttendanceRecord` models reasons, notes, and justification metadata;
  current services record attendance status only.
- [x] Finance entities model student-fee adjustments/cancellation and payment
  cancellation; current services expose assignment, payment, and reversal.
- [x] Setup entities model school type, class capacity/attendance mode/
  homeroom assignment, active academic years, published periods, and active
  staff records.
- [x] Communications can create targets, publish announcements, and record a
  delivery for an explicitly supplied recipient.

Required setup configuration completion:

- [ ] Expose and validate selected school/class configuration fields,
  including school type, class capacity, attendance mode, and homeroom
  assignment.
- [ ] Add explicit active academic-year, period publication, and staff
  activation/deactivation contracts rather than requiring UI code to
  reconstruct entities.
- [ ] Ensure active academic-year selection is deterministic and constrained
  according to the selected setup rules.

Required student profile, note, and guardian-contact workflows:

- [ ] Add public commands to update student profile/status and selected
  health/emergency information with confidential-field access rules.
- [ ] Add public student-note creation/update/read contracts enforcing
  `Staff`, `AdminOnly`, and `GuardianVisible` visibility.
- [ ] Extend guardian/contact/link commands to maintain contact methods,
  notification opt-ins, billing/legal/pickup/emergency/report/attendance
  preferences, and restrictions.

Required incident and discipline workflows:

- [ ] Select and expose the public command owner for incident and discipline
  operations.
- [ ] Add public commands for disciplinary-action catalog setup, incident
  recording, student involvement, applying actions, and action state changes.
- [ ] Add public incident/discipline reads appropriate to administrative,
  staff, guardian, and student visibility rules.

Required attachment and resource workflows:

- [ ] Select and expose the public command owner for attachment and resource
  operations.
- [ ] Add public attachment registration/removal contracts for allowed
  selected-domain owners; keep file storage transport outside core.
- [ ] Align `AttachmentOwnerKind.HealthRecord` with the selected student
  health model or remove that unsupported owner kind from the public
  contract.
- [ ] Add public resource catalog and assignment commands for classes,
  sessions, and grouped exam/activity sessions.
- [ ] Add resource-conflict validation required for scheduling rooms,
  equipment, or vehicles.

Required communications completion:

- [ ] Add a public operation that resolves published announcement targets to
  concrete recipients and materializes delivery records without duplicate
  recipients.
- [ ] Define channel selection, retry/idempotency, and atomicity boundaries
  for generated deliveries.

Required academic calendar completion:

- [ ] Add public commands and reads for school, grade-level, and class-scoped
  calendar events.
- [ ] Correct session generation to apply scoped non-school events only to
  affected class groups, while school-wide non-school events apply globally.
- [ ] Define how exam periods, activities, and manually scheduled grouped
  sessions use or coexist with calendar events.

Required attendance completion:

- [ ] Implement daily attendance behavior for classes configured with
  `AttendanceMode.Daily`, or formally restrict first-release classes to
  session attendance.
- [ ] Add public attendance correction/justification commands that preserve
  actor-derived attribution for recording and justifying staff.
- [ ] Expose reason, note, and justification details only to permitted actors,
  while keeping guardian/student attendance reads appropriately scoped.
- [ ] Extend attendance/report-card summaries to account for excused records
  according to the selected attendance policy.

Required finance completion:

- [ ] Materialize configured fee-installment templates on student assignment,
  or remove the unused template behavior from the selected finance contract.
- [ ] Add public student-fee adjustment and cancellation commands with
  balance/status recalculation.
- [ ] Add public payment cancellation behavior or deliberately consolidate it
  with reversal while aligning the entity contract.
- [ ] Preserve auditable prior payment/fee state and cover ledger summary
  changes for adjustments and cancellations.

Required class-enrollment lifecycle:

- [ ] Add public commands to complete, promote, retain, transfer, and
  withdraw a student's class enrollment using validated transitions.
- [ ] Ensure lifecycle transitions update current-enrollment behavior and do
  not leave conflicting current enrollments.
- [ ] Enforce class capacity consistently for initial enrollment, promotion,
  retention, and transfer when a class defines capacity.
- [ ] Define downstream behavior for attendance, assessment/report-card, fee,
  activity, and communications access after a class-enrollment transition.

Exit condition:

- [ ] Each selected setup, student record, calendar, attendance, finance,
  incident, attachment/resource, communications-recipient, and
  enrollment-lifecycle journey can be executed through public application
  contracts without UI or adapters implementing domain decisions.

### Gate 5: Close Authorization For The Selected UI Surface

Already established for current APIs:

- [x] Immutable actor-bound construction and policy invocation.
- [x] Data-sensitive current query actions and actor-derived mutation audit.
- [x] Active/revoked actor checks.
- [x] Representative role and tenant-boundary tests.

Required closure:

- [ ] Maintain an explicit method/action/role manifest for every API selected
  by the first-release UI, including newly added projections.
- [ ] Define action/resource-context rules for exam configuration,
  class-exam/result lifecycle, activity setup/enrollment, and cross-class
  grouped-session operations.
- [ ] Define action/resource-context and visibility rules for incidents and
  discipline, attachments/resources, recipient expansion, and class-enrollment
  lifecycle transitions.
- [ ] Define action/resource-context and visibility rules for student
  status/health data, notes, guardian contact preferences, and scoped calendar
  operations.
- [ ] Define action/resource-context and visibility rules for attendance
  justification, setup lifecycle changes, and fee/payment adjustment or
  cancellation.
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

### Gate 6: Confirm The In-Memory Adapter Surface

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
  contract introduced while closing Gates 1 through 4.
- [ ] Add in-memory multi-class exam and activity-enrollment journeys,
  including grouped-session linkage and applicable attendance behavior.
- [ ] Add in-memory journeys for incident/discipline handling,
  attachment/resource assignment, automatic recipient resolution, and each
  selected class-enrollment transition.
- [ ] Add in-memory journeys for student notes/confidential profile access,
  guardian contact preferences, and scoped calendar-event session generation.
- [ ] Add in-memory journeys for setup lifecycle/configuration, attendance
  justification, student-fee adjustment/cancellation, and payment
  cancellation/reversal semantics.
- [ ] Add atomic rollback and tenant/authorization evidence for any new
  compound-write selected-domain command.

Exit condition:

- [ ] The in-memory suite and core ports define the behavior adapters must
  reproduce, without unresolved selected-screen contract gaps.

## Authorization Contract Reference

Current method-to-action groupings that new APIs must preserve or extend:

| Module | Public Operation Group | Authorization Action |
| --- | --- | --- |
| `setup` | school registration | `setup.register_school` |
| `setup` | calendar, level, class, and staff setup | `setup.manage` |
| `setup` | setup lifecycle/configuration state changes | `[ ]` Define update/activation/publication rules |
| `setup` | staff assignments | `setup.assign_staff` |
| `academics` | curriculum setup | `academics.manage_curriculum` |
| `academics` | progress write/read | `academics.record_progress`, `academics.read_progress` |
| `scheduling` | schedule/session setup | `scheduling.manage` |
| `scheduling` | attendance write/read | `attendance.record`, `attendance.read` |
| `scheduling` | attendance correction/justification and detailed visibility | `[ ]` Define action split and visibility rules |
| `assessments` | definition setup | `assessments.manage_configuration` |
| `assessments` | grade write/read | `assessments.record_grade`, `assessments.read_grades` |
| `assessments` | report-card publication | `assessments.publish_report_card` |
| `assessments` | exam configuration, class-exam lifecycle, and exam results | `[ ]` Define selected action split |
| `students` | enrollment/guardian management | `students.manage_enrollment`, `students.manage_guardians` |
| `students` | profile/status and confidential health/emergency data | `[ ]` Define selected write/read action split |
| `students` | student notes with actor-visible filtering | `[ ]` Define visibility-scoped actions |
| `students` | guardian contact and relationship preferences | `[ ]` Extend guardian action/resource rules |
| `students` / activities | activity setup and student activity enrollment | `[ ]` Define selected action split |
| `students` | class-enrollment lifecycle transitions | `[ ]` Define selected action split |
| `students` / behavior | incidents, involvement, and disciplinary actions | `[ ]` Define selected action split and visibility rules |
| `setup` / scheduling | resource catalog and class/session/grouped-session assignments | `[ ]` Define selected action split |
| selected owner modules | attachment registration/removal/read access | `[ ]` Define owner-scoped actions |
| `finance` | fee/payment write/read and student-ledger projection | `finance.manage`, `finance.read` |
| `finance` | student-fee adjustment/cancellation and payment cancellation | `[ ]` Define audited transition actions |
| `communications` | announcement/delivery mutation | `communications.manage` |
| `communications` | recipient resolution and delivery materialization | `[ ]` Extend action/resource/idempotency rules |
| `queries` | current operational projections | distinct `queries.read_*` actions |
| `scheduling` | cross-class exam/activity grouped sessions | `[ ]` Extend `scheduling.manage` context or define dedicated action |
| `scheduling` | scoped calendar events and non-school-day effects | `[ ]` Define manage/read scope checks |

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

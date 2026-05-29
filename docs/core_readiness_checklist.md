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

- [x] Core ready for adapters and the full selected UI workflow scope.
- [x] In-memory workflow baseline established for the current public facade.
- [x] Service construction, current actor-bound authorization, atomic compound
  writes, and known session/attendance integrity fixes are implemented.
- [x] The simplified assessment/scheduling model removes exam, activity, and
  grouped-session aggregates and uses `AssessmentResult` for recorded scores.
- [x] Remaining blockers are stable UI-facing query/error contracts, all
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
- Sessions are class-specific scheduling and attendance anchors. There is no
  selected cross-class grouped-session contract.
- New UI workflows do not expand the selected domain contract without an
  explicit update in this checklist.

## Selected Scope

First-release core workflow scope:

- Setup required for school, academic year/period lifecycle, calendar, class
  configuration, staff, subject, and report-card operation.
- Student profile and status management, guardian association/contact
  preferences, student notes, and class enrollment.
- Timetable, attendance capture/justification, and curriculum progress.
- Assessments, assessment-result entry, and report-card publication.
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

Explicitly excluded from this readiness gate:

- Exam aggregate/configuration/class-exam workflows.
- Activity catalog, activity enrollment, and activity attendance workflows.
- Grouped-session and other cross-class session workflows.

`GradeLevel` and `GradeScale` remain selected school/reporting concepts;
recorded student outcomes are `AssessmentResult`, not `Grade`. Reintroducing
any excluded workflow requires an explicit scope and contract update.

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
  payment recording, payment reversal, and compound enrollment transitions.
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
- [x] Assessment integration and authorization journeys use
  `AssessmentResult` operations, immutable published report-card snapshots,
  report-card details, and report-card result counts.
- [x] Enrollment lifecycle journeys cover promotion, transfer rollback,
  graduation, valid/invalid progression decisions, ordered history reads,
  destination capacity, and post-transition current-operation boundaries.
- [x] Type checking and the current `52`-test in-memory suite pass after
  removing the exam, activity, and grouped-session contracts.

## Core Readiness Gates

### Gate 1: Finalize Screen Query Contracts

The following contracts are required before UI or persistence read shapes are
considered stable:

- [x] Add a reference-data projection for active academic year, periods, grade
  levels, class groups, staff, subjects, and grade scales through
  `getWorkspaceContext(...)`.
- [x] Add a student detail projection including enrollment, guardians,
  guardian contact/relationship preferences, authorized student notes,
  student status and health/emergency fields, attendance summary, current
  balance, and published report cards through `getStudentDetail(...)`.
- [x] Add a calendar projection for school, grade-level, and class-scoped
  events consumed by timetable/session screens through
  `getCalendarEvents(...)`.
- [x] Expose attendance reason, notes, justification attribution/state, and
  excused-absence summary state through staff-scoped
  `getAttendanceSessionReview(...)`.
- [x] Add a curriculum progress detail/history projection through
  `getClassSubjectProgressDetail(...)`.
- [x] Add a finance ledger projection with fee assignments, payments, status,
  and summary through `getFinanceLedger(...)`.
- [x] Add an administrative report-card detail projection with stored
  sections, attendance summary, publication state, resolved student/class/
  period/definition context, and contributing assessment results through
  `getReportCardDetail(...)`.
- [x] Add an assessment and assessment-result projection for result entry and
  review screens through `getAssessmentEntryReview(...)`, with active roster
  rows and per-student published-report-card lock state.
- [x] Add administrative communications projections for announcements,
  targets, and deliveries through `listAnnouncements(...)` and
  `getAnnouncementDetail(...)`, including delivery status summaries.
- [x] Add incident and discipline projections for incident detail, student
  involvement, applied actions, and current resolution state through
  `getIncidentDetail(...)` and `listStudentIncidents(...)`.
- [x] Add attachment and resource projections for selected owners and for
  class/session assignments.
- [x] Add an administrative enrollment lifecycle/history projection including
  current status, resolved academic context, closure reason, progression
  decision, previous enrollment, and transition audit state through
  `getStudentEnrollmentHistory(...)`.
- [x] Add actor-scoped teacher, guardian, and student projections required by
  selected UI journeys; do not expose arbitrary owner identifiers to
  self-service callers.

Exit condition:

- [x] Every selected first-release screen obtains its required data through
  public application query contracts only.

### Gate 2: Stabilize Query And Failure Shapes

- [x] Define pagination and filtering inputs for directory/list projections
  that will be used against persisted datasets.
- [x] Define stable ordering for student, class, announcement, and finance
  list projections: directories are name/id ordered, announcements are
  newest-first, and finance ledger entries/payments use date/id ordering.
- [x] Replace UI-visible raw domain `Error` failures with documented typed
  application failures or discriminated results for selected workflows.
- [x] Use assessment-result terminology for the authorization actions:
  `assessments.record_result` and `assessments.read_results`.
- [x] Treat published report-card results as immutable snapshots: publication
  blocks result/compliance edits, regeneration, and re-publication for the
  student-period unless a future explicit reopen workflow is added.
- [x] Define stable recipient expansion, deduplication, and delivery
  materialization rules for announcements with overlapping targets:
  `materializeDeliveries(...)` resolves concrete recipients, deduplicates by
  recipient kind/id, and reuses existing announcement/channel deliveries.
- [x] Define allowed attachment owners and resource-assignment targets,
  lifecycle rules, and ordering for selected screens.
- [x] Define student-detail read visibility for student notes and
  confidential health/emergency fields across staff, guardian, and student
  actors.
- [x] Define guardian contact method and relationship-preference visibility
  for the student-detail read projection.
- [x] Separate active/closed class-enrollment lifecycle state from completion
  reasons and progression decisions in the entity contract.
- [x] Define valid student class-enrollment transitions: active enrollments
  may close, completed enrollments may receive one progression decision,
  promotion/transfer atomically create one linked active successor, and
  graduation closes the placement and graduates the student profile.
- [x] Define fee adjustment/cancellation and payment cancellation rules:
  a student fee accepts one attributed reduction while preserving its original
  assigned amount, cancellation requires no recorded paid balance, cancelled
  obligations are excluded from payable summaries, and payment
  cancellation/reversal preserve amount and actor/date audit state.
- [x] Define attendance correction/justification rules and visibility:
  attendance corrections preserve capture attribution and store correction
  attribution, reviewed decisions are immutable without a future reopen
  workflow, and detailed reason/note reads remain staff-scoped.
- [x] Model excusal as attendance justification state, separately from
  present/absent/late facts, and include excused absences in summaries.
- [x] Define setup lifecycle semantics for school/class configuration, active
  academic years, published academic periods, and inactive staff records.
- [x] Implement `AttendanceMode.Daily` behavior: daily classes record against
  a deterministic class/date attendance session while session-mode classes
  retain explicit session attendance.
- [x] Enforce class capacity when initial enrollment, promotion, or transfer
  creates an active placement; re-enrollment after a retained decision uses
  the same initial-enrollment capacity rule.
- [x] Materialize validated fee installment templates into student-fee
  installments during assignment.

Exit condition:

- [x] Input, output, sorting/paging, and expected failure contracts are stable
  enough for UI and adapter implementations to rely on them.

### Gate 3: Confirm The Simplified Assessment And Session Contract

- [x] `AssessmentResult` replaces the recorded `Grade` entity in exports,
  repository ports, assessment services, and in-memory support.
- [x] Assessment and report-card services operate on assessment results and
  no longer accept or resolve `examId`.
- [x] Published report-card results are stored snapshots and cannot be
  silently recomputed or invalidated by subsequent assessment-result writes.
- [x] Assessment result entry reads resolve the active class roster and expose
  published-report-card locking without reopening historical placements.
- [x] `Exam`, `ExamSubject`, `ClassExam`, `Activity`,
  `StudentActivityEnrollment`, and `GroupedSession` are removed from the
  selected entity and repository surface.
- [x] `Session`, `StaffAssignment`, and `ResourceAssignment` expose no
  grouped-session or activity linkage.
- [x] `FeeCategory` no longer includes exam or activity fee categories.
- [x] The selected public enums contain no exam-specific category values:
  `AssessmentKind.Exam`, `ReportCardDefinitionKind.Exam`, and
  `CalendarEventKind.ExamPeriod` are removed; the already simplified
  `ReportCardDefinitionSectionKind` exposes only group and subject sections.

Exit condition:

- [x] The selected assessment/result and class-session surface contains no
  unintended dependency on excluded workflow concepts or legacy public
  naming.

### Gate 4: Implement Remaining Selected Workflows

Available domain building blocks:

- [x] Entities and repository ports exist for incidents, disciplinary
  actions, student incident involvement, and applied disciplinary actions.
- [x] Entities and repository ports exist for attachments, resources, and
  resource assignments.
- [x] `StudentClassEnrollment` separates active/closed placement state,
  closure reason, progression decision, and actor attribution; initial
  enrollment, close, promotion, transfer, retention decision, and graduation
  workflows are public.
- [x] `Student` models general profile status while `StudentHealthProfile`
  separately models health/emergency data; `StudentNote` has a repository port
  with explicit visibility modes.
- [x] Guardian registration accepts embedded `GuardianContactMethod` values,
  and `GuardianStudentLink` models communication, legal, pickup, emergency,
  and billing preferences.
- [x] `CalendarEvent` has a repository port and session generation consumes
  school, grade-level, and class-scoped non-school days.
- [x] `AttendanceRecord` models reasons, notes, justification metadata, and
  correction audit; services expose attendance capture/correction and
  `reviewAttendanceJustification(...)`.
- [x] Finance entities model materialized installments, student-fee
  adjustments/cancellation, and payment cancellation; current services expose
  assignment, payment, and reversal.
- [x] Setup entities model school type, class capacity/attendance mode/
  homeroom assignment, active academic years, published periods, and active
  staff records.
- [x] Communications can create targets, publish announcements, record a
  delivery for an eligible explicitly supplied recipient, and atomically
  materialize deduplicated recipient/channel deliveries; class/grade target
  eligibility is resolved from active enrollments.

Required setup configuration completion:

- [x] Expose and validate selected school/class configuration fields,
  including school type, class capacity, attendance mode, and homeroom
  assignment.
- [x] Add explicit active academic-year, period publication, and staff
  activation/deactivation contracts rather than requiring UI code to
  reconstruct entities.
- [x] Ensure active academic-year selection is deterministic and constrained
  according to the selected setup rules.

Required student profile, note, and guardian-contact workflows:

- [x] Add public commands to update student profile/status and selected
  health/emergency information with confidential-field access rules.
- [x] Add public student-note creation/update/read contracts enforcing
  `Staff`, `AdminOnly`, and `GuardianVisible` visibility.
- [x] Extend guardian/contact/link commands to maintain contact methods,
  notification opt-ins, billing/legal/pickup/emergency/report/attendance
  preferences, and restrictions.

Required incident and discipline workflows:

- [x] Select and expose `behavior` as the public command owner for incident
  and discipline operations.
- [x] Add public commands for disciplinary-action catalog setup, incident
  recording, student involvement, applying actions, action state changes, and
  incident resolution.
- [x] Add incident/discipline reads for administrative/coordinator and
  assignment-scoped staff visibility; guardian/student visibility remains
  withheld until explicitly selected.

Required attachment and resource workflows:

- [x] Select and expose `setup` as the public command owner for attachment and resource
  operations.
- [x] Add public attachment registration/removal contracts for allowed
  selected-domain owners; keep file storage transport outside core.
- [x] Align attachment health ownership with `StudentHealthProfile`.
- [x] Add public resource catalog and assignment commands for classes and
  sessions.
- [x] Add resource-conflict validation required for scheduling rooms,
  equipment, or vehicles.

Required communications completion:

- [x] Add `materializeDeliveries(...)` to resolve published announcement
  targets to concrete recipients and materialize delivery records without
  duplicate recipients.
- [x] Define generated-delivery channel, retry/idempotency, and atomicity
  boundaries: callers select one channel per materialization request;
  retries reuse recipient/channel delivery records; all new records for the
  request save atomically.

Required academic calendar completion:

- [x] Add public `createCalendarEvent(...)` and `getCalendarEvents(...)`
  contracts for school, grade-level, and class-scoped calendar events.
- [x] Correct session generation to apply scoped non-school events only to
  affected class groups, while school-wide non-school events apply globally.

Required attendance completion:

- [x] Implement daily attendance behavior for classes configured with
  `AttendanceMode.Daily`.
- [x] Preserve actor-derived attribution when `recordAttendance(...)`
  corrects status, and add coordinator/administrative
  `reviewAttendanceJustification(...)` for excused/rejected decisions.
- [x] Expose reason, note, and justification details through assigned-staff/
  coordinator/administrative review queries only, while guardian/student
  attendance reads remain aggregate and scoped.
- [x] Preserve absent attendance facts separately from excusal and expose
  excused-absence counts in attendance/report-card summaries.

Required finance completion:

- [x] Materialize configured fee-installment templates on student assignment.
- [x] Add public `adjustStudentFee(...)` and `cancelStudentFee(...)` commands
  with balance/status recalculation.
- [x] Add distinct public `cancelPayment(...)` behavior alongside reversal.
- [x] Preserve the original assigned/payment amount plus attributed
  adjustment/cancellation/reversal state and cover ledger summary changes for
  adjustments and cancellations.

Required class-enrollment lifecycle:

- [x] Add public commands to close/withdraw, promote, record retention,
  transfer, and graduate a student's class enrollment using validated transitions.
- [x] Ensure lifecycle transitions update current-enrollment behavior and do
  not leave conflicting current enrollments.
- [x] Enforce class capacity consistently for initial enrollment and successor
  placements created by promotion or transfer; retained students are checked
  when a new placement is created.
- [x] Define downstream behavior after an enrollment transition: closed
  placements remain available to enrollment/report-card/fee history, but
  current rosters, attendance writes, new assessment-result/compliance writes,
  and class/grade-targeted message deliveries require an active placement.

Exit condition:

- [x] Each selected setup, student record, calendar, attendance, finance,
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

- [x] Maintain an explicit method/action/role manifest for every API selected
  by the first-release UI, including newly added projections.
- [x] Define action/resource-context and visibility rules for incidents and
  discipline.
- [x] Define action/resource-context and visibility rules for
  attachments/resources, recipient expansion, and class-enrollment lifecycle
  transitions.
- [x] Define action/resource-context and visibility rules for student
  status/health data, notes, guardian contact preferences, and scoped calendar
  operations.
- [x] Define action/resource-context and visibility rules for attendance
  justification and fee/payment adjustment or cancellation.
- [x] Define action/resource-context rules for setup lifecycle changes.
- [x] Add allow/deny tests for every method and supported actor category in
  that selected manifest.
- [x] Add paired missing/foreign identifier tests for every caller-selected
  resource path in the manifest, ensuring stable non-disclosing denial.
- [x] Add denied-mutation tests proving no repository state changes for every
  selected command family.
- [x] Add shared-repository concurrency tests for multiple actor-bound
  facades.
- [x] Enforce the supported client import boundary so UI/application code
  cannot use repository ports or internal query composition services as
  alternate entry points.
- [x] Decide whether any selected UI or adapter workflow requires assurance
  enforcement; implement policy use of `ActorAssuranceLevel` or explicitly
  remove it from the selected contract.
- [x] Define allowlisted `SystemActorMetadata` permissions only for selected
  imports/jobs/workers; no system capability is required until such a workflow
  is selected.

Exit condition:

- [x] The selected UI/API manifest has executable permission, tenant,
  mutation-denial, and concurrency evidence without a facade bypass.

### Gate 6: Confirm The In-Memory Adapter Surface

This gate does not require a database adapter. It makes the public port
surface stable enough to implement one.

- [x] Repository ports support the current selected in-memory workflows.
- [x] `AtomicExecutionPort` defines the transaction boundary for compound
  writes.
- [x] The reusable repository behavior contract can be executed by a future
  adapter.
- [x] Confirm newly added query contracts from Gate 1 do not require
  persistence-specific behavior in command services.
- [x] Add in-memory workflow tests for each newly selected query or error
  contract introduced while closing Gates 1 through 4.
- [x] Add in-memory journeys for incident/discipline handling.
- [x] Add in-memory journeys for attachment/resource assignment, automatic
  recipient resolution, and each selected class-enrollment transition.
- [x] Add in-memory journeys for student notes/confidential profile access,
  guardian contact preferences, and scoped calendar-event session generation.
- [x] Add in-memory journeys for attendance justification,
  student-fee adjustment/cancellation, and payment cancellation/reversal
  semantics.
- [x] Add in-memory journeys for setup lifecycle/configuration.
- [x] Add atomic rollback and tenant/authorization evidence for any new
  compound-write selected-domain command.

Exit condition:

- [x] The in-memory suite and core ports define the behavior adapters must
  reproduce, without unresolved selected-screen contract gaps.

## Authorization Contract Reference

Current method-to-action groupings that new APIs must preserve or extend:

| Module | Public Operation Group | Authorization Action |
| --- | --- | --- |
| `setup` | school registration | `setup.register_school` |
| `setup` | calendar, level, class, and staff setup | `setup.manage` |
| `setup` | setup lifecycle/configuration state changes | `setup.manage_lifecycle`; coordinators/admins may update school/class configuration, select the active academic year, publish periods, and activate/deactivate staff |
| `setup` | staff assignments | `setup.assign_staff` |
| `academics` | curriculum setup | `academics.manage_curriculum` |
| `academics` | progress write/read | `academics.record_progress`, `academics.read_progress` |
| `scheduling` | schedule/session setup | `scheduling.manage` |
| `scheduling` | attendance write/read | `attendance.record`, `attendance.read` |
| `scheduling` / `queries` | attendance correction/justification and detailed visibility | `attendance.record`, `attendance.review_justification`, `queries.read_attendance`; justification review is coordinator/administrative and detailed reads include assigned staff |
| `assessments` | definition setup | `assessments.manage_configuration` |
| `assessments` | assessment result write/read | `assessments.record_result`, `assessments.read_results` |
| `assessments` | report-card publication | `assessments.publish_report_card` |
| `students` | enrollment/guardian management | `students.manage_enrollment`, `students.manage_guardians` |
| `students` / `queries` | profile/status and confidential health/emergency data | `students.manage_profile`, `students.manage_health`, `queries.read_student_detail`; health writes are coordinator/admin and reads remain visibility-filtered |
| `students` / `queries` | student notes with actor-visible filtering | `students.manage_notes`, `queries.read_student_detail`; assigned teachers may write non-admin notes, coordinator/admin may write all selected note visibility levels |
| `students` / `queries` | guardian contact and relationship preferences | `students.manage_guardians`, `queries.read_student_detail`; coordinator/admin maintain contact methods, notification preferences, and link restrictions |
| `students` | class-enrollment lifecycle transitions | `students.manage_enrollment` |
| `behavior` / `queries` | incidents, involvement, and disciplinary actions | `behavior.report_incident`, `behavior.manage_discipline`, `behavior.read_incidents`; assigned staff may report/read scoped incidents, coordinators/admins manage discipline |
| `setup` / `queries` | resource catalog and class/session assignments | `resources.manage`, `resources.read`; coordinators/admins manage, resources are read through the query facade |
| `setup` / `queries` | attachment registration/removal/read access | `attachments.manage`, `attachments.read`; `setup` validates selected owner references and keeps file storage transport outside core |
| `finance` | fee/payment write/read and student-ledger projection | `finance.manage`, `finance.read` |
| `finance` | student-fee adjustment/cancellation and payment cancellation | `finance.manage`; attributed audited transitions |
| `communications` | announcement/delivery mutation | `communications.manage` |
| `communications` | recipient resolution and delivery materialization | `communications.manage`; deterministic recipient/channel idempotency |
| `queries` | current operational projections, enrollment history, report-card, communications, and curriculum-progress detail | distinct `queries.read_*` actions including `queries.read_communications`, `queries.read_curriculum_progress` |
| `scheduling` / `queries` | scoped calendar events and non-school-day effects | `scheduling.manage`, `queries.read_calendar`; administrative/coordinator scope |

Current role baseline:

| Actor | Current Core Access Baseline |
| --- | --- |
| Admin/principal staff | Selected-school setup and school-wide operations |
| Coordinator staff | Selected academic/scheduling operations and enrollment history granted by policy |
| Teacher staff | Assigned instructional, assessment result, and attendance scope only |
| Accountant staff | Selected-school fee/payment scope |
| Guardian | Existing linked-student permitted reads only |
| Student | Existing self-scoped permitted reads only |
| System | Denied until explicit selected job permissions are defined |

## Evidence And Verification

Current evidence lives in:

- `packages/core/tests/unit-testing/auth/actor-metadata.test.ts`
- `packages/integration-tests/src/auth/test_actor_role_and_assurance_permission_policies.integration.test.ts`
- `packages/integration-tests/src/services/tenant-boundaries.integration.test.ts`
- `packages/integration-tests/src/services/atomic-workflows.integration.test.ts`
- `packages/integration-tests/src/services/setup-lifecycle.integration.test.ts`
- `packages/integration-tests/src/auth/concurrency.integration.test.ts`
- `packages/core/tests/unit-testing/support/in-memory-repository-contract.test.ts`
- `packages/core/tests/unit-testing/support/test_business_rule_exception_codes.test.ts`

Verification commands:

```bash
bun run check
bun --filter=@edaya/core test
bun --filter=@edaya/integration-tests test
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

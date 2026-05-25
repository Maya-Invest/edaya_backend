# Service Call Authorization Implementation Plan

## Objective

Enforce school-management authorization at the application boundary by making
each public service/query call operate inside an immutable, actor-bound
execution scope. Authentication establishes trusted `ActorMetadata`;
authorization policies evaluate what that actor may do with current domain
resources.

This work must be completed before interactive UI command screens are treated
as production-ready.

## Implemented Primitives

The following foundation now exists in `packages/core/src/services/authorization/`:

- `ActorMetadata`, with distinct staff, guardian, student, and system actor
  variants.
- Runtime actor constructors that validate trusted metadata and freeze the
  resulting execution context.
- `ActorAssuranceLevel` for sensitive-operation requirements.
- `resolveAuditActorId(...)` for consistent server-side attribution.
- `AuthorizationError` and stable error codes.
- `AuthorizationPolicy`, its typed action/resource request contract, and an
  initial repository-backed policy implementation.
- `SchoolApplication.forActor(...)`, which constructs an immutable
  actor-bound eight-module facade over shared dependencies.

All currently exported service and query methods on the selected eight-module
facade now invoke authorization through the actor-bound facade. This is the
protected in-memory call-surface baseline, not the definition of complete
authorization integration across future APIs and deployment layers. Remaining
gaps and completion gates are tracked below.

## Completion Definition

Authorization integration is 100% complete only when all of the following are
true for the selected eight-module facade:

- Every exported public command and query has one documented permission,
  sufficient resolved resource context, and allow/deny coverage for every
  supported actor category.
- Authorization denies access without revealing whether an inaccessible
  resource exists.
- No interactive command contract accepts attribution fields that the client
  can attempt to spoof; audit identity is actor-derived by type, not only
  overwritten at runtime.
- Staff, guardian, and student authorization decisions account for current
  access state, not only the actor metadata received at facade construction.
- System operations use explicit allowlisted actions and audit reason
  requirements; there is no blanket implicit system privilege.
- Multiple actor-bound facades can share repositories without cross-request
  authorization or data leakage.
- Adapter-backed and application-client/server paths invoke the same
  actor-bound facade boundary; no UI or route accesses repositories directly.

## Gap Register

| Gap | Current State | Required Closure | Evidence Required |
| --- | --- | --- | --- |
| Permission granularity | Existing grade and query methods now use distinct actions, including `assessments.read_grades` and separate overview, student-directory, class, timetable, attendance, workspace, and guardian-administration reads. | Maintain this separation as projections are added and finish the exhaustive role/method manifest. | A permission matrix test covering each public method and each supported role. |
| Teacher query scoping | Teachers can read current class/subject/session-scoped projections only with assignment context; school-wide and sensitive projections are denied. | Add assignment-filtered list/workspace variants if teacher UI needs them; do not grant broad school reads. | Teacher sees assigned records and cannot infer unassigned records. |
| Guardian/student APIs | `listMyStudents()` and self/link-scoped finance/attendance reads exist; timetable, published-report, and permitted communications self-service projections do not. | Add only actor-scoped self-service query APIs required by UI, never arbitrary owner-id reads. | Cross-owner deny tests for every self-service projection. |
| Interactive attribution contracts | Current interactive facade inputs no longer expose `createdBy`, `recordedById`, `recordedByStaffId`, or `updatedByStaffId`; stored values are actor-derived. | Preserve this rule for new mutations or use explicit trusted job/import methods. | Existing persistence assertions plus compile validation. |
| Current actor state | `RepositoryAuthorizationPolicy` now resolves current staff, guardian, and student records and denies inactive staff, disabled guardians, and inactive students. | Define session/token invalidation outside core when a persistent authentication boundary is added. | Revoked actor regression tests and later server-session tests. |
| Tenant-safe denials | Current public facade calls normalize missing and foreign caller-selected resource identifiers to `AuthorizationErrorCode.Forbidden` through the authorization-aware resolution path. | Preserve this behavior for new calls and enforce facade-only application imports before adapter/server adoption. | Paired missing/foreign denial assertions across setup, academics, assessment reads, communications, and queries, plus self-read cases. |
| System operations | `SystemActorMetadata` exists, but the repository-backed policy currently denies every system action. | Define named job capabilities and allow only their minimum operations with mandatory audit reason. | Per-job allow/deny tests and audit attribution assertions. |
| Constructor/export boundary | Outer facade services require actor/policy dependencies; internal helper services intentionally do not. | Treat `SchoolApplication.forActor(...)` as the only supported execution entry point and prevent application code from importing helper services directly. | Export/API constraint test or lint rule plus application-client review. |
| Adapter/server/UI integration | In-memory execution is covered; no persistence-backed or request/server application client exists yet. | Construct actor-bound facades in adapter/server paths and prohibit repository access from UI paths. | Adapter authorization suite, concurrency tests, and browser/server deny flows. |
| Coverage completeness | Current tests prove representative admin, teacher, accountant, guardian, student, audit, and tenant cases, but not every method/action/actor decision. | Build an enumerated coverage table tied to public method inventory and fail review when a method lacks policy tests. | Complete method-to-action-to-test manifest. |

## Completion Flags

| Deliverable | Status | Current Evidence |
| --- | --- | --- |
| Immutable actor-bound application construction | [x] Complete | `SchoolApplication.forActor(...)` creates actor-bound module facades. |
| Authorization invoked by every current public facade method | [x] Complete | Eight public modules enforce command/query calls and current integration journeys pass. |
| Distinct permissions for current sensitive reads | [x] Complete | Grade reads and query projections have separate authorization actions. |
| Assignment-scoped teacher reads and mutations on current scoped APIs | [x] Complete | Policy checks class, subject, or session assignment and denies sensitive school projections. |
| Caller-free audit attribution on interactive facade inputs | [x] Complete | Public wrappers omit attribution inputs and persistence tests assert actor attribution. |
| Current staff, guardian, and student access-state enforcement | [x] Complete | Policy reloads current records; revocation integration coverage is present. |
| Stable non-disclosing missing/foreign resource denial surface | [x] Complete for current facade | Public wrappers deny missing and foreign selected identifiers with the same typed forbidden error. |
| Additional guardian/student/teacher UI projection APIs | [ ] Pending | Only current linked-student, finance, and attendance reads are in scope. |
| Allowlisted system-job permissions | [ ] Pending | System actors remain denied until job surfaces are defined. |
| Exhaustive method-to-role authorization manifest | [ ] Pending | Current tests are targeted regression journeys, not a full matrix. |
| Adapter/server/browser boundary verification | [ ] Pending | No persistence-backed or request/UI client exists in this package yet. |

## Target Runtime Construction

Long-lived infrastructure remains independent of actor state:

```ts
const application = new SchoolApplication({
  repositories,
  atomicExecution,
  authorizationPolicy,
})
```

Each request, server action, or job creates a lightweight actor-bound facade:

```ts
const actor = createStaffActorMetadata({
  subjectId: session.subjectId,
  staffMemberId: membership.staffMemberId,
  schoolId: membership.schoolId,
  roles: membership.roles,
  requestId,
  sessionId: session.id,
  authenticatedAt: session.authenticatedAt,
})

const app = application.forActor(actor)
await app.scheduling.recordAttendance(input)
```

Requirements:

- Repository adapters and connection pools are shared and actor-agnostic.
- A `SchoolHeadlessApp` instance is bound to exactly one immutable actor.
- No `setActor(...)`, global mutable current actor, or generic authorization
  proxy is permitted.
- System jobs must use explicit `SystemActorMetadata` and policy rules.

## Authorization Responsibilities

| Layer | Responsibility |
| --- | --- |
| Authentication/session boundary | Verify identity and construct trusted actor metadata for the selected school. |
| `SchoolApplication.forActor(...)` | Bind actor and policy to the eight public facade modules. |
| Public command/query modules | Resolve relevant resource context and invoke authorization policy before data access or mutation. |
| Authorization policy implementation | Evaluate roles, tenant isolation, staff assignments, guardian links, self-access, and system permissions. |
| Persistence adapters | Enforce transactions and optional tenant safeguards as defense in depth. |
| UI | Hide unavailable actions for usability, but never serve as the authorization boundary. |

## Initial Access Model

The policy implementation should use current repository state for
resource-level checks. Role membership alone is insufficient.

| Actor | Initial Capabilities |
| --- | --- |
| Admin or principal staff | Manage selected school setup and view school-wide operational data. |
| Coordinator staff | Manage authorized academic configuration and scheduling within the selected school. |
| Teacher staff | View assigned classes/sessions; record attendance, grades, and curriculum progress only for assignments. |
| Accountant staff | View and mutate fee/payment data in the selected school. |
| Guardian | View only linked students and permitted published/attendance/finance communications. |
| Student | View only their own permitted timetable, attendance, and published reports. |
| System | Execute only specifically allowed job operations with an audit reason. |

The detailed permission matrix may refine these decisions, but broader access
must not be assumed implicitly.

### Current Capability Matrix

| Current Actions | Allowed Staff Roles | Self-Service Actors |
| --- | --- | --- |
| `setup.register_school` | Trusted admin or principal bootstrap actor | None |
| `setup.manage`, `setup.assign_staff` | Active admin or principal | None |
| `academics.manage_curriculum`, `scheduling.manage`, `assessments.manage_configuration`, `assessments.publish_report_card`, `students.*`, `communications.manage` | Active admin, principal, or coordinator | None |
| `academics.record_progress`, `academics.read_progress`, `attendance.record`, `attendance.read`, `assessments.record_grade`, `assessments.read_grades` | Active admin, principal, or coordinator; active teacher only for an assigned resource | Guardian/student only for linked/self `attendance.read` |
| `finance.manage` | Active admin, principal, or accountant | None |
| `finance.read` | Active admin, principal, or accountant | Active guardian for a linked student; active student for self |
| `queries.read_workspace`, `queries.read_class_directory` | Active admin, principal, or coordinator | None |
| `queries.read_class_curriculum`, `queries.read_timetable`, `queries.read_attendance` | Active admin, principal, or coordinator; active teacher only for an assigned resource | None |
| `queries.read_overview`, `queries.read_student_directory`, `queries.read_guardian_students_admin` | Active admin or principal | None |
| `queries.read_guardian_self` | None | Active guardian for self only |

Current revocation behavior is request-evaluated: the repository-backed policy
loads staff, guardian, or student state on every permission check. An inactive
staff member, guardian without access, or inactive student therefore loses
access for subsequent calls even when an actor-bound facade was already
constructed. Persistent session termination remains a server-boundary concern.

## Service Enforcement Matrix

Every public method listed below must call `AuthorizationPolicy` before its
primary read/write operation. Where a resource id is supplied, the service
must resolve and validate tenant ownership before or as part of policy
evaluation without disclosing inaccessible records.

### `setup`

| Methods | Action | Required Context |
| --- | --- | --- |
| `registerSchool` | `setup.register_school` | Bootstrap selected `schoolId` for a trusted admin/principal actor |
| `createAcademicYear`, `createAcademicPeriod`, `createGradeLevel`, `createClassGroup`, `registerStaffMember` | `setup.manage` | `schoolId`, plus year/class context when applicable |
| `assignStaffToClass`, `assignStaffToClassSubject`, `assignStaffToSession`, `assignStaffToGroupedSession` | `setup.assign_staff` | Resolved school and assignment target |

Initial allowed actors: admin/principal; coordinator only where explicitly
granted by policy.

### `academics`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createSubject`, `createSubjectMatter`, `offerSubjectToClass`, `assignMatterToClassSubject` | `academics.manage_curriculum` | Resolved school/class/subject |
| `recordSessionProgress` | `academics.record_progress` | Session, class subject, class group, assigned teacher |
| `listMatterProgress` | `academics.read_progress` | Matter/class context |

For interactive progress recording, remove `recordedByStaffId` from client
input and derive it from a permitted staff actor.

### `scheduling`

| Methods | Action | Required Context |
| --- | --- | --- |
| `definePeriod`, `createGroupedSession`, `createSchedule`, `generateSessions`, `createSession` | `scheduling.manage` | Selected school, year, class/session target |

Session integrity validation should be completed at the same time as policy
wiring so policy receives trustworthy class/subject relationships.

### Attendance Calls Under `scheduling`

| Methods | Action | Required Context |
| --- | --- | --- |
| `recordAttendance`, `recordSessionAttendance` | `attendance.record` | Resolved session/class and current assignment |
| `listSessionAttendance`, `buildAttendanceSummary` | `attendance.read` | Session or student scope |

Teacher access must be checked against current class or session assignments.

### `assessments`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createGradeScale`, `createReportCardDefinition`, `createReportCardDefinitionSection` | `assessments.manage_configuration` | School/year/grade-level context |
| `createAssessment`, `completeAssessment`, `recordGrade`, `recordGradeCompliance` | `assessments.record_grade` | Class subject/assessment and teacher assignment |
| `generateReportCardResult`, `publishReportCardResult` | `assessments.publish_report_card` | Student/class/period context |
| `listClassSubjectGradesForPeriod` | `assessments.read_grades` | Assigned or school-wide privileged staff |

For interactive grading, derive staff attribution from the staff actor when
such attribution is stored.

### `students`

| Methods | Action | Required Context |
| --- | --- | --- |
| `registerStudent`, `enrollStudent` | `students.manage_enrollment` | Selected school/class group |
| `registerGuardian`, `linkGuardianToStudent` | `students.manage_guardians` | Selected school/student context |

Guardian self-service reads must not permit the browser to choose another
guardian identity.

### `finance`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createFee`, `assignFeeToStudent`, `recordPayment`, `reversePayment` | `finance.manage` | Resolved school/student/fee context |
| `buildFeeSummary` | `finance.read` | Authorized student context |

For interactive payment mutation, remove `recordedById` from client input and
derive it from a permitted staff actor.

### `communications`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createAnnouncement`, `addTarget`, `publishAnnouncement`, `recordDelivery` | `communications.manage` | Announcement school and target context |

Automated delivery recording may later use a permitted system actor.

### `queries`

| Methods | Action | Required Context |
| --- | --- | --- |
| `getWorkspaceContext` | `queries.read_workspace` | Selected school/class context; excludes assignment-only teacher access |
| `getSchoolOverview` | `queries.read_overview` | School-wide finance/report/communications summary |
| `listStudents` | `queries.read_student_directory` | Student, fee, guardian, and report-card projection |
| `listClassGroups` | `queries.read_class_directory` | School-wide operational class projection |
| `listClassGroupCourses` | `queries.read_class_curriculum` | Selected assigned class context where required |
| `listClassGroupTimetable` | `queries.read_timetable` | Selected assigned class context where required |
| `getAttendanceSessionReview` | `queries.read_attendance` | Selected assigned session context where required |
| `listMyStudents()` | `queries.read_guardian_self` | Bound guardian actor only |
| `listStudentsForGuardian(guardianId)` | `queries.read_guardian_students_admin` for staff; guardian access resolves only its own id | Privileged staff or bound guardian self context |

Add student-facing self queries rather than allowing student or guardian UIs
to pass arbitrary domain-owner identifiers.

## Implementation Phases

### Phase A: Bind Actor And Policy

Implemented:

- `AuthorizationPolicy` and `actor` dependencies are part of actor-bound
  facade construction.
- `SchoolApplication` is the long-lived dependency container.
- `SchoolApplication.forActor(actor)` constructs an actor-bound
  `SchoolHeadlessApp`.
- In-memory workflow tests use explicit administrative and role-specific
  actors.

Exit criteria:

- Public module instances cannot be constructed for interactive use without an
  actor and authorization policy.
- Existing permitted integration journeys pass through an allow-policy test
  implementation.

### Phase B: Protect Commands And Derive Audit Identity

Implemented for the selected facade scope:

- Public command methods invoke policy checks with resolved tenant/resource
  context.
- Attendance operations are enforced through `scheduling`.
- Attendance, curriculum progress, grades, finance payments, and
  communications store attribution derived from the bound actor instead of
  caller-provided attribution.
- Cross-resource validation protects enrollment, fee assignment, scheduled
  class subjects, assessment class subjects, and communication
  targets/recipients.
- Interactive command input types do not expose caller-supplied audit actor
  fields.

Exit criteria:

- All selected-scope commands are protected.
- Tests prove forbidden actors cannot write.
- Stored audit identity cannot be spoofed through UI input.

### Phase C: Protect Queries And Add Self-Service APIs

Implemented for existing query APIs:

- All current `SchoolQueryService` entry points invoke policy checks.
- `listMyStudents()` supplies guardian-scoped student access.
- School-wide views are limited through the policy; guardian/student finance
  and attendance reads are self/link scoped.
- Current query projections and grade reads use data-sensitive actions rather
  than a shared broad school-read action.

Still pending:

- Additional student/guardian detail projections for UI screens that do not
  yet exist in the facade.
- Teacher-scoped list/timetable/attendance review queries that filter by
  assignment without accepting unbounded school scope.

Exit criteria:

- Guardian and student reads cannot request another person's data.
- Staff query permissions respect school and assignment context.
- UI requires no direct repository or adapter access.

### Phase D: Adapter And UI Verification

- Apply authorization tests to adapter-backed facade construction.
- Test concurrent request-scoped facade construction with different actors
  sharing the same repositories.
- Add browser flows for allowed and forbidden role interactions.
- Confirm system jobs are explicitly authorized and auditable.

Exit criteria:

- Authorization behaves consistently in in-memory and persisted execution.
- Shared adapters do not carry mutable actor state.
- UI denial states are driven by stable authorization error codes.

## Testing Strategy

Add tests incrementally with each protected module:

- Actor primitive tests: validation, immutability, audit identity resolution,
  and authorization errors.
- Policy tests: role allow/deny decisions and current-assignment or
  guardian-link decisions.
- Service integration tests: prohibited writes do not modify repositories.
- Tenant tests: actors cannot act on objects in another school.
- Audit tests: server-derived actor attribution is stored on protected
  mutations.
- Concurrency tests: two actor-bound facades sharing adapters cannot cross
  authorization context.
- Browser tests: hidden buttons are not the protection mechanism; forbidden
  server calls still fail.

## Remaining Work Plan

### Gate 1: Freeze The Permission Contract

1. [x] Create an authoritative method-to-action matrix for every current method exposed by
   `setup`, `academics`, `scheduling`, `assessments`, `students`, `finance`,
   `communications`, and `queries`.
2. [x] Replace coarse or semantically incorrect current actions with distinct read/write
   actions, starting with grade reads and composite school/query projections.
3. [x] Decide the exact current role capabilities for principal, coordinator,
   accountant, teacher, guardian, student, and system actors; remove optional
   wording from the access model.
4. [ ] Extend the matrix and role tests for every future projection or system
   operation as each API is selected for delivery.
5. [x] Define required context for every current action, including assessment, fee,
   announcement target/recipient, class/session, and self-service ownership
   references.

Exit criteria:

- No public operation relies on a generic action whose permitted data is
  broader than the operation's screen or workflow.
- The method-to-action table is exhaustive and reviewed as a contract.

### Gate 2: Harden The Enforcement Boundary

1. [x] Remove audit attribution fields from interactive public inputs and create
   explicit trusted system/import variants only if required.
2. [x] Validate active staff membership and roles, guardian access status, and
   student self-service eligibility during policy evaluation or trusted actor
   construction with a documented revocation model.
3. [x] Implement tenant-safe resource resolution and typed denial behavior so
   unauthorized foreign and missing resource identifiers are not
   distinguishable.
4. [ ] Constrain the supported public import boundary to
   `SchoolApplication.forActor(...)`; internal repository-backed helper
   services must not become an unauthorised application entry point.

Exit criteria:

- Interactive TypeScript callers cannot pass actor attribution.
- Disabled or revoked actors cannot use a previously constructable facade.
- Unauthorized calls have stable non-disclosing failure behavior.

### Gate 3: Complete Actor-Specific Public APIs

1. [ ] Add assignment-filtered teacher query projections for the classes,
   timetable, attendance, curriculum, and grade reads required by UI.
2. [ ] Add guardian/student self-service projections only for selected features:
   timetable/attendance, published reports, balances, and communications as
   required by release scope.
3. [x] Administrative-scope current `listStudentsForGuardian(guardianId)` and
   retain `listMyStudents()` for bound guardian self access.
4. [ ] Replace or explicitly administrative-scope any additional method that
   accepts another user's owner identifier.
5. [ ] Define explicit allowlisted system-job operations before any scheduler,
   import, delivery worker, or overdue-payment job is wired.

Exit criteria:

- Each supported actor can complete permitted journeys without using
  overprivileged school-wide reads.
- No self-service API accepts an arbitrary owner identifier.
- System behavior is least-privilege and auditable.

### Gate 4: Prove Coverage Exhaustively

1. [ ] Add table-driven policy tests for each method/action and each actor type,
   including principal, coordinator, disabled staff, disabled guardian,
   inactive student, and system actors.
2. [ ] Add service integration deny tests proving repositories remain unchanged
   after forbidden writes for every command family.
3. [ ] Add tests for sensitive read non-disclosure, cross-school access,
   current-assignment removal, role removal, and audit field absence/derivation.
4. [ ] Add concurrency tests with two actor-bound facades sharing the same
   repository instances.

Exit criteria:

- A maintained manifest maps every public operation to at least one permitted
  and one prohibited integration case, plus tenant/context cases where
  applicable.
- Mutation denial, read denial, audit attribution, and concurrency behaviors
  are all executable regression tests.

### Gate 5: Apply The Boundary Outside In-Memory Core

1. Supply `AuthorizationPolicy` and `SchoolApplication.forActor(...)` in the
   persistence-backed server/application-client path.
2. Run the same authorization journeys against real adapters and their
   transaction mechanism.
3. Add browser-level role journeys that call the server with forbidden
   actions even when UI controls are hidden.
4. Review application/UI imports to prove no repository or internal service
   bypasses the actor-bound facade.

Exit criteria:

- In-memory, adapter-backed, and browser/server execution all pass the
  authorization manifest.
- Repository adapters remain actor-agnostic while every request is
  actor-bound at the application boundary.

## Immediate Next Work

1. Produce the exhaustive method/action/role matrix and split coarse query
   and grade-read permissions.
2. Expand the authorization integration suite from representative journeys to
   the full public-operation manifest.
3. Add actor-scoped teacher/guardian/student query APIs required by selected
   UI workflows.
4. Constrain public imports to the actor-bound facade and define any required
   system-job allowlists.
5. Carry the manifest into persistence-backed and browser/server
   verification.

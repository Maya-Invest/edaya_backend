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

The following foundation now exists in `packages/core/src/auth/`:

- `ActorMetadata`, with distinct staff, guardian, student, and system actor
  variants.
- Runtime actor constructors that validate trusted metadata and freeze the
  resulting execution context.
- `ActorAssuranceLevel` for sensitive-operation requirements.
- `resolveAuditActorId(...)` for consistent server-side attribution.
- `AuthorizationError` and stable error codes.
- `AuthorizationPolicy` and an initial typed action/resource request
  contract.

The primitives are public API. Existing service methods are not yet protected;
authorization is complete only after this plan is applied to all public
modules.

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
await app.attendance.recordAttendance(input)
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
| `SchoolApplication.forActor(...)` | Bind actor and policy to the nine public facade modules. |
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

## Service Enforcement Matrix

Every public method listed below must call `AuthorizationPolicy` before its
primary read/write operation. Where a resource id is supplied, the service
must resolve and validate tenant ownership before or as part of policy
evaluation without disclosing inaccessible records.

### `setup`

| Methods | Action | Required Context |
| --- | --- | --- |
| `registerSchool`, `createAcademicYear`, `createAcademicPeriod`, `createGradeLevel`, `createClassGroup`, `registerStaffMember` | `setup.manage` | `schoolId`, plus year/class context when applicable |
| `assignStaffToClass`, `assignStaffToClassSubject`, `assignStaffToSession`, `assignStaffToGroupedSession` | `setup.assign_staff` | Resolved school and assignment target |

Initial allowed actors: admin/principal; coordinator only where explicitly
granted by policy.

### `academics`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createSubject`, `createSubjectMatter`, `offerSubjectToClass`, `assignMatterToClassSubject` | `academics.manage_curriculum` | Resolved school/class/subject |
| `recordSessionProgress` | `academics.record_progress` | Session, class subject, class group, assigned teacher |
| `listMatterProgress` | `queries.read_school` or a narrowed academic read action | Matter/class context |

For interactive progress recording, remove `recordedByStaffId` from client
input and derive it from a permitted staff actor.

### `scheduling`

| Methods | Action | Required Context |
| --- | --- | --- |
| `definePeriod`, `createGroupedSession`, `createSchedule`, `generateSessions`, `createSession` | `scheduling.manage` | Selected school, year, class/session target |

Session integrity validation should be completed at the same time as policy
wiring so policy receives trustworthy class/subject relationships.

### `attendance`

| Methods | Action | Required Context |
| --- | --- | --- |
| `recordAttendance`, `recordSessionAttendance` | `attendance.record` | Resolved session/class and current assignment |
| `listSessionAttendance`, `buildAttendanceSummary` | Read action scoped to permitted class/student | Session or student scope |

Teacher access must be checked against current class or session assignments.

### `assessments`

| Methods | Action | Required Context |
| --- | --- | --- |
| `createGradeScale`, `createReportCardDefinition`, `createReportCardDefinitionSection` | `assessments.manage_configuration` | School/year/grade-level context |
| `createAssessment`, `completeAssessment`, `recordGrade`, `recordGradeCompliance` | `assessments.record_grade` | Class subject/assessment and teacher assignment |
| `generateReportCardResult`, `publishReportCardResult` | `assessments.publish_report_card` | Student/class/period context |
| `listClassSubjectGradesForPeriod` | Read action scoped to class subject | Assigned or school-wide privileged staff |

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
| `buildFeeSummary` | Finance read action or guardian/student self-read action | Authorized student context |

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
| `getWorkspaceContext`, `getSchoolOverview`, `listStudents`, `listClassGroups`, `listClassGroupCourses`, `listClassGroupTimetable`, `getAttendanceSessionReview` | `queries.read_school` or narrowed class scope | Selected school/class context |
| Replace guardian-facing `listStudentsForGuardian(guardianId)` with `listMyStudents()` | `queries.read_guardian_self` | Bound guardian actor only |

Add student-facing self queries rather than allowing student or guardian UIs
to pass arbitrary domain-owner identifiers.

## Implementation Phases

### Phase A: Bind Actor And Policy

- Add `AuthorizationPolicy` and `actor` dependencies to the application
  construction contract.
- Introduce `SchoolApplication` as the long-lived dependency container.
- Have `SchoolApplication.forActor(actor)` construct an actor-bound
  `SchoolHeadlessApp`.
- Update in-memory test construction to supply explicit staff/system actors.

Exit criteria:

- Public module instances cannot be constructed for interactive use without an
  actor and authorization policy.
- Existing permitted integration journeys pass through an allow-policy test
  implementation.

### Phase B: Protect Commands And Derive Audit Identity

- Add authorization calls to command methods module by module.
- Begin with highest-risk mutation surfaces: `finance`, `assessments`,
  `attendance`, `academics`, and `setup`.
- Remove interactive audit identity inputs and derive attribution from the
  bound actor.
- Preserve explicit trusted attribution only for system/import pathways where
  required.

Exit criteria:

- All selected-scope commands are protected.
- Tests prove forbidden actors cannot write.
- Stored audit identity cannot be spoofed through UI input.

### Phase C: Protect Queries And Add Self-Service APIs

- Protect all `SchoolQueryService` methods.
- Add actor-scoped guardian and student queries.
- Restrict school-wide views to approved staff roles.
- Complete query contracts required for UI detail screens.

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

## Immediate Next Work

1. Implement `SchoolApplication.forActor(...)` and bind actor/policy to
   `SchoolHeadlessApp` and its public modules.
2. Implement an initial repository-backed policy for staff role, school,
   assignment, and guardian-link checks.
3. Protect finance and attendance commands first, because they expose clear
   UI-facing risk and resource rules.
4. Migrate remaining commands, then query projections and self-service
   methods.
5. Only after protected contracts stabilize, complete interactive UI command
   implementation and adapter-backed authorization tests.

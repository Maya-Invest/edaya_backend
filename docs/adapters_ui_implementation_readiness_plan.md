# Adapters And UI Implementation Readiness Plan

## Objective

Build persistence adapters and the first user interface in parallel while
preserving `SchoolHeadlessApp` as the single application boundary. The UI
must use public command modules and `SchoolQueryService` projections; it must
not query repositories or storage adapters directly. Every interactive
operation must execute through an actor-bound facade created from trusted
authentication metadata for that request.

This plan starts from the completed in-memory integration baseline documented
in `docs/integration_test_readiness.md`.

## Current Baseline

The core currently provides:

- A nine-module `SchoolHeadlessApp` facade: `setup`, `academics`,
  `scheduling`, `attendance`, `assessments`, `students`, `finance`,
  `communications`, and `queries`.
- In-memory integration journeys covering school setup, curriculum progress,
  attendance and report cards, finance and communications, assignments, and
  cross-domain query projections.
- An `AtomicExecutionPort` protecting curriculum-progress writes, payment
  recording, and payment reversal.
- A reusable base repository behavior contract for adapter testing.
- Public authorization primitives: actor metadata variants, typed
  authorization errors, audit identity resolution, and the authorization
  policy contract. Service-call enforcement remains the next core gate and is
  detailed in `docs/service_call_authorization_implementation_plan.md`.

The current screen query support is sufficient to start a shell, dashboard,
student directory, class directory, and read-only timetable. Interactive
attendance, setup, academic progress, finance, report-card, and communication
screens require the contract stabilization work below.

## Delivery Principles

- Keep entities domain-focused; add fields only for validated business needs,
  not presentation convenience.
- Keep repository ports persistence-focused; expose cross-domain screen reads
  through `SchoolQueryService` or dedicated query-oriented ports.
- Keep command and query paths separated. UI writes through domain modules and
  reads through `queries`.
- Create a new actor-bound `SchoolHeadlessApp` execution scope per
  authenticated request, server action, or background job. Do not mutate an
  actor on a shared facade singleton.
- Enforce business authorization inside public facade modules through explicit
  policy calls. Do not rely on UI route guards or a global service proxy.
- Derive audit attribution from trusted actor metadata rather than accepting
  staff/user identifiers from interactive UI command inputs.
- Implement adapter transactions through `AtomicExecutionPort`; do not
  simulate atomicity in services.
- Build UI against public types and an in-memory/dev app implementation first,
  then run the same workflows against persistence adapters.
- Do not expand deferred domains until their screen and workflow scope is
  selected explicitly.

## Phase 0: Contract Stabilization Gate

This phase is shared work and should be completed before workflow-heavy UI
screens or production adapters depend on the current contracts.

### Service Integrity Fixes

- Update attendance review queries to accept a selected `classGroupId`.
- Validate that the requested class group belongs to the selected school and
  academic year.
- Update session creation to validate the supplied `schoolId` against the
  class group.
- Validate that an optional `classSubjectId` belongs to the session class
  group.
- Decide whether class sessions must be linkable to `GroupedSession`; add the
  command input only if grouped-session UI is in first release scope.

### Actor-Bound Authorization Contract

Introduce authentication context as an application-layer prerequisite before
interactive UI command contracts are finalized:

- Define immutable `ActorMetadata` with the authenticated actor identity,
  tenant/school context, actor kind, and roles or claims needed by policy
  evaluation.
- Define an explicit system-actor form for imports, migrations, scheduled
  work, and other non-interactive operations.
- Introduce a long-lived dependency container, for example
  `SchoolApplication`, whose `forActor(actor)` method constructs a lightweight
  request-scoped `SchoolHeadlessApp`.
- Bind `ActorMetadata` and an authorization-policy port to each public module
  facade created for that request.
- Add policy checks to commands and queries, including resource-level checks
  such as class/session assignment, linked-student access, finance privileges,
  and tenant/school isolation.
- Remove user-supplied audit identity fields such as `createdBy`,
  `recordedById`, and `recordedByStaffId` from interactive command contracts,
  or isolate them behind explicitly trusted system-only workflows.
- Add typed authorization failures suitable for UI handling without leaking
  inaccessible-resource details.

The intended object lifetime is:

| Object | Lifetime |
| --- | --- |
| Database connection/client and repository adapters | Application/process lifetime |
| Authorization policy implementation | Application/process lifetime |
| `SchoolApplication` dependency container | Application/process lifetime |
| `ActorMetadata` | Authenticated request, server action, or background job |
| Actor-bound `SchoolHeadlessApp` and public modules | Same execution scope as the actor |

Authorization must be performed by use-case-aware policies invoked from public
modules. A global proxy is not a substitute: it does not have enough domain
context to decide whether a teacher may record attendance for a particular
class, a guardian may see a particular student, or an accountant may mutate a
particular school's ledger.

### UI Query Contracts

Add typed query projections required by initial screens:

- Reference data query: active academic year, periods, grade levels, class
  groups, staff, subjects, and available grade scales.
- Student detail query: enrollment, guardians, attendance summary, current
  balance, and published report cards.
- Curriculum progress query: class subject, assigned matters, latest
  completion state, and progress history.
- Finance ledger query: student fee assignments, payment history, status, and
  summary.
- Report-card detail query: definition, computed sections, attendance summary,
  and publication state.
- Communications query: announcements, targets, and deliveries.

### Query Operational Shape

- Add filter and pagination inputs to directory/list projections before large
  persisted datasets are used.
- Define stable sorting for student, class, announcement, and finance lists.
- Replace UI-visible reliance on raw `Error` messages with typed application
  error codes or discriminated failures.
- Provide actor-scoped query variants for self-service screens, such as
  guardian-linked students or a student's own reports, rather than accepting
  unrestricted subject identifiers from the UI.

### Exit Criteria

- Each authenticated application interaction constructs or receives an
  immutable actor-bound facade execution scope.
- Authorization policies protect all selected public commands and query
  projections, with tests for permitted and forbidden actors.
- Interactive write commands derive audit actor identity from
  `ActorMetadata`.
- Attendance review correctly loads any selected class rather than implicitly
  choosing the first class.
- Invalid school/class/subject session combinations are rejected by services.
- UI forms and detail pages can obtain required data only from the public
  facade.
- Query inputs include a documented paging/filter strategy.
- Integration tests cover the new validation and query behavior.

## Parallel Track A: Persistence Adapters

Start once Phase 0 input/output contracts are stable. Adapter work can run in
parallel with UI implementation after that gate.

### A1. Adapter Foundation

- Select the storage technology and define adapter package/module layout.
- Implement storage mapping for selected-scope entities only.
- Keep long-lived repository adapters independent from request actor state;
  actor context belongs to the application execution scope, not shared
  storage clients.
- Implement `AtomicExecutionPort` with the storage engine's native transaction
  mechanism.
- Create migrations/schema constraints for identity, required relationships,
  and unique invariants such as one progress snapshot per matter and session.

### A2. Command Repository Coverage

Implement adapters required by command workflows in this order:

1. School setup, staff, class groups, academic calendar, and subjects.
2. Students, guardians, enrollment, sessions, and attendance.
3. Assessments, grades, report-card definitions, and results.
4. Fees, student fees, and payments.
5. Announcements, targets, and deliveries.

### A3. Query Performance Support

- Profile the current composed queries against persisted datasets.
- Avoid N+1 behavior in dashboard and student-directory screens through
  efficient adapter queries or dedicated query/read-model ports.
- Implement indexed access for school/year/class/student/time-range lookup
  paths used by screen projections.
- Where supported, add tenant-level persistence safeguards as defense in depth;
  these do not replace application authorization policies.

### A4. Adapter Verification

- Run the reusable base repository contract against each repository adapter.
- Run the public workflow integration journeys against adapter-backed
  `SchoolHeadlessApp`.
- Run failure tests for progress recording, payment recording, and payment
  reversal inside real transactions.
- Run authorization tests using actor-bound application instances for each
  supported role and self-service actor type.

### Adapter Exit Criteria

- Adapter-backed app construction supplies every facade dependency including
  `AtomicExecutionPort` and authorization-policy dependencies.
- Adapters remain actor-agnostic and can be safely reused across concurrent
  request-scoped facade instances.
- The selected public workflow suite passes unchanged against real storage.
- Multi-write workflow failures leave no partial state.
- Screen projection queries meet an agreed latency target on seeded datasets.

## Parallel Track B: UI Implementation

### B1. App Shell And Read-Only Screens

Can start immediately using in-memory/dev data and existing projections:

- Application shell, navigation, routing, and global loading/error states.
- School overview dashboard.
- Student directory.
- Class directory.
- Read-only class timetable.

These screens must access the core through an application client abstraction
that can later switch from in-memory execution to adapter-backed server calls.
For authenticated server execution, that client must resolve actor metadata
from the trusted session and create an actor-bound facade for the request.

### B2. Setup And Master Data Screens

Start after the Phase 0 reference-data query is available:

- School and academic-calendar setup.
- Grade-level and class-group setup.
- Staff registration and assignments.
- Subject catalog, class offering, and subject-matter assignment.
- Grade-scale and report-card-definition setup.

### B3. Daily Operational Screens

Start after integrity fixes and detail queries are complete:

- Attendance entry and session review by selected class and date.
- Curriculum progress entry per session.
- Fee ledger, payment recording, and reversal confirmation.
- Announcement drafting, targeting, publishing, and delivery monitoring.

### B4. Academic Reporting Screens

Start after report-card detail queries are complete:

- Assessment and grade entry.
- Draft report-card generation and review.
- Report-card publication and student/guardian-facing display.

### UI Verification

- Add UI component tests for form validation, empty/loading/error states, and
  status transitions.
- Add browser-level flows for the five core journeys already represented in
  integration tests.
- Add role-based browser flows verifying that inaccessible commands and data
  are denied by the application layer, independent of hidden UI controls.
- Ensure UI error handling is keyed on application error codes, not error text.

### UI Exit Criteria

- No UI component or route imports repository ports or adapter
  implementations.
- No UI command supplies audit actor identity; it is derived from authenticated
  actor metadata on the server.
- First-release screens use only public facade/application-client contracts.
- Browser journeys pass against in-memory/dev mode and adapter-backed mode.
- Deferred-domain navigation and actions are absent or clearly unavailable.

## Work Sequencing

| Sequence | Shared/Core | Adapter Track | UI Track |
| --- | --- | --- | --- |
| 1 | Phase 0 actor/auth contract, integrity fixes, and error/query contract design | Storage selection and skeleton only | Shell and static navigation |
| 2 | Actor policy tests plus reference and detail query projections | Core setup/student adapters and transactions | Dashboard, student list, class list, timetable |
| 3 | Paging/filter/sort contracts stabilized | Assessment/finance/messaging adapters | Setup and daily operational screens |
| 4 | Adapter-backed and authorization workflow verification | Query optimization and real rollback tests | Reporting screens and role-based browser journeys |
| 5 | Release review | Seed/migration/recovery validation | UX hardening and accessibility review |

## Initial UI Release Scope

Included:

- Dashboard and school workspace context.
- Student and class directories.
- Timetable and attendance.
- Curriculum progress.
- Grade entry and report-card publication.
- Student fee ledger and payments.
- Announcements and delivery tracking.
- Setup required to operate the included workflows.

Deferred:

- Activities and student activity enrollment.
- Behavior incidents and disciplinary actions.
- Attachments.
- Resource assignment.
- Exam-specific assessment workflows.
- Automatic delivery-recipient resolution.
- Enrollment lifecycle transitions such as promotion, retention, withdrawal,
  and transfer.

## Immediate Implementation Backlog

1. Introduce a request-scoped `SchoolApplication.forActor(...)` construction
   pattern using the implemented actor and authorization-policy primitives.
2. Apply authorization policies across the nine public modules and derive
   interactive audit fields from actor context.
3. Fix attendance class selection and session association validation.
4. Add reference-data and detail query contracts to `SchoolQueryService`.
5. Add typed application errors and list paging/filter conventions.
6. Begin UI shell, dashboard, student directory, class directory, and
   read-only timetable against the in-memory/dev application client.
7. Scaffold selected persistence adapters and implement native
   `AtomicExecutionPort`.
8. Run integration and authorization journeys against adapter-backed
   actor-bound construction.

## Readiness Decision

UI and adapter implementation may proceed in parallel now with one boundary:
interactive workflow screens and finalized persistence query implementations
must wait for Phase 0 contract stabilization, including actor-bound
authorization. Read-only shell and directory work can start immediately, but
any server data access must be designed to use trusted actor-bound facade
instances rather than shared mutable authorization state.

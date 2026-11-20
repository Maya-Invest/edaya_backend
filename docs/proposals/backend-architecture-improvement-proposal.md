# Backend architecture improvement proposal

> **Historical proposal — authorization guidance superseded.** The accepted design is the [clean implementation plan](../sprints/authorization-clean-implementation.md), with [one policy implementation](../../package/domain-authorization/src/README.md) and [one coordinated cutover](../architecture/authorization-cutover.md). The strategy port, parallel migration paths, operation dispatch and authorization caches discussed below are not implementation targets. Follow `@edaya/service` → `@edaya/authorization` → `@edaya/core`.

## Status

- **State:** historical; authorization work superseded by the clean implementation plan
- **Architecture style:** modular monolith with ports and adapters
- **Primary objective:** reduce coupling and make business capabilities independently evolvable
- **First implementation workstream:** authorization and school-service decoupling
- **Detailed authorization plan:** [authorization-service-decoupling-plan.md](./authorization-service-decoupling-plan.md)

## Executive summary

The backend has useful domain packages, runtime composition, repository ports, and strong authorization coverage. Its main architectural limitation is that package separation does not yet provide implementation independence.

The most visible example is authorization: school services import authorization actors, grants, operation definitions, policy resolvers, cache hooks, and persistence contracts. Similar coupling appears in the broad `BaseSchoolService`, the global `SchoolRepositories` interface, generic entity writes, and entity hooks that coordinate unrelated side effects.

The recommended direction is to keep the backend as a modular monolith while establishing these boundaries:

1. school use cases depend on service-owned ports, never on implementation packages;
2. modules are organized around business capabilities rather than technical folders;
3. each workflow receives only the repositories and capabilities it requires;
4. important mutations use explicit commands rather than generic CRUD;
5. committed domain events drive cache invalidation, projections, notifications, and other side effects;
6. reads use dedicated query ports and authorization-aware scopes;
7. `@edaya/core` contains school-domain concepts, not RBAC or integration implementation models; and
8. repository checks enforce the dependency graph.

Authorization decoupling is the first workstream because it creates the application context, access port, domain-event boundary, repository segregation, and composition patterns that the other improvements can reuse.

## Current assessment

### Strengths to preserve

- The repository already follows a recognizable ports-and-adapters structure.
- API runtime composition is separate from core domain packages.
- The authorization model covers staff, teachers, guardians, students, and trusted system execution.
- Tenant checks exist at multiple layers.
- Managed-entity and workflow tests provide a base for incremental migration.
- Repository verification already contains import-boundary checks.
- The application is still a monolith, so transactions and refactoring do not require distributed coordination.

### Structural issues

#### 1. Authorization is an implementation dependency of school services

- `83` of `176` files in `package/domain-service/src` import `@edaya/authorization`.
- Service code contains `164` operation-gate calls and `113` resource-policy calls.
- Use cases inspect actor kinds and elevated grants.
- Service repositories expose authorization repositories.
- Service hooks invalidate authorization caches and synchronize RBAC projections.

This prevents changing authorization strategy without changing service code and tests.

#### 2. `BaseSchoolService` acts as a service locator

Workflows receive a broad object containing all repositories and several runtime capabilities. Dependencies are convenient but implicit, and a workflow can access unrelated parts of the application.

Consequences:

- large test fixtures and mocks;
- unclear module ownership;
- increased change propagation;
- difficult extraction of a single business capability; and
- accidental coupling through shared mutable runtime concerns.

#### 3. Repository interfaces are too broad

`SchoolRepositories` extends the complete entity repository catalog and currently includes authorization and platform concerns. Workflows depend on the whole repository graph rather than use-case-specific ports.

#### 4. Generic entity writes expose too much behavior

`ManagedEntityService` offers generic save, batch-save, delete, and batch-delete paths for simple reference data and complex stateful entities alike.

This distributes business invariants between:

- entity schemas;
- entity configs;
- business gates;
- hooks; and
- explicit workflows.

The result is more than one valid-looking path for important state changes.

#### 5. Side effects are coupled to entity hooks

Authorization cache invalidation and permission synchronization are invoked from service entity hooks. Similar growth would make notifications, search projections, audit records, and integrations compete for the same lifecycle callbacks.

Because hook timing is tied to persistence execution, it is also easy to perform an external side effect before the surrounding transaction has committed.

#### 6. Read authorization does not scale cleanly

List and count behavior performs post-load resource checks, with an authorization-specific elevated/system shortcut for counts. This is correct only for the current strategy and becomes expensive for large result sets.

#### 7. `@edaya/core` contains strategy-specific models

The core package owns RBAC permissions, permission scope grammar, scope grants, staff permission assignments, and `StaffAssignment.permissions`. It also contains several application integration ports.

This makes the core package a shared dependency container rather than a strictly school-domain model.

#### 8. Persistence and internal imports cross logical boundaries

The Postgres adaptor depends on core, service, and authorization together. Some package internals import their own public package barrel, increasing circular-initialization and extraction risk.

## Architectural principles

### AP-1: Preserve the modular monolith

Do not introduce network services for these changes. Establish package and module boundaries first. A module may be extracted later only when operational reasons justify it.

### AP-2: Ports are owned by their consumers

If a school use case needs authorization, event publishing, storage, or a query, the service/application layer defines the required interface. Runtime or policy packages implement it.

### AP-3: Business vocabulary is stable; strategy vocabulary is replaceable

Stable service vocabulary includes:

- `students.read`;
- `attendance.record`;
- `school.owner.transfer`;
- student, class-group, lesson-session, and assessment resource references; and
- business events such as `StaffAssignmentChanged`.

Replaceable implementation vocabulary includes:

- permissions and roles;
- effective grants;
- assurance levels;
- portal capability rules;
- scope-path encodings;
- cache keys; and
- external policy-engine documents.

### AP-4: Enforce invariants at explicit use-case boundaries

Authentication middleware may establish identity, but it does not replace service-level authorization. Complex mutations must have one explicit command path that owns authorization, validation, transaction, persistence, and event publication.

### AP-5: Publish facts after commit

Domain events describe committed business facts. Subscribers decide how those facts affect caches, projections, notifications, audits, or external systems.

### AP-6: Optimize reads through typed scopes

Authorization must not return SQL or adaptor-specific filters. It may return typed resource constraints that query adaptors translate into efficient persistence queries.

### AP-7: Boundaries are executable

Package rules, action catalogs, event ownership, and dependency direction must be enforced by tests or repository verification, not documentation alone.

## Target architecture

```text
apps/api
  authentication + request composition + HTTP mapping
       |
       +-------------------------------+
       v                               v
@edaya/service                  @edaya/authorization
  business modules               selected policy implementation
  use cases                      actor/grant/scope resolution
  service-owned ports            authorization administration
  actions/resources              cache/projection subscribers
       |                               |
       +---------------+---------------+
                       v
                 @edaya/core
                 school domain model

adaptors
  school Postgres | authorization Postgres | storage | notifications
```

Compile-time rules:

```text
@edaya/service -> @edaya/core
@edaya/authorization -> @edaya/service/access + @edaya/core
school persistence -> school ports
authorization persistence -> authorization ports
apps/api -> service + selected authorization implementation + adaptors
```

`@edaya/authorization` may import the service-owned access contract, but it must not import school workflow implementations.

## Proposed service organization

```text
package/domain-service/src/
  application/
    access/                       AccessControlPort, principal, actions, resources
    events/                       DomainEventPublisher, event envelope
    transactions/                 Transaction boundary
    errors/                       Stable application errors

  modules/
    students/
      commands/
      queries/
      entity-configs/
      ports.ts
      events.ts
    scheduling/
    academics/
    assessments/
    finance/
    communications/
    school-setup/

  shared/
    pagination/
    simple-entity-read-service/
```

The move to feature modules should happen after authorization imports are removed. Moving coupled files first would create noise without changing the dependency structure.

## Improvement workstreams

### Workstream A — Decouple authorization from school services

**Outcome:** authorization strategy can be replaced at API composition without editing school use cases.

Key changes:

- introduce `ExecutionPrincipal`, `SchoolAction`, `SchoolResourceRef`, and request-bound `AccessControlPort` under `@edaya/service/access`;
- bind private `ActorMetadata` inside an authorization adapter;
- separate semantic action IDs from RBAC and portal policy mappings;
- replace `operationModule` and `AuthorizationPolicy.check*` calls with action/resource assertions;
- remove authorization actors, grants, errors, cache hooks, and repository contracts from service production code;
- move system-context construction into trusted runtime composition;
- extract authorization administration from `SchoolService`; and
- enforce zero service imports from `@edaya/authorization`.

The detailed PR-by-PR checklist is maintained in [authorization-service-decoupling-plan.md](./authorization-service-decoupling-plan.md).

### Workstream B — Narrow workflow dependencies

**Outcome:** workflows depend only on their required ports.

Replace broad `BaseSchoolService` access with per-module or per-use-case dependency interfaces:

```ts
interface EnrollStudentDependencies {
  students: StudentRepository
  enrollments: EnrollmentRepository
  classGroups: ClassGroupRepository
  transaction: TransactionPort
  events: DomainEventPublisher
}
```

Actions:

- inventory repository usage per workflow;
- create module dependency interfaces;
- construct dependencies in one service composition factory;
- prevent workflows from importing `SchoolRepositories` directly;
- retain a transitional adapter backed by current repositories; and
- replace large test contexts with focused fixtures.

### Workstream C — Introduce transactional domain events

**Outcome:** secondary reactions are independently replaceable and occur after commit.

Initial events:

- `StaffAssignmentChanged`;
- `StaffMemberChanged`;
- `GuardianStudentLinkChanged`;
- `EnrollmentChanged`;
- `TeacherAssignmentChanged`;
- `AnnouncementPublished`;
- `AttendanceRecorded`; and
- `ReportCardPublished`.

Actions:

- define a service-owned event envelope and publisher port;
- collect events during a transaction;
- dispatch in-process handlers only after successful commit;
- add an outbox for retryable external effects;
- make handlers idempotent;
- migrate authorization invalidation and permission projections first;
- migrate notification triggers after transaction behavior is proven; and
- test commit, rollback, duplicate, retry, and ordering behavior.

Domain events must describe business facts. Avoid events such as `InvalidateAuthCache` or `SendNovuNotification`.

### Workstream D — Separate simple entities from explicit commands

**Outcome:** important state changes have one enforceable business path.

Retain generic CRUD for stable reference/catalog entities. Introduce explicit commands for:

- enrolling, moving, and withdrawing students;
- recording and justifying attendance;
- assigning teachers and staff responsibilities;
- publishing announcements;
- recording, cancelling, or reversing payments;
- creating and publishing assessments/report cards;
- changing academic-year lifecycle state; and
- transferring school ownership.

Each command owns:

1. access assertion;
2. input validation;
3. entity loading;
4. invariant enforcement;
5. transaction execution;
6. persistence; and
7. event publication.

Generic entity routes for command-owned mutations should be deprecated and then removed.

### Workstream E — Establish query services and authorization-aware scopes

**Outcome:** secure pagination, search, list, and count operations without loading every candidate row.

Actions:

- define dedicated query ports for application screens and reports;
- introduce a typed `ResourceQueryScope` returned by the access port;
- translate query scopes into Postgres filters inside the adaptor;
- keep tenant constraints mandatory even for unrestricted authorization scopes;
- add pagination and count contract tests;
- remove authorization-specific elevated shortcuts from `ManagedEntityService`; and
- add benchmarks before enabling optimized query paths.

The authorization result must contain domain resource constraints, never SQL fragments.

### Workstream F — Make core and persistence strategy-neutral

**Outcome:** school-domain packages and persistence can evolve independently from RBAC.

Move out of `@edaya/core`:

- `Permission` and its catalog;
- permission scope and `scopeIds` grammar;
- `ScopeGrant`;
- `StaffPermissionAssignment`; and
- `StaffAssignment.permissions`.

Review application-facing gateway ports in core and move them to their consumer modules when they are not required by domain behavior.

Within the Postgres adaptor:

- separate `school/` and `authorization/` modules;
- expose `createSchoolRepositories(db)` and `createAuthorizationRepositories(db)`;
- avoid authorization types in school repository signatures; and
- defer physical package splitting until module boundaries are stable.

### Workstream G — Normalize errors and runtime composition

**Outcome:** use cases expose a stable failure contract independent of Hono, Postgres, or the policy engine.

Introduce application-owned errors:

- `AccessDeniedError`;
- `ResourceNotFoundError`;
- `ConflictError`;
- `ValidationError`;
- `BusinessRuleViolationError`; and
- `DependencyUnavailableError`.

Actions:

- translate authorization errors at the access-adapter boundary;
- translate persistence errors at repository boundaries;
- map application errors to HTTP in one API component;
- preserve current concealed-resource behavior;
- construct interactive and system execution contexts in runtime composition; and
- remove HTTP/runtime imports from application modules.

### Workstream H — Feature modules and boundary governance

**Outcome:** business capabilities have explicit ownership and automated dependency rules.

Actions:

- move service code into feature modules after Workstream A is complete;
- remove package self-imports from package internals;
- allow authorization to import only `@edaya/service/access`;
- prohibit feature modules from importing another module's internal files;
- expose intentional public module APIs;
- update architecture documentation and package maps; and
- add repository checks for every final dependency rule.

## Integrated delivery roadmap

### Phase 0 — Baseline and governance

Includes authorization plan PR 0.

- characterize staff, portal, system, and tenant behavior;
- record import and enforcement counts;
- add non-regression boundary checks;
- document current API error semantics; and
- identify complex entities that must move away from generic writes.

**Exit gate:** current behavior and dependency debt are measurable.

### Phase 1 — Application contracts and compatibility adapters

Includes authorization plan PRs 1–3 and the foundation of Workstream G.

- add application access, principal, action, resource, and error contracts;
- add the current authorization implementation behind a legacy adapter;
- add request-context composition;
- split action IDs from policy rules; and
- introduce focused access test adapters.

**Exit gate:** current authorization decisions can be reached through service-owned contracts.

### Phase 2 — Remove service-to-authorization dependencies

Includes authorization plan PRs 4–5.

- migrate managed entities by business slice;
- migrate workflows and queries;
- remove grant and actor-strategy inspection;
- move system access to composition; and
- begin focused workflow dependency interfaces when touching each slice.

**Exit gate:** school workflows compile and test without authorization implementation imports.

### Phase 3 — Transactional events and repository segregation

Includes authorization plan PR 6 and Workstreams B–C.

- introduce commit-aware domain events;
- move authorization invalidation and projections to subscribers;
- remove authorization repositories from `SchoolRepositories`;
- create narrower module dependencies; and
- separate school and authorization Postgres modules.

**Exit gate:** policy caches, projections, and authorization persistence can change without service changes.

### Phase 4 — Extract authorization administration and clean core

Includes authorization plan PRs 7–8 and Workstream F.

- extract authorization administration;
- move RBAC models out of core;
- remove permission state from school assignments;
- remove compatibility APIs and package dependencies; and
- enforce the final authorization boundary.

**Exit gate:** a second access-control implementation can replace the current one at composition.

### Phase 5 — Command-oriented modules

Includes Workstreams D and H.

- reorganize migrated code by business capability;
- introduce explicit commands for complex state changes;
- deprecate unsafe generic mutation routes;
- replace `BaseSchoolService` with focused module composition; and
- enforce module-public APIs.

**Exit gate:** complex mutations have one explicit, tested path and modules expose deliberate boundaries.

### Phase 6 — Query models and performance

Includes Workstream E.

- introduce dedicated read/query ports;
- push typed authorization scopes into repositories;
- optimize pagination, counts, and aggregates;
- benchmark key screens and reports; and
- remove remaining load-all authorization paths.

**Exit gate:** large authorized queries are secure and scale without strategy-specific service shortcuts.

## Verification strategy

| Boundary | Verification |
|---|---|
| Service access declarations | Recording-access-adapter tests assert exact actions and targets |
| Authorization behavior | Staff, teacher, guardian, student, and system policy matrices |
| Tenant safety | Cross-school tests at service, repository, and HTTP levels |
| Command invariants | Unit and integration tests through the explicit command only |
| Transactional events | Commit, rollback, duplicate, retry, and idempotency tests |
| Query scoping | Authorized IDs, pagination, count, and aggregate contract tests |
| Persistence separation | School repositories compile without authorization contracts |
| Error mapping | Stable application-error to HTTP response tests |
| Package graph | Repository boundary verification and zero forbidden imports |

Full program gate:

```sh
bun repo verify --full
bun run test:integration
bun run test:integration:seed
```

## Success measures

- `package/domain-service/src` has zero imports from `@edaya/authorization`.
- Authorization can be replaced by an allow-all test adapter without changing use cases.
- No workflow directly depends on the full `SchoolRepositories` graph.
- Authorization cache and grant-projection code is absent from school service modules.
- Complex domain mutations are unavailable through generic entity save/delete routes.
- List and count queries do not load every candidate row for authorization.
- `@edaya/core` contains no RBAC persistence model.
- Package internals do not import their own public barrels.
- Domain events are dispatched after commit and external effects are retryable.
- Repository verification prevents the former dependency graph from returning.

## Risks and controls

| Risk | Control |
|---|---|
| Too many architectural changes in one PR | Follow the phased plan and preserve compatibility adapters |
| Authorization behavior drift | Delegate through the existing engine until each actor/resource matrix passes |
| Portal regressions hidden by staff tests | Require teacher, guardian, and student cases for each migrated slice |
| Domain events introduce duplicate effects | Idempotency keys, outbox records, and duplicate-delivery tests |
| Feature reorganization creates noisy diffs | Reorganize only after dependencies are removed; avoid logic changes during moves |
| Explicit commands duplicate generic code | Extract small application helpers, not a second generic mutation framework |
| Query scopes leak persistence details | Use typed business constraints and translate them inside adaptors |
| Narrow ports create excessive constructors | Use module-level composition factories while keeping interfaces focused |
| Core cleanup breaks public DTOs | Maintain API compatibility types during internal model migration |

## Non-goals

- Splitting the backend into networked microservices.
- Replacing the current authorization behavior during the decoupling phase.
- Rewriting all repositories or entities at once.
- Moving authorization exclusively into HTTP middleware.
- Introducing event-driven eventual consistency for operations that require the current database transaction.
- Building optimized read models before access and transaction contracts are stable.

## Program definition of done

- [ ] Authorization is a replaceable adapter selected by runtime composition.
- [ ] School use cases depend only on application and domain contracts.
- [ ] Business modules have focused repository and capability dependencies.
- [ ] Complex writes use explicit commands and committed domain events.
- [ ] Secondary effects are transaction-safe, idempotent, and independently replaceable.
- [ ] Query services support authorization-aware pagination and counts.
- [ ] Core and school persistence are free of RBAC implementation details.
- [ ] Application errors are independent of HTTP, Postgres, and authorization engines.
- [ ] The modular dependency graph is enforced automatically.
- [ ] Full unit, integration, seed, portal, system, and tenant suites pass.


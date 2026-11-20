# Authorization system improvement proposal

> **Historical proposal — authorization guidance superseded.** The accepted design is the [clean implementation plan](../sprints/authorization-clean-implementation.md), with [one policy implementation](../../package/domain-authorization/src/README.md) and [one coordinated cutover](../architecture/authorization-cutover.md). The strategy port, parallel migration paths, operation dispatch and authorization caches discussed below are not implementation targets. Follow `@edaya/service` → `@edaya/authorization` → `@edaya/core`.

## Status

- **State:** historical; authorization work superseded by the clean implementation plan
- **Date:** 2026-07-13
- **Scope:** authentication actor assembly, authorization operations, resource policies, tenant isolation, public entity APIs, grant persistence, caches, service accounts, and trusted workloads
- **Risk classification:** critical authorization enforcement gaps requiring immediate containment
- **Migration style:** containment first, followed by an incremental replacement behind a service-owned access-control port
- **Related architecture proposal:** [Backend architecture improvement proposal](../reference/backend-architecture-improvement-proposal.md)
- **Related decoupling plan:** [Authorization and school-service decoupling plan](../reference/authorization-service-decoupling-plan.md)

## Decision requested

Approve two parallel tracks:

1. an immediate containment release for the confirmed data-access, scope, tenant-count, cache-revocation, and scope-rendering defects; and
2. a multi-phase replacement of the current operation/resource composition model with action-based, authorization-aware queries and mandatory tenant-scoped persistence.

The current model should not be repaired solely by adding more entity-specific policy callbacks. Its main weakness is structural: authorization is not part of query planning, and the framework does not prove that every public operation reaches an appropriate resource policy.

## Executive summary

The authorization system has a strong conceptual foundation:

- typed staff, teacher, guardian, student, service, and system actors;
- centralized business operations;
- scoped staff grants;
- relationship-native teacher, guardian, and student scopes;
- assurance and human-only restrictions;
- a repository-backed resource-policy layer; and
- extensive operation-matrix tests.

The enforcement composition is nevertheless unsafe for production school data.

The central failure pattern is:

```text
actor may enter module
        |
        v
generic repository query
        |
        v
post-query tenant check
        |
        v
optional/no-op resource check
```

This pattern turns intended decisions such as “a guardian may read communications addressed to their family” or “a teacher may read incidents for assigned classes” into school-wide generic entity access. It also allows class- or student-scoped staff grants to authorize targetless global operations when no later resource check restores the missing scope.

The most important confirmed findings are:

1. guardians, students, and teachers can reach sensitive same-school rows outside their relationship scope through generic entity endpoints;
2. scoped staff permissions fail open when an operation provides no resource context;
3. tenant filtering occurs after repository reads and pagination, while elevated counts can execute without a tenant predicate;
4. guardian and student relationship changes invalidate the wrong cache;
5. scope rendering performs cross-tenant label lookup for caller-supplied IDs;
6. service-account lifecycle operations are not atomic and lack database constraints; and
7. system actors have an unconditional tenant-wide authorization bypass.

The recommended target is a modular-monolith authorization architecture with:

- one semantic action catalog;
- a request-bound `AccessControlPort` owned by the service layer;
- typed collection scopes that repositories translate into SQL predicates;
- mandatory tenant-bound repositories plus PostgreSQL row-level security;
- task-specific public queries and commands rather than generic CRUD;
- normalized grant scope rows with referential integrity;
- versioned, distributed authorization caching; and
- scoped workload principals instead of system bypass.

With three backend engineers and QA/security support, the target is approximately a 10–14 week parallel program. Sequential delivery is more likely to require 14–18 weeks.

## Assessment scope and method

The assessment traced the authorization path across:

- `package/domain-authorization`;
- `package/domain-service`;
- `package/domain-core` permission and authorization persistence models;
- `package/adaptor-postgres` stores and schema;
- REST entity route generation;
- GraphQL entity schema generation;
- session and service-account actor resolution;
- cache lifecycle hooks and runtime cache stores; and
- representative unit and operation-matrix tests.

The findings are based on statically confirmed code paths. Production data was not accessed, and no production exploit was attempted.

Focused verification command:

```bash
bun test \
  apps/api/tests/lib/test-auth-cache-invalidation-port.test.ts \
  package/domain-authorization/tests/unit-auth/operations/operation-matrices.test.ts \
  package/domain-service/tests/unit/auth/lifecycle/invalidation-registry.test.ts
```

Result: **216 passed, 0 failed**. This is itself significant: the existing tests validate individual layers but do not validate the complete public-route-to-query-to-resource path. One cache test also asserts the incorrect guardian/student cache behavior.

## Current architecture

### Intended enforcement pipeline

The [authorization package documentation](../../package/domain-authorization/src/README.md#enforcement-pipeline) defines four layers:

1. tenant;
2. operation;
3. resource policy; and
4. business gate.

The model distinguishes:

- staff permissions and path-based grant scopes;
- teaching and homeroom capabilities;
- guardian and student relationship capabilities;
- resource policies backed by repositories; and
- business invariants that are intentionally independent from authorization.

### Strengths to preserve

#### Typed actor context

[`ActorMetadata`](../../package/domain-authorization/src/model/actor.ts) cleanly separates interactive actor types from system actors and carries the school, request, session, subject, assurance, and actor-specific scope information required for decisions.

#### Explicit operation vocabulary

Operations provide stable business identifiers such as `communications.read`, `discipline.create`, and `scheduling.timetable.manage`. This is a useful seam and should evolve into the service-owned semantic action catalog rather than be discarded.

#### Assurance and service-account restrictions

The permission engine checks assurance independently from grants and supports human-only permissions. This separation should remain part of the policy implementation.

#### Relationship-native portal scopes

Teacher assignments, guardian links, and student enrollment are modeled as authorization inputs rather than forced into static role names. This is appropriate for a school domain.

#### Existing resource policies

Repository-backed policies already protect several sensitive aggregates, including students, finance rows, assessment results, attendance records, report-card results, and attachments. They provide reusable domain knowledge for the target policy implementation.

#### Assignment expiry for staff grants

Staff grant resolution calculates the earliest assignment expiry and uses it to bound the grants cache. The same principle should be applied consistently to every principal type.

## Findings and risk assessment

| Priority | Finding | Primary impact |
|---|---|---|
| Critical | Generic entity APIs plus no-op resource policies | Same-school horizontal data exposure |
| Critical | Scoped grants authorize targetless operations | Privilege escalation from limited scope to school-wide action |
| Critical | Tenant predicates are not mandatory before queries/counts | Cross-tenant aggregate exposure, denial of service, incorrect pagination |
| High | Guardian/student changes invalidate the wrong cache | Revoked relationship access remains active |
| High | Scope renderer does not tenant-check IDs | Cross-tenant student and resource label disclosure |
| High | Service-account operations are non-atomic and weakly constrained | Partial privileged state, races, and difficult revocation/audit |
| High | System actor unconditionally bypasses policy | Maximum blast radius for internal route or job defects |
| Medium | Tests validate layers rather than public enforcement paths | Security regressions can pass the suite |

### F-1 — Generic public entity endpoints bypass relationship scope

**Severity:** Critical

The API builds list, one, count, get, save, delete, batch-save, and batch-delete routes for every registered core entity:

- [REST entity route generation](../../apps/api/src/lib/school-api/routes/entities.ts)
- [GraphQL entity generation](../../apps/api/src/lib/graphql/routes/entities.ts)
- [Core entity registry](../../apps/api/src/lib/school-api/registry.ts)

The service layer has `noopReadAccess`, `noopSaveAccess`, and `noopDeleteAccess` callbacks that return without enforcing a resource relationship:

- [Entity authorization helpers](../../package/domain-service/src/services/entities/entity-config/authorization.ts)

There are 32 entity configurations using `noopReadAccess`. Not all are equally sensitive, but the framework has no invariant preventing a public portal or scoped staff operation from being combined with one.

#### Communications exposure

`communications.read` is global and allows guardians and students:

- [Communications operations](../../package/domain-authorization/src/operations/communications.ts)

Guardian and student capability assertions accept a missing target:

- [Guardian capability assertion](../../package/domain-authorization/src/capabilities/assert-guardian-capability.ts)
- [Student capability assertion](../../package/domain-authorization/src/capabilities/assert-student-capability.ts)

The following entity reads use that targetless operation and a no-op resource check:

- [Announcement config](../../package/domain-service/src/services/entities/config/messaging/announcement.ts)
- [Announcement target config](../../package/domain-service/src/services/entities/config/messaging/announcement-target.ts)
- [Message delivery config](../../package/domain-service/src/services/entities/config/messaging/message-delivery.ts)

Impact:

- guardians and students can read all announcements in their school, including draft and archived content;
- announcement targets reveal audiences and target identifiers; and
- message deliveries have no subject or recipient ownership check and expose title, body, provider ID, status, and failure information when a row is addressed by a known ID or filter.

Relevant data models:

- [Announcement](../../package/domain-core/src/domain/messaging/announcement.ts)
- [Announcement target](../../package/domain-core/src/domain/messaging/announcement-target.ts)
- [Message delivery](../../package/domain-core/src/domain/messaging/message-delivery.ts)

#### Discipline exposure

A teacher with any qualifying assignment can pass the targetless `discipline.read` module check:

- [Discipline operations](../../package/domain-authorization/src/operations/discipline.ts)
- [Module-mode teacher handling](../../package/domain-authorization/src/operations/assert-operation.ts)

Incident and involvement reads then use no resource policy:

- [Incident config](../../package/domain-service/src/services/entities/config/students/incident.ts)
- [Student incident involvement config](../../package/domain-service/src/services/entities/config/students/student-incident-involvement.ts)

This permits an assigned teacher to retrieve incidents outside their assigned classes, including descriptions, resolution notes, involved student IDs, victim/witness/subject roles, and free-form notes.

Relevant data models:

- [Incident](../../package/domain-core/src/domain/students/incident.ts)
- [Student incident involvement](../../package/domain-core/src/domain/students/student-incident-involvement.ts)

#### Additional audit targets

The same pattern exists in parts of:

- calendar events;
- schedules and attendance aggregates;
- report-card definitions and sections;
- activities and activity enrollments;
- academic subjects and curriculum configuration;
- resources and resource assignments; and
- staff permission assignments.

Every no-op policy must be classified as one of:

1. genuinely public within the tenant;
2. staff-administration only;
3. relationship-scoped; or
4. internal-only and removed from public generic APIs.

### F-2 — Scoped permissions fail open without resource context

**Severity:** Critical

[`scopeGrantCovers`](../../package/domain-authorization/src/grants/scope-grant-covers.ts) returns `true` when a request does not supply `scopeType`. This means scope is only enforced if a caller remembers to construct a scoped request.

At the operation layer:

- `buildStaffScope` returns no scope when `scopeFrom` or context is absent;
- module mode skips required-context enforcement;
- global operations skip required-context enforcement; and
- operation validation does not require context merely because an actor rule has a target.

Relevant implementations:

- [Operation assertion](../../package/domain-authorization/src/operations/assert-operation.ts)
- [Operation definition validation](../../package/domain-authorization/src/operations/define-operation.ts)
- [Operation module gate](../../package/domain-authorization/src/gates/operation-module.ts)

Confirmed escalation paths include:

#### Calendar management

`TIMETABLE_UPDATE` is class-group scoped, but `scheduling.calendar.manage` is global and supplies no class-group scope. Calendar-event write authorization is no-op.

- [Permission scope catalog](../../package/domain-core/src/domain/permissions/permission-scopes.ts)
- [Scheduling operations](../../package/domain-authorization/src/operations/scheduling.ts)
- [Calendar-event config](../../package/domain-service/src/services/entities/config/scheduling/calendar-event.ts)

A staff principal granted timetable update for one class can therefore manage school-wide or other-class events.

#### Academic program updates

`ACADEMIC_PROGRAM_UPDATE` is class-group scoped, while `academics.program.update` is global. Several academic reference-data writes do not restore a class/resource scope.

- [Academic operations](../../package/domain-authorization/src/operations/academics.ts)
- [Grade-level subject config](../../package/domain-service/src/services/entities/config/academics/grade-level-subject.ts)

#### Overdue-fee aggregate

`QUERY_OVERDUE_FEES_READ` is student-scoped, but the operation is global and returns a school-wide count.

- [Query operations](../../package/domain-authorization/src/operations/queries.ts)
- [School aggregate query](../../package/domain-service/src/services/school-service.ts)

#### Communications

`QUERY_COMMUNICATIONS_READ` is student-scoped for staff, but the targetless communications operation reaches generic school communication rows.

### F-3 — Tenant isolation occurs after repository access

**Severity:** Critical

`ManagedEntityService` validates a supplied school filter but does not inject the actor's school into the query. The repository runs first; tenant and resource checks happen afterward.

- [Managed entity read and count flow](../../package/domain-service/src/services/entities/managed-entity-service.ts)
- [Tenant resolver helpers](../../package/domain-service/src/services/entities/entity-config/tenant.ts)

The generic Postgres store filters only on caller-supplied options and applies limit/offset before any domain tenant check:

- [Postgres store](../../package/adaptor-postgres/src/postgres-store.ts)

Consequences:

- foreign-tenant rows can cause a valid tenant request to fail;
- pagination can omit authorized rows because foreign rows consumed the limit;
- non-elevated counts load all rows and authorize them in memory;
- repository calls outside `ManagedEntityService` have no tenant guard; and
- elevated and system counts use raw `COUNT(*)`, which returns cross-tenant totals when the caller omits a tenant filter.

No PostgreSQL row-level security policy was found in the schema or migrations.

### F-4 — Portal relationship revocation targets the wrong cache

**Severity:** High

Production session actor assembly resolves guardians, students, and teachers through `resolveCachedActorScope`:

- [Session actor resolution](../../apps/api/src/http/dependencies/session-actor.ts)

The cache invalidation port routes guardian and student scope events to the effective-grants cache instead. Teacher invalidation correctly targets the actor-scope cache:

- [API cache invalidation port](../../apps/api/src/lib/authorization/auth-cache-invalidation-port.ts)

The actor-scope cache has a default five-minute TTL:

- [Cached actor scope resolution](../../apps/api/src/lib/authorization/scope-cache/resolve-cached.ts)

The current test reproduces the same incorrect cache selection for guardian and student events:

- [Cache invalidation test](../../apps/api/tests/lib/test-auth-cache-invalidation-port.test.ts)

Additional weaknesses:

- post-save hooks invalidate only the new entity, not the previous entity, leaving the old principal stale after reassignment;
- caches are local in-memory maps, so invalidation is not propagated between processes or isolates; and
- teacher assignment expiry does not bound the actor-scope cache entry.

Relevant files:

- [Authorization cache hooks](../../package/domain-service/src/integration/auth-cache-hooks.ts)
- [Actor-scope cache store](../../apps/api/src/lib/authorization/scope-cache/store.ts)
- [Teacher scope resolution](../../package/domain-authorization/src/resolution/resolve-teacher-scope.ts)

### F-5 — Scope rendering is a cross-tenant metadata IDOR

**Severity:** High

The scope-render endpoint permits any interactive actor and performs raw repository lookups for caller-supplied class, subject, grade, activity, and student IDs. It does not require access-control administration permission, tenant-check the resolved entity, or verify a relationship to it.

- [Scope rendering route and handler](../../apps/api/src/routes/authorization.routes.ts)

A known foreign ID can disclose student full names and resource labels from another school.

### F-6 — Service-account lifecycle lacks atomicity and database invariants

**Severity:** High

Service-account creation persists the staff row, permission assignments, and API key sequentially. Grant replacement deletes current grants before recreating them. Key revocation and rotation update multiple records in loops.

- [Service-account provisioning](../../package/domain-authorization/src/service-accounts/provision.ts)

Failure between writes can leave:

- a service staff row with no key;
- partial permission assignments;
- no grants after a failed replacement;
- partially revoked keys; or
- old keys revoked without a new key created.

The single elevated service-account rule is a check-then-write race without a database uniqueness constraint.

The persistence schema lacks foreign keys, composite tenant constraints, key-hash uniqueness, and grant validity checks:

- [Postgres schema](../../package/adaptor-postgres/src/postgres-schema.ts)
- [Staff permission assignment migration](../../package/adaptor-postgres/drizzle/0036_staff_permission_assignments.sql)
- [Service account migration](../../package/adaptor-postgres/drizzle/0014_service_accounts.sql)

The public schema also accepts caller-chosen API keys with a minimum length of one, despite the domain comment describing this as a development/seeding feature:

- [Service-account API schemas](../../apps/api/src/lib/service-accounts/schemas.ts)

`lastUsedAt` exists but is not updated by API-key authentication.

### F-7 — System actors have unconditional authorization bypass

**Severity:** High

`assertOperation` immediately succeeds for system actors, and resource policies also short-circuit them:

- [System operation bypass](../../package/domain-authorization/src/operations/assert-operation.ts)
- [System actor model](../../package/domain-authorization/src/model/actor.ts)

Current callers such as the notification webhook and invitation flow perform meaningful upstream checks, but once a system actor is constructed it has every action in the selected school.

Examples:

- [Notification webhook](../../apps/api/src/routes/notification-delivery-webhook.routes.ts)
- [Invitation route](../../apps/api/src/routes/invitation.routes.ts)
- [Cron runner](../../package/domain-service/src/capabilities/scheduling-jobs/cron-job-runner.ts)

The `reason` field is useful audit context but is not an authority boundary. Future internal-route or background-job mistakes inherit the maximum possible tenant blast radius.

## Root causes

### RC-1 — Authorization is a sequence of optional callbacks

Operation checks and resource checks are configured independently. The framework cannot prove that a scoped actor path has a matching resource policy.

### RC-2 — Collection authorization is modeled as post-load assertion

The policy layer answers “are all these rows allowed?” after retrieval. It does not answer “which rows may this principal query?” before pagination and count.

### RC-3 — Tenant identity is validated but not structurally injected

Repositories accept unscoped operations, and callers must remember to supply `schoolId`. Domain post-checks are compensating controls rather than a hard persistence boundary.

### RC-4 — Multiple authorization vocabularies can diverge

Staff permissions, portal capabilities, operation targets, grant scopes, and resource policies each express part of the same business decision. Correctness depends on every mapping remaining aligned.

### RC-5 — Generic CRUD is broader than the business use cases

The public API exposes data-shaped operations, while the authorization rules are relationship- and workflow-shaped. Sensitive aggregates therefore have multiple valid-looking access paths.

### RC-6 — Security invariants are documented but not executable

The documentation describes a fixed pipeline, but build-time validation and end-to-end contract tests do not reject no-op policies, targetless scoped grants, or unscoped database queries.

## Target architecture

### Architectural principles

#### AP-1 — Keep the modular monolith

Do not introduce a network authorization service. Use service-owned ports and runtime adapters inside the existing deployable application.

#### AP-2 — Stable business actions belong to the service

School use cases request semantic actions. Roles, permission grants, portal relationships, assurance, and cache state remain authorization implementation details.

#### AP-3 — Collection authorization is query planning

Authorization must produce typed resource constraints before SQL execution. Pagination and count must operate on the authorized query.

#### AP-4 — Tenant isolation is mandatory and independent

Tenant scoping must be present in repositories and the database even if the authorization policy also checks tenant identity.

#### AP-5 — Public APIs express use cases

Sensitive public reads and writes should use explicit query/command contracts and purpose-specific DTOs. Generic CRUD is limited to internal administration where justified.

#### AP-6 — Revocation has a measurable consistency guarantee

Authorization changes must have an explicit maximum propagation time across runtime instances.

#### AP-7 — Trusted workloads receive least privilege

Background jobs and webhooks use named workload principals with action allowlists and resource constraints.

### Target request flow

```text
HTTP/session/API key
        |
        v
ExecutionPrincipal + private authorization state
        |
        v
service use case requests semantic action
        |
        +-----------------------------+
        | command / resource          | collection
        v                             v
access.assert(action, resource)       access.scope(action, resourceType)
        |                             |
        v                             v
tenant-bound repository              typed constraints -> SQL predicates
        |                             |
        +---------------+-------------+
                        v
               PostgreSQL tenant policy
```

### TA-1 — One semantic action catalog

Replace the separate service-facing operation/capability vocabularies with actions such as:

```text
communications.announcement.read
communications.delivery.read
discipline.incident.read
calendar.event.manage
student.health.read
student.report-card.read
```

Each action definition declares:

- resource type;
- whether collection access is supported;
- required resource/context fields;
- minimum assurance;
- whether staff delegation is supported;
- whether service accounts may exercise it; and
- which workload principals may exercise it.

Portal relationships and staff grants become different policy inputs for the same action.

### TA-2 — Service-owned access-control port

Extend the access contract proposed by the existing decoupling plan:

```ts
export interface AccessControlPort {
  assert(requirement: AccessRequirement): Promise<void>

  scope<TResource extends SchoolResourceType>(
    action: SchoolAction,
    resourceType: TResource,
  ): Promise<AuthorizedResourceScope<TResource>>
}
```

`AuthorizedResourceScope` is a typed service-level constraint, not SQL. Examples include:

```ts
type StudentScope =
  | { kind: 'all-within-tenant' }
  | { kind: 'student-ids', ids: readonly string[] }
  | { kind: 'class-group-ids', ids: readonly string[] }
  | { kind: 'none' }

type CommunicationScope =
  | { kind: 'all-within-tenant' }
  | { kind: 'subject', subjectId: string }
  | { kind: 'guardian-audience', guardianId: string, studentIds: readonly string[], classGroupIds: readonly string[] }
  | { kind: 'student-audience', studentId: string, classGroupId?: string }
  | { kind: 'none' }
```

The Postgres query adapter translates these scopes into predicates and joins. Authorization remains persistence-agnostic while queries become authorization-aware.

### TA-3 — Mandatory tenant-bound repositories

Request composition binds repositories to the execution tenant:

```ts
const repositories = repositoryFactory.forTenant(principal.schoolId)
```

Tenant-owned repository interfaces do not accept or expose an unscoped tenant operation.

Database changes:

- add `school_id` to indirectly tenant-owned tables where practical;
- use composite foreign keys including `school_id`;
- add composite and partial uniqueness constraints;
- add grant validity and account-kind checks; and
- enable PostgreSQL row-level security as a backstop.

When using pooled connections, set the RLS tenant with `SET LOCAL` inside a transaction rather than connection-persistent `SET`.

### TA-4 — Authorization-aware collection queries

Each collection query follows:

1. resolve authorized scope;
2. translate scope into tenant-bound repository predicates;
3. apply business filter within that scope;
4. apply ordering, pagination, and count; and
5. return a purpose-specific DTO.

Examples:

- guardian announcements: published, unexpired, and targeted to all guardians, the guardian, a linked student, a linked class, or grade audience derived from a linked student;
- student announcements: published, unexpired, and targeted to the student or their current class/grade;
- message delivery: `subject_id = principal.subjectId` unless an administrative action explicitly permits broader access;
- teacher incidents: incident class or lesson intersects an active teaching/homeroom assignment;
- staff calendar management: event scope falls within the staff grant scope; and
- report cards: result belongs to an authorized student and is published for portal actors.

### TA-5 — Task-specific public APIs

Replace sensitive generic entity routes with queries and commands such as:

```text
listMyInbox
listVisibleAnnouncements
markMyDeliveryRead
listClassIncidents
getStudentReportCard
listMyTimetable
manageClassCalendarEvent
```

Keep generic entities only for explicitly classified internal/admin reference data. Generic write access should default to disabled.

### TA-6 — Normalized grants and scope references

Replace opaque `scopeIds` strings with normalized records:

```text
principal_grants
  id
  school_id
  principal_type
  principal_id
  action
  academic_year_id
  valid_from
  valid_until
  source_type
  source_id
  revision

grant_scopes
  grant_id
  school_id
  resource_type
  resource_id
```

Tenant-wide grants are explicit. Scope references use foreign keys or validated polymorphic references, and academic-year references must belong to the same school.

Existing guardian, enrollment, teaching, and homeroom relationships may remain in their domain tables. The authorization implementation can query them directly or maintain a versioned relation projection through committed domain events.

### TA-7 — Versioned authorization state and caching

Add an authorization revision per principal, with an optional tenant-wide revision for broad policy changes.

On any grant or relationship mutation:

1. commit the domain change;
2. increment affected previous and new principal revisions in the same transaction or committed event flow;
3. publish an invalidation event after commit; and
4. make cache keys include the revision.

Every cache entry expires at the earliest of:

- configured TTL;
- grant expiry;
- teaching assignment expiry;
- guardian-link expiry, if supported;
- enrollment expiry/end; or
- session/key expiry.

Use a strongly consistent shared component or authoritative database revision for revocation. An eventually consistent cache alone is not sufficient for a strict revocation guarantee.

### TA-8 — Scoped workload principals

Replace unconditional `system` bypass with named workload principals:

```text
workload:notification-delivery-webhook
workload:invitation-accept
workload:cron:process-notifications
workload:cron:expire-invitations
```

Each workload has:

- fixed actions;
- explicit resource types;
- tenant constraints;
- caller/authentication provenance;
- auditable request and invocation IDs; and
- no ability to call arbitrary school operations.

### TA-9 — Authorization decision audit

Record security-relevant decisions with:

- principal/workload ID;
- school ID;
- action;
- resource type and non-sensitive identifier;
- allow/deny;
- reason code;
- policy and authorization revision;
- request ID; and
- decision latency.

Avoid logging message content, health details, incident descriptions, tokens, API keys, or other sensitive payload data.

## Delivery plan

### Phase 0 — Immediate containment

**Duration:** 2–4 days  
**Suggested owner:** API/domain-service maintainers with security review

- [ ] Disable generic guardian/student reads for announcements, announcement targets, and message deliveries.
- [ ] Add dedicated visible-announcement and own-delivery queries, or temporarily restrict these entities to staff administration.
- [ ] Add class/lesson relationship policies to incident and involvement reads.
- [ ] Restrict generic schedule, attendance aggregate, calendar, report-card definition, and activity reads until each is classified.
- [ ] Route guardian and student invalidation events to `invalidateActorScopeCacheForActor`.
- [ ] Invalidate both old and new principals after relationship reassignment.
- [ ] Bound teacher-scope cache entries by earliest assignment expiry.
- [ ] Require access-control administration permission for scope rendering.
- [ ] Tenant-check every entity resolved by scope rendering.
- [ ] Make scoped staff permissions fail closed when the required target is absent.
- [ ] Reject `global: true` operations backed by scoped permissions.
- [ ] Require/inject tenant predicates for every generic count, including elevated and system actors.
- [ ] Disable caller-selected service API keys outside an explicit seed/test configuration.
- [ ] Add regression tests for every containment change through both REST and GraphQL.

**Exit gate:** the confirmed communications, discipline, scoped-grant, tenant-count, cache, and scope-rendering paths are closed in public APIs.

### Phase 1 — Authorization contract and inventory

**Duration:** 1–2 weeks  
**Suggested owner:** domain-service and authorization maintainers

- [ ] Inventory every public REST and GraphQL field with action, actor types, resource, tenant field, relationship rule, and collection behavior.
- [ ] Classify all 32 no-op read configurations.
- [ ] Create the service-owned semantic action catalog.
- [ ] Add `AccessControlPort.scope()` and typed authorized resource scopes.
- [ ] Add a legacy adapter from semantic actions to current operations and resource policies.
- [ ] Add build-time validation rejecting:
  - [ ] public portal/scoped actions with no collection/resource policy;
  - [ ] scoped actions without required resource context;
  - [ ] global operations backed by scoped permissions;
  - [ ] public no-op policies without an explicit tenant-public classification; and
  - [ ] duplicate or unregistered action IDs.
- [ ] Add import-boundary checks required by the decoupling plan.

**Exit gate:** every public operation has a machine-validated authorization contract.

### Phase 2 — Tenant and query enforcement

**Duration:** 3–5 weeks  
**Suggested owner:** Postgres adaptor and domain-service query maintainers

- [ ] Introduce `repositoryFactory.forTenant(schoolId)`.
- [ ] Remove unscoped methods from tenant-owned repository interfaces.
- [ ] Add missing `school_id` columns to indirect tenant tables where appropriate.
- [ ] Add composite tenant foreign keys and indexes.
- [ ] Implement typed authorized scopes for collection repositories.
- [ ] Apply authorized predicates before pagination and count.
- [ ] Add RLS policies and pooled-connection-safe tenant context.
- [ ] Run RLS in test/report-only mode, then enforce it.
- [ ] Migrate sensitive domains first:
  1. student health and discipline;
  2. finance;
  3. communications;
  4. assessments and report cards;
  5. attendance and scheduling; and
  6. academics and reference data.

**Exit gate:** no tenant-owned collection or count executes without a tenant predicate and authorized scope.

### Phase 3 — Public API, action, and grant migration

**Duration:** 4–6 weeks  
**Suggested owner:** authorization, domain-service, and API maintainers

- [ ] Add normalized principal-grant and grant-scope tables.
- [ ] Backfill current `StaffPermissionAssignment.scopeIds` data.
- [ ] Validate every migrated resource reference against the same school.
- [ ] Dual-write old and new grant representations.
- [ ] Shadow-evaluate old and new decisions and log mismatches.
- [ ] Replace sensitive generic public entity routes with task-specific queries and commands.
- [ ] Cut over one domain at a time using feature flags.
- [ ] Migrate portal capability rules into the unified policy map.
- [ ] Remove legacy capability enums and scope-path bridges after decision parity and data migration.

**Exit gate:** all public authorization uses semantic actions and authorization-aware resource scopes; legacy grants are read-only or removed.

### Phase 4 — Revocation, workloads, service accounts, and audit

**Duration:** 2–3 weeks  
**Suggested owner:** authorization runtime and platform maintainers

- [ ] Introduce principal authorization revisions.
- [ ] Make cache invalidation cross-instance and version-aware.
- [ ] Define and test a maximum revocation propagation target, preferably under five seconds.
- [ ] Replace system actor bypass with workload principals and action allowlists.
- [ ] Wrap service-account create/update/revoke/rotate operations in transactions.
- [ ] Add database uniqueness, foreign-key, validity, and tenant constraints.
- [ ] Update `lastUsedAt` through a throttled audit path.
- [ ] Emit structured authorization decision logs and security metrics.

**Exit gate:** revocation, privileged automation, and service-account lifecycle meet documented consistency and audit guarantees.

### Phase 5 — Legacy removal and enforcement

**Duration:** 1–2 weeks  
**Suggested owner:** architecture maintainers

- [ ] Remove `@edaya/service` production imports from `@edaya/authorization` implementation details.
- [ ] Remove legacy operation-module and resource-policy composition from migrated domains.
- [ ] Remove public generic CRUD not explicitly approved by the entity inventory.
- [ ] Make action, tenant-query, RLS, and no-op-policy repository checks mandatory in CI.
- [ ] Archive superseded authorization plans and update architecture documentation.

**Exit gate:** the new boundaries are enforced by compilation, database policy, and CI—not developer convention.

## Migration safety strategy

### Compatibility adapter

Use the existing authorization implementation behind the new service-owned access port during migration. This avoids a flag-day rewrite while allowing each use case to move to semantic actions and typed scopes.

### Shadow decisions

For each migrated action:

1. enforce the current decision;
2. evaluate the new decision without affecting the response;
3. log allow/deny disagreement with actor and resource classification but no sensitive payload; and
4. resolve every disagreement before cutover.

The vulnerable generic-read behavior is not treated as intended behavior and should not block containment.

### Dual grant representation

Backfill and dual-write normalized grants. Compare effective decisions, not only serialized scope strings. Stop writing `scopeIds` only after all consumers have migrated.

### Domain-by-domain cutover

Prefer vertical slices in risk order. Each slice includes:

- REST and GraphQL contract;
- action mapping;
- collection scope;
- tenant-bound repository;
- single-resource decision;
- mutation authorization;
- cache/revision events;
- database constraints; and
- end-to-end denial tests.

### Rollback

Keep the legacy adapter available during the migration window. Roll back a domain to the legacy decision implementation behind the access port if necessary, but do not restore known-vulnerable generic portal routes or unscoped tenant queries.

## Testing strategy

### Public authorization contract matrix

Every public action must cover:

| Actor | Own/allowed | Related | Same-school unrelated | Cross-school | Expired/revoked |
|---|---:|---:|---:|---:|---:|
| Elevated staff | required | required | required | denied | denied where applicable |
| Restricted staff | required | required | denied outside grant | denied | denied |
| Teacher | self/assignment | required | denied | denied | denied |
| Guardian | self/linked student | required | denied | denied | denied |
| Student | self | current class where applicable | denied | denied | denied |
| Workload | allowlisted resource | as specified | denied | denied | denied |

### Collection tests

For list, one, and count:

- seed authorized and unauthorized rows in the same tenant;
- seed rows in a second tenant;
- verify only authorized rows contribute to pagination and count;
- verify query plans contain the tenant predicate;
- verify empty scope returns an empty result rather than querying all rows; and
- run the same contract against REST and GraphQL.

### Mutation tests

Verify authorization against both existing and proposed state. Reassignment tests must prove that the previous and new principal revisions are updated.

### Revocation tests

Run with two independent cache-store/runtime instances. Change a link, enrollment, assignment, grant, account status, or API key and verify both instances deny within the documented propagation target.

### Database isolation tests

Run repository methods under tenant A and prove tenant B rows cannot be selected, counted, updated, or deleted even when an application filter is absent or malformed.

### Executable architecture checks

CI should fail on:

- unscoped tenant-owned repository calls;
- public generic entities without an explicit exposure classification;
- scoped actions without target requirements;
- action definitions with no policy implementation;
- no-op resource policies on portal or scoped-staff paths;
- system bypass branches; and
- new service-layer imports of authorization implementation types.

## Acceptance criteria

The improvement program is complete only when all of the following hold:

- [ ] Every tenant-owned SQL query has a tenant predicate before limit, offset, and count.
- [ ] Every public collection action has a typed authorized query scope.
- [ ] A scoped grant can never authorize a targetless resource operation.
- [ ] Same-school unrelated actors are denied for relationship-scoped resources.
- [ ] Guardians can access only self, linked-student, or correctly targeted resources.
- [ ] Students can access only self-scoped or correctly targeted resources.
- [ ] Teachers can access only resources intersecting active teaching/homeroom assignments.
- [ ] Portal actors cannot read draft/unpublished content unless an action explicitly permits it.
- [ ] Relationship and grant revocation is effective across instances within the documented target.
- [ ] Assignment and key expiry are honored independently of the general cache TTL.
- [ ] No unconditional system authorization bypass remains.
- [ ] No portal or scoped-staff action is wired to an unclassified no-op resource policy.
- [ ] Database constraints prevent cross-school grant, key, and relationship references.
- [ ] Service-account provisioning, update, revocation, and rotation are atomic.
- [ ] REST and GraphQL pass the same actor/resource authorization contracts.
- [ ] Authorization decision logs contain sufficient audit context without sensitive payloads.
- [ ] CI enforces the action catalog, repository tenant boundary, and public exposure inventory.

## Security and operational metrics

Track at minimum:

- authorization allow/deny counts by action and actor kind;
- policy disagreement counts during shadow evaluation;
- cache hit rate and authorization revision mismatches;
- revocation propagation latency;
- queries rejected by RLS;
- unscoped query invariant failures in test/CI;
- service-account authentication and last-used timestamps;
- workload-principal actions and denials; and
- authorization decision latency at p50, p95, and p99.

Alerts should focus on anomalous action/actor combinations, repeated cross-tenant attempts, RLS denials from application roles, and workload principals requesting actions outside their allowlists.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope migration accidentally broadens access | Shadow decisions, default deny, and same-tenant-unrelated tests |
| RLS interacts badly with pooled connections | Transaction-scoped `SET LOCAL`, integration tests, and no connection-persistent tenant state |
| Query scopes become tied to Postgres | Return typed domain constraints; translate them in the query adaptor |
| Large public API churn | Introduce task-specific APIs alongside legacy endpoints and cut over clients by domain |
| Cache revision lookup adds latency | Shared strongly consistent revision cache, request coalescing, and performance budgets |
| Dual grant models diverge | Transactional dual writes, reconciliation job, and decision-level parity checks |
| Emergency containment breaks an existing client | Publish explicit endpoint changes, provide narrow replacement queries, and do not reopen insecure generic access |
| Workload allowlists omit required actions | Characterize each current job/webhook, test it end-to-end, and add actions explicitly |

## Recommended first implementation slice

Start with communications because it demonstrates every target concept while closing a confirmed portal exposure:

1. define `communications.announcement.read` and `communications.delivery.read`;
2. implement guardian, student, staff, and workload policies;
3. add typed announcement-audience and delivery-subject scopes;
4. add tenant-bound communication repositories;
5. add `listVisibleAnnouncements`, `listMyDeliveries`, and `markMyDeliveryRead`;
6. disable generic portal reads for announcement, target, and delivery entities;
7. add same-school-unrelated, cross-school, draft, expired, and revocation tests;
8. compare REST and GraphQL behavior; and
9. instrument decisions and query counts.

The second slice should be discipline, followed by calendar/timetable management. Together these slices validate portal targeting, teacher assignment relationships, scoped staff grants, query authorization, and mutation authorization before the architecture is applied to the rest of the backend.

## Final recommendation

Proceed with the redesign.

The current system contains valuable domain knowledge and should be evolved behind compatibility adapters, not discarded in a single rewrite. However, its enforcement guarantees must change materially. Authorization and tenant scope need to shape the query before data is read, counted, paginated, or mutated, and those guarantees need to be enforced at the type, repository, database, API-contract, and CI levels.

Immediate containment should be treated as a security fix independent from the longer architecture program.

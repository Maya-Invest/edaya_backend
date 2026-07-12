# Authorization and school-service decoupling plan

> This document is the detailed execution plan for the authorization workstream in the broader [backend architecture improvement proposal](./backend-architecture-improvement-proposal.md).

## Status

- **State:** proposed
- **Scope:** `package/domain-core`, `package/domain-authorization`, `package/domain-service`, authorization persistence, and API composition
- **Migration style:** incremental, behavior-preserving pull requests
- **Target dependency rule:** `@edaya/service` must not import `@edaya/authorization`

## Objective

Make the authorization strategy and implementation replaceable without changing school-service use cases.

The school-service layer must continue to enforce access at every use-case entry point, but it should express only:

1. the business action being attempted;
2. the business resources affected; and
3. the request principal's stable school and identity context.

It must not know how access is decided. Roles, permissions, effective grants, portal scopes, assurance levels, policy repositories, caches, and trusted-system bypass rules belong to the selected authorization implementation.

## Findings driving this plan

- `83` of `176` files in `package/domain-service/src` import `@edaya/authorization`.
- The service contains `164` `operationModule`/`anyOperationModule` enforcement calls and `113` resource-policy calls.
- `ServiceArgs` inherits `AuthorizedServiceArgs`, while `BaseSchoolService` exposes `ActorMetadata` and `AuthorizationPolicy`.
- `ManagedEntityService` branches on system actors and elevated staff grants.
- `OperationRef` combines a stable business action ID with RBAC and portal-capability rules.
- `SchoolRepositories` extends `AuthorizationRepository`.
- School entity hooks invalidate authorization caches and synchronize permission projections.
- RBAC-specific models (`Permission`, grant scopes, `StaffPermissionAssignment`, and `StaffAssignment.permissions`) live in `@edaya/core`.
- Background jobs construct authorization-specific system actors inside `@edaya/service`.
- The API composition root already has the information needed to bind an authorization implementation per request.

## Architectural decisions

### AD-1: The service owns the authorization port

Create `@edaya/service/access` containing the contract required by the use-case layer. The current authorization package will implement this contract.

This reverses the compile-time dependency:

```text
current:  @edaya/service -> @edaya/authorization -> @edaya/core
target:   @edaya/authorization -> @edaya/service -> @edaya/core
```

At runtime, `@edaya/service` calls an injected port. `apps/api` remains the composition root and depends on both packages.

Do not create a separate `@edaya/access-contract` package initially. Extract one only if a second independent consumer appears.

### AD-2: Use a request-bound access-control port

The service should not pass an authorization actor into every check. The API binds the private authorization actor to an `AccessControlPort` once per request.

Proposed contract:

```ts
export interface ExecutionPrincipal {
  readonly schoolId: string
  readonly requestId: string
  readonly origin: 'interactive' | 'system'
  readonly identity?: {
    readonly kind: 'staff' | 'teacher' | 'guardian' | 'student'
    readonly id: string
    readonly subjectId: string
  }
}

export interface AccessRequirement {
  readonly action: SchoolAction
  readonly targets?: readonly SchoolResourceRef[]
}

export interface AccessControlPort {
  assert(requirement: AccessRequirement): Promise<void>
}

export interface ServiceExecutionContext {
  readonly principal: ExecutionPrincipal
  readonly access: AccessControlPort
}
```

`ExecutionPrincipal.identity` is business identity used for auditing, invitation attribution, notification-profile selection, and self-service behavior. It must never contain permissions, grants, scopes, assurance, or cache state.

### AD-3: Separate action names from policy rules

`@edaya/service` owns stable semantic actions such as:

- `students.read`
- `students.update`
- `attendance.record`
- `timetable.read`
- `school.owner.transfer`
- `staff-assignment.read`

The authorization implementation owns the mapping from those actions to permissions, actor capabilities, relationship rules, or external policy documents.

The service must not express alternatives such as "workspace read OR school structure configure". It requests one semantic action; the selected authorization policy decides which grants satisfy it.

### AD-4: Keep tenant isolation independent

Tenant checks remain in the service and repository layers as defense in depth. They use `ExecutionPrincipal.schoolId`, not `ActorMetadata.schoolId`.

Authorization denial and tenant-resource concealment use a stable service-owned `AccessDeniedError`. The current `AuthorizationError` is translated inside the legacy authorization adapter.

### AD-5: Authorization lifecycle reacts to domain events

School services publish business events after committed mutations. Authorization subscribers decide whether to invalidate caches, synchronize grants, or update an external policy store.

The service must not call authorization cache or permission-projection functions directly.

### AD-6: Authorization administration is a separate vertical slice

Permission catalogs, effective grants, scope rendering, staff permission assignments, service accounts, and access-control administration move behind an authorization application API. They are not part of general `SchoolService` orchestration.

## Target package layout

```text
package/
  domain-core/
    src/domain/                       Pure school model and invariants
    src/ports/                        School-domain repository ports

  domain-service/
    src/access/
      action.ts                       Branded action type and action catalogs
      resource.ts                     Typed business resource references
      principal.ts                    Stable execution identity
      access-control-port.ts          Service-owned authorization port
      errors.ts                       Stable access-denied error
      index.ts
    src/services/                     School use cases and enforcement points
    src/events/                       Domain event publisher port and events

  domain-authorization/
    src/adapters/service-access/      Implements @edaya/service/access
    src/rbac/                         Current permission/grant implementation
    src/policy-map/                   SchoolAction -> current policy rules
    src/administration/               Permission/grant administration use cases
    src/subscribers/                  Cache and projection event handlers
    src/ports/                         Authorization-only repositories

  adaptor-postgres/
    src/school/                       School repository implementations
    src/authorization/                Transitional authorization persistence

apps/api/
  src/runtime/shared/
    school-application.ts             Chooses and binds access implementation
  src/http/dependencies/
    session-actor.ts                  Auth-specific actor remains outside service
```

Splitting `adaptor-postgres` into separate packages is optional at first. Separate module exports are sufficient until the service dependency has been removed.

## Delivery plan

### PR 0 — Characterize current behavior and freeze boundaries

**Purpose:** establish safety rails before changing contracts.

- [ ] Add a repository check that reports production imports from `package/domain-service/src` to `@edaya/authorization` without failing yet.
- [ ] Capture the current count as a migration baseline and require it to decrease or remain unchanged.
- [ ] Add characterization tests for these actor/resource combinations:
  - [ ] elevated staff and restricted staff;
  - [ ] teacher with and without teaching assignment;
  - [ ] guardian linked and unlinked to a student;
  - [ ] student self-access and foreign-student access;
  - [ ] system/background execution;
  - [ ] cross-school access for every actor kind.
- [ ] Ensure managed-entity tests cover `findById`, `list`, `count`, `save`, and `delete` denial semantics.
- [ ] Record API error behavior: concealed resource, forbidden operation, and unauthenticated request.

**Primary files:**

- `tooling/repo/lib/boundaries.ts`
- `tooling/repo/tests/boundaries.test.ts`
- `package/domain-service/tests/services/managed-entities/`
- `tooling/integration-tests/src/auth/`

**Exit gate:** existing authorization behavior is reproducible by tests before contract migration begins.

### PR 1 — Introduce the service-owned access contract

**Purpose:** create the stable seam without changing runtime decisions.

- [ ] Add `package/domain-service/src/access/` with:
  - [ ] `ExecutionPrincipal`;
  - [ ] branded `SchoolAction`;
  - [ ] typed `SchoolResourceRef` union;
  - [ ] `AccessRequirement`;
  - [ ] request-bound `AccessControlPort`;
  - [ ] `AccessDeniedError` and error code.
- [ ] Export the contract through the `@edaya/service/access` package subpath.
- [ ] Add contract tests for action uniqueness and resource-reference validation.
- [ ] Add test adapters:
  - [ ] allow-all;
  - [ ] deny-all;
  - [ ] recording adapter for use-case assertions.
- [ ] Do not migrate workflows in this PR.

**Primary files:**

- `package/domain-service/package.json`
- `package/domain-service/src/access/*`
- `package/domain-service/tests/access/*`

**Exit gate:** service code can depend on the new access contract while current behavior remains untouched.

### PR 2 — Add a legacy authorization adapter and new composition path

**Purpose:** prove that the current engine can sit behind the new service port.

- [ ] Implement `LegacyAccessControlAdapter` in `@edaya/authorization`.
- [ ] Bind existing `ActorMetadata`, operation assertion, and repository policies inside that adapter.
- [ ] Translate `AuthorizationError` into service-owned `AccessDeniedError` at the adapter boundary.
- [ ] Map `ActorMetadata` to `ExecutionPrincipal` without exposing grants or scopes.
- [ ] Add `SchoolApplication.forContext(ServiceExecutionContext)`.
- [ ] Keep `forActor()` temporarily as a deprecated compatibility wrapper in the API/integration layer, not as the target service API.
- [ ] Update API request wiring to create one request-bound access adapter.
- [ ] Move trusted system-context construction into API/runtime composition.

**Primary files:**

- `package/domain-authorization/src/adapters/service-access/*`
- `package/domain-service/src/services/school-application.ts`
- `apps/api/src/runtime/shared/school-application.ts`
- `apps/api/src/http/dependencies/session-actor.ts`
- `apps/api/src/lib/school-api/application.ts`

**Exit gate:** one API request can reach an unchanged use case through `ServiceExecutionContext`, with decisions still made by the current engine.

### PR 3 — Split operation IDs from authorization rules

**Purpose:** make action vocabulary stable across authorization strategies.

- [ ] Create action catalogs in `@edaya/service/access/actions/`, organized by school capability.
- [ ] Preserve existing operation IDs where they already describe a semantic business action.
- [ ] Replace IDs that encode surfaces or implementation details with semantic names and maintain a compatibility map during migration.
- [ ] Move staff permission, teacher capability, guardian capability, and student capability mappings into `@edaya/authorization/policy-map`.
- [ ] Make the legacy adapter resolve `SchoolAction` through the policy map.
- [ ] Add an exhaustive test: every service action has a policy mapping in the current authorization implementation.
- [ ] Add an inverse test: no duplicate action identifiers.

**Exit gate:** `OperationRef.definition` is no longer required by service code; policy rules can change without changing action declarations.

### PR 4 — Migrate managed-entity enforcement

**Purpose:** remove authorization types and helpers from the common CRUD path.

Migrate in vertical slices so each PR or commit leaves tests green:

1. students and guardians;
2. school structure;
3. academics and assessments;
4. scheduling and attendance;
5. finance;
6. communications and attachments;
7. remaining entities.

For each slice:

- [ ] Replace `checkModule` and resource-specific policy callbacks with service-owned access requirements.
- [ ] Resolve typed resource references from loaded entities.
- [ ] Keep the pre-load action check for concealed-resource behavior.
- [ ] Perform the target-aware assertion after loading the entity.
- [ ] Replace `denyResourceAccess()` with the service-owned denial error where concealment is intentional.
- [ ] Remove imports of operation families, `AuthorizationPolicy`, `ActorMetadata`, and authorization gate helpers.
- [ ] Use the recording access adapter in service tests; keep actor matrices in authorization adapter tests.

**Count behavior:**

- [ ] Remove the `effectiveGrants.isElevated` optimization from `ManagedEntityService` initially.
- [ ] Preserve correctness by using the existing row-aware path.
- [ ] Design a separate strategy-neutral query-scope optimization only after the decoupling is complete and benchmarked.

**Primary files:**

- `package/domain-service/src/services/entities/managed-entity-service.ts`
- `package/domain-service/src/services/entities/entity-config/authorization.ts`
- `package/domain-service/src/services/entities/config/**`

**Exit gate:** managed-entity production code contains no authorization actor, grant, operation-rule, or policy-resolver types.

### PR 5 — Migrate workflow and query enforcement

**Purpose:** remove direct authorization implementation calls from explicit use cases.

- [ ] Replace workflow `operationModule(...)` calls with `context.access.assert(...)`.
- [ ] Replace `authorizationPolicy.check*` calls with action-plus-target requirements.
- [ ] Replace permission alternatives with one semantic action per use case.
- [ ] Replace authorization-driven actor branching:
  - [ ] school owner transfer becomes `school.owner.transfer`;
  - [ ] system bypasses become policy decisions in the adapter;
  - [ ] self-access becomes an action/target decision.
- [ ] Retain actor-kind branching only for business identity mapping, auditing, and notification-recipient selection.
- [ ] Replace direct `ActorMetadata` use in notification and cron capabilities with `ExecutionPrincipal`.
- [ ] Update command handlers and test contexts to inject recording or explicit fake access adapters.

**Primary files:**

- `package/domain-service/src/services/workflows/**`
- `package/domain-service/src/services/school-service.ts`
- `package/domain-service/src/services/base-school-service.ts`
- `package/domain-service/src/capabilities/notifications/**`
- `package/domain-service/src/capabilities/scheduling-jobs/**`

**Exit gate:** all school workflows and queries compile and test without importing `@edaya/authorization`.

### PR 6 — Decouple repositories and authorization lifecycle

**Purpose:** remove persistence and cache implementation details from school orchestration.

- [ ] Remove `authorization: AuthorizationRepository` from `SchoolRepositories`.
- [ ] Define authorization repository composition inside `@edaya/authorization`.
- [ ] Introduce a domain-event publisher port with commit-aware delivery.
- [ ] Publish events for authorization-relevant changes:
  - [ ] staff member;
  - [ ] staff assignment;
  - [ ] guardian/student link;
  - [ ] enrollment;
  - [ ] student, guardian, and teacher identity link;
  - [ ] teacher assignment.
- [ ] Move cache invalidation into authorization event subscribers.
- [ ] Move staff-assignment permission synchronization into an authorization subscriber/projection handler.
- [ ] Ensure events are dispatched after transaction commit or through an outbox; do not invalidate or project before a rollback can occur.
- [ ] Remove `authCacheInvalidation` from `ServiceArgs`.
- [ ] Remove `domain-service/src/integration/auth-cache-hooks.ts` after all event handlers are active.

**Exit gate:** changing authorization cache or policy-projection technology requires no service change.

### PR 7 — Extract authorization administration and RBAC models

**Purpose:** make the current authorization strategy replaceable as a complete vertical slice.

- [ ] Move `AccessControlServiceWorkflow` out of general `SchoolService`.
- [ ] Move permission catalog, scope rendering, effective-grants queries, service-account workflows, and staff grant assignment behind an authorization administration service.
- [ ] Compose authorization routes against that administration service directly.
- [ ] Move these RBAC-specific types out of `@edaya/core`:
  - [ ] `Permission`;
  - [ ] permission scope catalog and `scopeIds` grammar;
  - [ ] `ScopeGrant`;
  - [ ] `StaffPermissionAssignment`.
- [ ] Remove `StaffAssignment.permissions` from the school entity.
- [ ] Introduce an authorization-owned assignment/grant binding if the UI must continue configuring grants alongside a staff assignment.
- [ ] Migrate persistence and seed data without changing public API behavior in the same release.
- [ ] Keep compatibility DTOs at API boundaries until clients migrate.

**Exit gate:** `@edaya/core` describes school business state without depending on the current RBAC persistence model.

### PR 8 — Enforce the final boundary and remove compatibility code

**Purpose:** make architectural regression impossible.

- [ ] Remove `@edaya/authorization` from `package/domain-service/package.json`.
- [ ] Delete deprecated `forActor()` compatibility paths.
- [ ] Delete legacy `AuthorizedServiceArgs`, service-facing `AuthorizationPolicy`, and service gate exports.
- [ ] Reverse the import boundary checks:
  - [ ] fail on any `@edaya/authorization` import from `package/domain-service/src`;
  - [ ] allow authorization to import only `@edaya/service/access`, not service implementations;
  - [ ] continue forbidding domain packages from importing apps or auth runtime adaptors.
- [ ] Update `AGENTS.md`, `README.md`, and `docs/reference/integrations-restructure.md` with the new dependency direction.
- [ ] Remove migration-count checks introduced in PR 0 and replace them with the zero-import invariant.

**Exit gate:** the repository verifier enforces the target architecture.

## Verification matrix

Every migration PR must run the smallest relevant package tests plus the final repository gates.

| Concern | Required verification |
|---|---|
| Service access declarations | Recording-adapter unit tests assert exact action and targets |
| Current RBAC behavior | Authorization adapter actor/resource matrix tests |
| Tenant isolation | Cross-school service and integration tests |
| Portal safety | Teacher, guardian, and student integration scenarios |
| Background jobs | System execution-context cron tests |
| Error contract | API tests for 401, 403, and concealed resources |
| Cache/projection lifecycle | Commit, rollback, duplicate-event, and invalidation tests |
| Package boundaries | `bun repo verify` boundary checks |

Per-PR commands:

```sh
bun --filter @edaya/core check
bun --filter @edaya/authorization check
bun --filter @edaya/service check
bun --filter @edaya/authorization test
bun --filter @edaya/service test
bun --filter @edaya/api test
```

Before merging PR 8:

```sh
bun repo verify --full
bun run test:integration:seed
```

## Migration invariants

The following must remain true throughout the migration:

1. No request path bypasses service-level enforcement merely because HTTP middleware authenticated it.
2. Missing and inaccessible resources preserve current concealment behavior.
3. Tenant validation remains independent of policy-engine availability.
4. Portal actors remain covered; staff-only success is not sufficient validation.
5. System access is created only by trusted composition code.
6. Business gates do not branch on permissions, grants, assurance, or actor authorization state.
7. Authorization adapters may query authorization repositories, but service use cases may not.
8. Every new service action must have a test and a mapping in each enabled authorization implementation.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Behavior drift while merging operation and resource checks | Legacy adapter delegates to the current engine; migrate one vertical slice at a time with actor matrices |
| Resource-existence leaks | Preserve pre-load action checks and normalize denial errors |
| Portal regression | Run guardian, student, and teacher cases for every migrated resource family |
| Event invalidation before transaction commit | Use commit hooks or an outbox; test rollback behavior |
| Service action catalog becomes another permission catalog | Name actions after use-case intent; keep all grant alternatives in authorization mappings |
| Generic resource bags lose type safety | Use a discriminated `SchoolResourceRef` union, not arbitrary claim dictionaries |
| Count/list performance regresses | Prefer correctness during migration; introduce a measured strategy-neutral query-scope port later |
| Authorization package gains broad service dependency | Export and allow only `@edaya/service/access`; enforce subpath imports |
| Client API breaks when RBAC administration moves | Keep API compatibility DTOs/routes while changing internal composition |

## Explicit non-goals

- Replacing the current RBAC/relationship implementation during the decoupling migration.
- Changing public authorization behavior or portal access rules.
- Moving enforcement exclusively into HTTP middleware.
- Introducing an external policy engine before the service-owned port is stable.
- Optimizing authorized list/count queries before correctness and package separation are complete.

## Definition of done

- [ ] `package/domain-service/src` has zero imports from `@edaya/authorization`.
- [ ] `package/domain-service/package.json` has no authorization dependency.
- [ ] School-service tests use access-port fakes rather than effective grants or actor factories.
- [ ] Current authorization is loaded through an adapter selected in the API composition root.
- [ ] A second allow-all or deny-all implementation can replace the current adapter without modifying service code.
- [ ] Authorization caches and permission projections are absent from school-service code.
- [ ] `SchoolRepositories` contains no authorization repository.
- [ ] `@edaya/core` contains no RBAC-specific persistence model.
- [ ] Staff, portal, system, and cross-tenant integration suites pass.
- [ ] Repository boundary checks prevent the old dependency direction from returning.

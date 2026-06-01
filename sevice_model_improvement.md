# Service Model Improvement Plan

## Goal

Replace the current duplicated command/query service patterns with a unified, policy-aware service model built around `ManagedEntityService<T>`.

The migration should focus on `packages/core` until the new service model is complete. Unit tests and other packages should be migrated after the core package has a stable `ManagedEntityService`, `BaseSchoolService`, and `SchoolService` API.

The new model should make basic entity operations consistent across the school core:

- `findById`, `findByIds`, `findOne`, `list`, `count`
- `save`, `batchSave`
- `delete`, `batchDelete`

It must preserve the important safety boundaries already present in the codebase:

- Tenant isolation
- Module-level authorization
- Entity-level authorization
- Proposed-state authorization for creates and updates
- Pre-mutation business rules
- Optional atomic execution for multi-entity workflows

Domain-specific operations should live on `SchoolService` only when they are true complex workflows with tight business rules that cannot safely be represented as consecutive managed entity calls.

## Current Problems

Current command services repeatedly hand-code the same flow:

1. Resolve or construct an entity.
2. Check tenant boundaries.
3. Check authorization.
4. Apply business rules.
5. Persist or delete.

This has produced several issues:

- Boilerplate is repeated across many services.
- Delete operations are missing for many entities.
- Different services apply authorization and tenant checks inconsistently.
- Bugs are easy to introduce, such as authorizing a delete path but forgetting to call `delete()`.
- Adding new simple operations has high friction.

The current codebase already has useful partial abstractions:

- `AuthorizedReadService<T>` handles authorized reads.
- `AuthorizedWriteService<T>` handles a small subset of authorized writes for config-style entities.

The improvement is to replace both with a single managed entity layer.

## Target Architecture

```mermaid
graph TD
    A["Caller: find/list/save/delete/batch"] --> B["ManagedEntityService<T>"]
    B --> C["Tenant Resolution"]
    B --> D["Authorization"]
    B --> E["Business Gates"]
    B --> F["Repository"]
    G["SchoolService domain operations"] --> B
```

## Naming

Use `ManagedEntityService<T>`.

Reasoning:

- It is broader than authorization.
- It describes the actual role: entity access is managed by tenant rules, authorization rules, business gates, and repository persistence.
- It still leaves `BaseSchoolService` and `SchoolService` names clean at the application service level.

## Public Service Shape

Introduce a unified base service:

```ts
export class BaseSchoolService {
  readonly schools: ManagedEntityService<School>
  readonly academicYears: ManagedEntityService<AcademicYear>
  readonly students: ManagedEntityService<Student>
  readonly classGroups: ManagedEntityService<ClassGroup>
  // ...all managed entities
}

export class SchoolService extends BaseSchoolService {
  // Complex domain operations:
  // promoteStudent(...)
  // transferStudent(...)
  // publishReportCard(...)
  // recordPayment(...)
  // reversePayment(...)
  // assignResourceToSession(...)
}
```

Simple CRUD should go through the entity properties on `BaseSchoolService`.

Complex workflows should live on `SchoolService` and should call `BaseSchoolService` managed entity operations internally when that avoids bypassing shared checks.

Only add a method to `SchoolService` when it coordinates a meaningful business workflow, such as:

- Multi-entity transitions that must be atomic.
- Ordered business rules where one write depends on validated current state.
- Aggregate updates coupled to event records.
- Lifecycle transitions with invariants that cannot be expressed as independent `save` calls.

Do not add `SchoolService` methods for simple CRUD wrappers. Those should remain direct `BaseSchoolService` managed entity calls.

## Core Contract

The core service must not rely only on entity ids for write authorization. Creates and updates need to authorize the proposed state, especially for indirect tenant entities such as `ResourceAssignment`, `AttendanceRecord`, `AssessmentResult`, and `Payment`.

Recommended contract:

```ts
export interface ManagedEntityServiceConfig<T> {
  repository: BaseRepositoryInterface<T>

  tenant: EntityTenantResolver<T>
  read: EntityReadAuthorization<T>
  write: EntityWriteAuthorization<T>

  gates?: EntityBusinessGates<T>
  atomicExecution?: AtomicExecution
}

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined>
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
}

export interface EntityReadAuthorization<T> {
  checkModule: (actor: ActorMetadata) => Promise<void>
  checkAccess: (
    actor: ActorMetadata,
    entities: readonly T[],
    repositories: SchoolRepositories,
  ) => Promise<void>
}

export interface EntityWriteAuthorization<T> {
  checkModule: (actor: ActorMetadata) => Promise<void>
  authorizeSave: (
    actor: ActorMetadata,
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
  ) => Promise<void>
  authorizeDelete: (
    actor: ActorMetadata,
    entity: T,
    repositories: SchoolRepositories,
  ) => Promise<void>
}

export interface EntityBusinessGates<T> {
  preSave?: (
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
  ) => Promise<void>
  preDelete?: (
    entity: T,
    repositories: SchoolRepositories,
  ) => Promise<void>
}

export interface AtomicExecution {
  execute: <R>(operation: () => Promise<R>) => Promise<R>
}
```

### Important Save Semantics

`existing` should be `undefined` for new entities.

That is still useful. Create operations commonly need business checks such as:

- Parent entity exists.
- Parent belongs to the actor school.
- Unique default per school or grade level.
- Capacity is not exceeded.
- Referenced resource/session/class/student is accessible.
- Proposed FK values are allowed.

For updates, both `entity` and `existing` matter:

- `existing` proves what is currently stored.
- `entity` represents the proposed state.
- Authorization and gates must reject unsafe FK changes or status transitions.

## ManagedEntityService Behavior

### Reads

`findById(id)`:

1. Fetch entity.
2. If missing, return `undefined`.
3. Resolve tenant from entity and compare with actor.
4. Run read module check.
5. Run read entity access check.
6. Return entity.

`findByIds(ids)`:

1. Run read module check.
2. Fetch entities by ids.
3. Resolve tenant for each returned entity and compare with actor.
4. Run read entity access check for returned entities.
5. Return entities.

`findOne(options)` and `list(options)`:

1. Check tenant boundary from filter when possible.
2. Run read module check.
3. Fetch entities.
4. Resolve tenant for each entity and compare with actor.
5. Run read entity access check.
6. Return result.

`count(filter)`:

1. Check tenant boundary from filter when possible.
2. Run read module check.
3. Return repository count.

### Save

`save(entity)`:

1. Resolve tenant from proposed entity and compare with actor.
2. Run write module check.
3. Load `existing` by id when the entity has an id.
4. If `existing` exists, resolve tenant from existing and compare with actor.
5. Run proposed-state write authorization.
6. Run `preSave(entity, existing, repositories)` when configured.
7. Persist.

`batchSave(entities)`:

1. Resolve tenant from each proposed entity and compare with actor.
2. Run write module check once.
3. Load existing entities for proposed ids.
4. Resolve tenant from each existing entity and compare with actor.
5. For each proposed entity, run proposed-state write authorization.
6. For each proposed entity, run `preSave(entity, existing, repositories)` when configured.
7. Persist with repository `batchSave`.
8. Return saved ids.

### Delete

`delete(id)`:

1. Run write module check.
2. Fetch entity by id.
3. If missing, return without error.
4. Resolve tenant from entity and compare with actor.
5. Run delete authorization.
6. Run `preDelete(entity, repositories)` when configured.
7. Delete.

`batchDelete(ids)`:

1. Run write module check once.
2. Fetch existing entities by ids.
3. If no entities exist, return without error.
4. Resolve tenant from each existing entity and compare with actor.
5. For each existing entity, run delete authorization.
6. For each existing entity, run `preDelete(entity, repositories)` when configured.
7. Delete existing ids with repository `batchDelete`.

## Tenant Strategy

Direct tenant entities can resolve tenant from `entity.schoolId`.

School itself should resolve tenant from `entity.id`.

Indirect tenant entities need domain-specific resolvers. Examples:

- `ResourceAssignment` -> `resource` -> `schoolId`
- `ClassSubject` -> `classGroup` -> `schoolId`
- `ClassSubjectMatter` -> `classSubject` -> `classGroup` -> `schoolId`
- `Session` -> `classGroup` -> `schoolId`
- `AttendanceRecord` -> `session` -> `classGroup` -> `schoolId`
- `AssessmentResult` -> `assessment` -> `classGroup` -> `schoolId`
- `Payment` -> `studentFee` -> `student` -> `schoolId`

Tenant resolution should be explicit and test-covered for every indirect entity.

## Authorization Strategy

Read and write authorization must remain separate internally, even though the public service is unified.

Read authorization answers:

- Can this actor read this module?
- Can this actor read these returned entities?

Write authorization answers:

- Can this actor mutate this module?
- Can this actor save this proposed entity state?
- Can this actor delete this existing entity?

Do not force write authorization through read-style `checkAccess(actor, ids)` only. That is insufficient for creates and FK-changing updates.

## Business Gates

Business gates should cover pre-mutation invariants that are not basic constructor validation.

Examples:

- Academic year cannot be deleted while class groups exist.
- Academic period must remain inside its academic year.
- Class group capacity cannot be set below active enrollments.
- Resource assignment cannot overlap or duplicate an existing assignment.
- Published report cards are immutable.
- Payments cannot be added to cancelled fees.
- Student cannot leave graduated status through a profile update.

Constructor validation should continue to enforce entity-local invariants.

Business gates should enforce cross-entity and lifecycle invariants.

## Atomic Execution

Atomic execution should be optional.

`ManagedEntityService` can accept `atomicExecution`, but should not require it.

Complex multi-entity operations should be written in a way that can be wrapped by an atomic executor:

```ts
const run = async () => {
  // multi-entity workflow
}

if (this.atomicExecution) {
  return this.atomicExecution.execute(run)
}

return run()
```

Simple single-entity operations do not need to require atomic execution.

## Code Organization

Use centralized service construction with helpers grouped by domain modules, similar to the authorization organization.

Recommended structure:

```txt
packages/core/src/services/entities/
  managed-entity-service.ts
  base-school-service.ts
  tenant-resolvers.ts
  entity-service-config.ts
  configs/
    setup-config.ts
    student-config.ts
    academics-config.ts
    assessments-config.ts
    scheduling-config.ts
    finance-config.ts
    communications-config.ts
    behavior-config.ts
```

`base-school-service.ts` should compose all domain config helpers into the public entity service surface.

Domain config files should contain:

- Module checks
- Entity access authorization
- Tenant resolver selection
- Business gates

Shared helper files should contain reusable tenant and access utilities.

## Migration Strategy

Replace in one coordinated change rather than maintaining two public models long-term.

The first migration boundary is `packages/core`. Avoid broad updates to apps or other packages until the core model is implemented, wired, and internally verified.

Strategy adjustment:

1. Finish the new service model under `packages/core/src/services/entities`.
2. Treat `BaseSchoolService` as the public surface for simple managed entity operations.
3. Treat `SchoolService` as the public surface for complex workflows only.
4. Keep old command/query services as compatibility adapters while the new entities service surface is completed and tested.
5. After the new core service surface is complete, migrate downstream callers away from old command/query services.
6. Remove old services only after downstream callers have moved.

To keep the replacement safe:

1. Implement `ManagedEntityService<T>`.
2. Implement domain config helpers for all current repositories.
3. Implement `BaseSchoolService`.
4. Convert `SchoolService` to extend `BaseSchoolService`.
5. Implement selected complex workflows directly on `SchoolService`.
6. Complete and test the new entities service surface in `packages/core`.
7. Migrate downstream callers away from old services.
8. Remove `AuthorizedReadService<T>`, `AuthorizedWriteService<T>`, and old command/query services after callers move.

The replacement should avoid exposing partially configured entity services.

## Task Plan

## Progress

Completed core-package work so far:

- [x] Added `ManagedEntityService<T>` with unified read, save, delete, and batch operations.
- [x] Added explicit read authorization, write authorization, tenant resolution, business gates, and optional atomic execution hooks.
- [x] Added direct tenant, school tenant, and indirect tenant resolver helpers.
- [x] Added centralized entity service config for all repositories in `SchoolRepositories`.
- [x] Added `BaseSchoolService` exposing one `ManagedEntityService<T>` per repository.
- [x] Added `SchoolService extends BaseSchoolService`.
- [x] Re-scoped `SchoolService` to complex workflows only; simple CRUD remains on `BaseSchoolService` managed entity properties.
- [x] Exposed the new managed surface on `SchoolHeadlessApp` as `app.base` and `app.service`.
- [x] Made `app.base` reuse the same `SchoolService` instance as `app.service`.
- [x] Moved aggregate query operations onto `SchoolService`: `getOverdueFeeCount` and `getPublishedReportCardCount`.
- [x] Converted `ConfigService` into a compatibility facade over managed entity services.
- [x] Preserved `SubjectMatter` proposed-state authorization for parent subject tenant validation.
- [x] Wired `SchoolSetupService` to `BaseSchoolService` for managed operations.
- [x] Migrated `removeResourceAssignment` to delegate the actual delete to `resourceAssignments.delete(id)`.
- [x] Removed the now-unused setup-local resource assignment context resolver.
- [x] Migrated `removeAttachment` to delegate the actual delete to `attachments.delete(id)` after preserving owner-context authorization.
- [x] Migrated `assignResourceToClass` and `assignResourceToSession` to delegate persistence to `resourceAssignments.save(entity)` after preserving setup-specific duplicate and overlap gates.
- [x] Migrated `registerAttachment` to delegate persistence to `attachments.save(entity)` after preserving owner-context authorization and audit actor assignment.
- [x] Migrated `createAcademicYear`, `activateAcademicYear`, and active-year deactivation writes to delegate persistence to `academicYears.save(entity)`.
- [x] Migrated `createAcademicPeriod` and `publishAcademicPeriod` to delegate persistence to `academicPeriods.save(entity)` after preserving academic-year containment checks.
- [x] Migrated `registerSchool` and `updateSchoolConfiguration` to delegate persistence to `schools.save(entity)` after preserving the registration vs lifecycle authorization split.
- [x] Migrated `createClassGroup` and `updateClassGroupConfiguration` to delegate persistence to `classGroups.save(entity)` after preserving academic-year, grade-level, homeroom staff, and capacity checks.
- [x] Migrated `registerStaffMember` and `updateStaffMemberStatus` to delegate persistence to `staffMembers.save(entity)` after preserving setup authorization and self-deactivation protection.
- [x] Migrated staff assignment creation for classes, class subjects, and sessions to delegate persistence to `staffAssignments.save(entity)` after preserving assignment-target checks.
- [x] Migrated `AcademicsService` curriculum writes to delegate persistence to `classSubjects.save(entity)`, `classSubjectMatters.save(entity)`, and `classSubjectProgress.save(entity)` while preserving existing class-group and session access checks.
- [x] Started implementing complex workflows directly in the new `SchoolService` under `packages/core/src/services/entities`.
- [x] Added `SchoolService.recordSessionProgress(...)` as the first direct complex workflow, including duplicate prevention, monotonic progress validation, atomic writes, managed persistence, and class-subject aggregate update.
- [x] Added `SchoolService.publishReportCardResult(...)`, including report-card generation, attendance summary aggregation, published-card immutability, atomic publishing, and managed `results.save(entity)` persistence.
- [x] Added `SchoolService` finance workflows: `assignFeeToStudent`, `recordPayment`, `reversePayment`, and `cancelPayment`, including installment materialization, fee status derivation, payment lifecycle validation, atomic paid-amount updates, and managed `studentFees`/`payments` persistence.
- [x] Added `SchoolService` student transition workflows: `promoteStudent` and `transferStudent`, including active-enrollment validation, successor target validation, promotion grade-order validation, target capacity checks, atomic close-and-successor creation, and managed `enrollments.save(entity)` persistence.
- [x] Added managed write options so domain workflows can mark module authorization as already checked while still using managed tenant, entity authorization, gate, and repository handling.
- [x] Aligned managed staff-assignment write authorization with the workflow action `setup.assign_staff`.
- [x] Added managed class-subject staff-assignment authorization that resolves the class subject back to class-group access.
- [x] Added focused tests for create-state gates, tenant rejection, idempotent delete, academic-year delete gate, indirect resource assignment tenant checks, `SchoolService` aggregate queries, and the managed `ConfigService` facade.
- [x] Added regression coverage proving `removeResourceAssignment` calls repository delete through the managed path while still checking `resources.manage` and class-group access.
- [x] Added regression coverage proving `removeAttachment` calls repository delete through the managed path while still checking `attachments.manage` and student owner access.
- [x] Added regression coverage proving resource assignment creation persists through the managed path and still checks class-group or session access.
- [x] Added regression coverage proving attachment registration persists through the managed path and still checks `attachments.manage` and student owner access.
- [x] Added regression coverage proving academic-year creation persists through the managed path and active-year creation deactivates existing active years through managed saves.
- [x] Added regression coverage proving academic-period creation and publishing persist through the managed path, and invalid dates outside the academic year are still rejected.
- [x] Added regression coverage proving school registration and school configuration updates persist through the managed path while preserving registration/lifecycle authorization.
- [x] Added regression coverage proving class-group creation and configuration updates persist through the managed path while preserving capacity and class-group access checks.
- [x] Added regression coverage proving staff member registration, staff status updates, and staff assignment creation persist through the managed path while preserving assignment authorization.
- [x] Added regression coverage proving subject offering, subject-matter assignment, and session progress recording persist through the managed academics path.
- [x] Added direct `SchoolService` workflow coverage for `recordSessionProgress`, including duplicate progress and decreasing progress rejection.
- [x] Added direct `SchoolService` workflow coverage for `publishReportCardResult`, including generated averages, attendance summary counts, managed persistence, and already-published rejection.
- [x] Added direct `SchoolService` workflow coverage for finance assignment, payment recording, reversal, cancellation, cancelled-fee payment rejection, and non-recorded payment reversal rejection.
- [x] Added direct `SchoolService` workflow coverage for student promotion and transfer, including managed persistence, inactive enrollment rejection, same-class target rejection, invalid promotion target rejection, and full target class-group rejection.
- [x] Added regression coverage proving lifecycle-only setup operations do not accidentally require the generic `setup.manage` action after delegating to managed saves.
- [x] Added `findByIds`, `batchSave`, and `batchDelete` to `ManagedEntityService<T>`.
- [x] Added focused tests for managed bulk read, bulk save, and bulk delete behavior.

Current validation status:

- [x] `bun run --cwd packages/core check`
- [x] `bun run --cwd packages/core lint`
- [x] `bun run --cwd packages/core test` passes with 324 tests.

Compatibility still intentionally present:

- `AuthorizedReadService<T>` still exists.
- `AuthorizedWriteService<T>` still exists.
- Existing domain command services still exist.
- Existing `SchoolQueryService` still exists while callers migrate to `SchoolService`.

Recommended next slice:

- Continue implementing direct `SchoolService` complex workflows in `packages/core/src/services/entities`.
- Good candidates: scheduling attendance workflows, student graduation/withdrawal workflows, and remaining tightly coupled student lifecycle transitions.
- Avoid migrating more old command service internals unless needed as a compatibility adapter after the new entities service surface is complete.

### Phase 1: Design Lock

- [x] Confirm final public API names: `ManagedEntityService`, `BaseSchoolService`, `SchoolService`.
- [ ] Confirm final removal timing for current `SchoolQueryService`, `ConfigService`, and individual command service exports.
- [x] List every repository in `SchoolRepositories` and assign it to managed entity service config.
- [x] Classify every entity as direct tenant or indirect tenant.
- [ ] Define required write gates for every entity before exposing `save` and `delete`.

### Phase 2: Shared Core

- [x] Create `services/entities/managed-entity-service.ts`.
- [ ] Move duplicated tenant-boundary logic out of query/config services into shared helpers.
- [x] Implement direct tenant resolver.
- [x] Implement school-id tenant resolver for `School`.
- [x] Implement indirect tenant resolver helpers.
- [x] Add support for optional `atomicExecution`.
- [x] Add tests for core read behavior.
- [x] Add tests for core `findByIds` behavior.
- [x] Add tests for core save behavior with `existing === undefined`.
- [x] Add tests for core `batchSave` behavior with mixed existing and new entities.
- [ ] Add tests for update behavior where proposed FK changes must be authorized.
- [x] Add tests for idempotent delete behavior.
- [x] Add tests for core `batchDelete` behavior.

### Phase 3: Domain Configs

- [x] Create setup entity config.
- [x] Create student entity config.
- [x] Create academics entity config.
- [x] Create assessments entity config.
- [x] Create scheduling entity config.
- [x] Create finance entity config.
- [x] Create communications entity config.
- [x] Create behavior entity config.
- [ ] Add tenant resolver tests for every indirect entity.
- [ ] Add authorization tests for representative direct and indirect entities.

### Phase 4: Base Service

- [x] Create `BaseSchoolService`.
- [x] Expose one `ManagedEntityService<T>` per repository.
- [x] Wire domain configs into `BaseSchoolService`.
- [x] Keep property names aligned with `SchoolRepositories` where possible.
- [ ] Add compile-time coverage to ensure each repository has a matching managed service.

### Phase 5: Domain Service Replacement

- [x] Create or update `SchoolService extends BaseSchoolService`.
- [ ] Move selected complex domain operations into `SchoolService`.
- [ ] Refactor complex operations to call base managed services where appropriate.
- [ ] Complete the new `SchoolService` workflow surface before downstream migration.
- [ ] Replace `SchoolQueryService` usage with `SchoolService` or `BaseSchoolService` after the new core service surface is complete.
- [x] Replace `ConfigService` internals with `SchoolService` or `BaseSchoolService`.
- [ ] Remove simple CRUD methods from old domain command services.
- [x] Migrate `SchoolSetupService.removeResourceAssignment` to the managed delete path.
- [x] Migrate `SchoolSetupService.removeAttachment` to the managed delete path.
- [x] Migrate `SchoolSetupService` resource assignment creation to the managed save path.
- [x] Migrate `SchoolSetupService.registerAttachment` to the managed save path.
- [x] Migrate `SchoolSetupService` school registration and configuration writes to the managed save path.
- [x] Migrate `SchoolSetupService` academic-year writes to the managed save path.
- [x] Migrate `SchoolSetupService` academic-period writes to the managed save path.
- [x] Migrate `SchoolSetupService` class-group writes to the managed save path.
- [x] Migrate `SchoolSetupService` staff-member writes to the managed save path.
- [x] Migrate `SchoolSetupService` staff-assignment writes to the managed save path.
- [x] Migrate `AcademicsService` curriculum writes to the managed save path.
- [ ] Remove old command/query service exports after all callers are migrated.

### Phase 6: Business Gate Coverage

- [ ] Add delete gate for academic years with class groups.
- [ ] Add delete gate for academic periods with dependent records.
- [ ] Add class group capacity gate.
- [ ] Add staff self-deactivation gate.
- [ ] Add resource assignment duplicate and overlap gates.
- [ ] Add report-card immutability gates.
- [ ] Add finance lifecycle gates for fees, student fees, and payments.
- [ ] Add student profile status transition gates.
- [ ] Audit remaining existing `BusinessRuleViolationError` usage and decide whether each rule belongs in a gate or a complex workflow.

### Phase 7: Test and Cleanup

- [x] Run TypeScript typecheck.
- [x] Run core package unit tests.
- [x] Run core service-level authorization tests.
- [ ] Run core integration tests if available.
- [ ] Remove `AuthorizedReadService<T>`.
- [ ] Remove `AuthorizedWriteService<T>`.
- [ ] Remove duplicated tenant helper implementations.
- [ ] Update exports and imports.
- [ ] Update README or developer docs if service construction is documented.

### Phase 8: Downstream Migration

- [ ] Migrate unit tests that depend on the old query or command service APIs.
- [ ] Migrate non-core packages to the new `SchoolService` or `BaseSchoolService` API.
- [ ] Migrate app-level callers after package-level callers are updated.
- [ ] Run full workspace tests.
- [ ] Remove compatibility exports only after downstream callers are migrated.

## Acceptance Criteria

- Every repository in `SchoolRepositories` is exposed through `BaseSchoolService`.
- Simple reads, saves, deletes, and batch operations go through `ManagedEntityService<T>`.
- Complex workflows live on `SchoolService`.
- Direct and indirect tenant checks are explicit and tested.
- Create authorization uses the proposed entity state.
- Update authorization considers both existing and proposed state.
- Delete authorization uses the existing stored entity.
- Business gates prevent known unsafe mutations.
- Old read/write wrappers are removed.
- Core package tests pass before downstream migration starts.
- Full workspace tests pass after unit tests and other packages are migrated.
- New tests cover representative direct and indirect entities.

## Key Risks

### Proposed-State Authorization Gaps

Risk: a create or update is authorized using only an id that does not yet exist or no longer represents the proposed relationship.

Mitigation: require `authorizeSave(actor, entity, existing, repositories)` for all writable entities.

### Incomplete Indirect Tenant Resolution

Risk: indirect entities bypass tenant checks because they do not have `schoolId`.

Mitigation: require explicit tenant resolver config for every entity without direct `schoolId`.

### Overexposed Generic Save

Risk: generic `save` allows callers to bypass workflow lifecycle rules.

Mitigation: add gates before exposing each entity, and keep complex transitions on `SchoolService`.

### Large One-Shot Replacement

Risk: replacing read/write services in one change creates a broad regression surface.

Mitigation: make the implementation mechanically conservative, add compile-time coverage for all repositories, and require a full test pass before removing old services.

## Recommended First Implementation Slice

Start with the managed service core and a small but representative set of entities:

- `AcademicYear`: direct tenant, simple read/write, meaningful delete gate.
- `SubjectMatter`: direct or parent-linked validation through `Subject`.
- `ResourceAssignment`: indirect tenant, proposed-state authorization, known delete bug path.
- `AttendanceRecord`: indirect tenant through session and class group.
- `Payment`: indirect tenant through student fee and student.

This slice exercises the important complexity before all entities are migrated.

# Authorization Operations — Sprint Plan

> **Status:** Not started  
> **Created:** 2026-07-06  
> **Last updated:** 2026-07-06  
> **Scope:** Unified enforcement layer for staff permissions, teacher capabilities, and guardian/student link scopes  
> **Depends on:** [relationship-native-auth-plan.md](./relationship-native-auth-plan.md) Fold F (session + scope resolution complete)  
> **Out of scope:** Client UI capability pickers, distributed scope cache, per-school custom operation catalogs, assurance product  
> **Related:** [authorization/README.md](../../package/domain-core/src/capabilities/authorization/README.md), [authorization-migration-coverage.test.ts](../../package/domain-core/tests/unit/auth/authorization-migration-coverage.test.ts)

Fold F landed **relationship-native resolution** (multi-profile login, `X-Actor-Kind`, scope preload). Enforcement still routes three authorization paths through a staff-shaped API (`permissionAction`, ad-hoc `*WriteModule` helpers, and god-function policy resolvers). This plan introduces an **Operation** catalog and **policy strategies** so entity configs and workflows speak one vocabulary while staff, teacher, and link-based portal actors keep their native credentials.

---

## 1. Problem statement

| Issue | Today | Impact |
|-------|-------|--------|
| Staff permission names at entity boundary | `permissionAction(Permission.GRADE_READ)` in entity configs | Portal enforcement hidden behind permission→capability maps |
| Teacher write branching in domain | `if (actor.kind === 'teacher')` in `assessment-result.ts`, `incident.ts`, etc. | Duplicated teaching/homeroom logic; easy to miss a path |
| `*WriteModule` proliferation | 12+ helpers in `entity-config/authorization.ts` | Each new teacher write adds another special-case helper |
| Policy god-functions | `checkStudentAccess` switches on 4 actor kinds | Hard to test; staff grant logic mixed with link scope |
| `isPortalActor` blobs | `finance.ts`, `attachment.ts` | Portal treated as monolith instead of per-kind strategies |
| Test surface duplication | Actor factories copied across 24 auth test files | Matrix coverage gaps; large monolithic policy tests |
| Stale README principle | “One path for all actors via `authorize()`” | Misleading for new contributors |

### What is already correct (do not rework)

- Session resolution: `resolveInteractiveActorIdentity` + `X-Actor-Kind` / `X-Actor-Id`
- Scope preload: `resolveCachedActorScope` for portal; `resolveCachedEffectiveGrants` for staff
- Capability enums and `assertTeachingCapability` / `assertGuardianCapability` / etc.
- Two-layer model: module gate (sync) + resource policy (async)

---

## 2. Design principles

1. **Entity configs speak Operations, not Permissions** — `Permission` is staff implementation detail inside the operation catalog.
2. **Actor switches live in exactly two places** — `operationModule()` (layer 1) and `policy/compose.ts` (layer 2). Not in `src/domain/**`.
3. **Teacher teaching/homeroom `anyOf` is data** — encoded once per operation, not copy-pasted per entity.
4. **Resource policy dispatches by `actor.kind`** — strategies are small files; no `isPortalActor`.
5. **Business gates stay auth-free** — `preSave` / `preDelete` immutability rules remain separate.
6. **Tests follow the same seams** — operation matrix tests, per-strategy policy tests, thin compose smoke; no entity-domain auth unit tests.

---

## 3. Target architecture

```mermaid
flowchart TB
  subgraph credentials [Preloaded per request — unchanged]
    STAFF[StaffActorMetadata.effectiveGrants]
    TEACH[TeacherActorMetadata.teacherScope]
    GUARD[GuardianActorMetadata.guardianScope]
    STUD[StudentActorMetadata.studentScope]
  end

  subgraph layer1 [Layer 1 — Operation module gate NEW]
    OP[operationModule OperationRef]
    OP -->|staff| AUTH[authorize Permission]
    OP -->|teacher| TC[assertTeaching / Homeroom anyOf]
    OP -->|guardian| GC[assertGuardianCapability]
    OP -->|student| SC[assertStudentCapability]
  end

  subgraph layer2 [Layer 2 — Resource policy REFACTORED]
    COMPOSE[policy/compose.ts]
    COMPOSE --> SS[staff strategy]
    COMPOSE --> TS[teacher strategy]
    COMPOSE --> GS[guardian strategy]
    COMPOSE --> STS[student strategy]
  end

  credentials --> layer1 --> layer2
```

### 3.1 Operation type (layer 1 vocabulary)

```typescript
/** Declarative cross-actor gate. Defined in authorization/operations/*.ts */
type OperationDefinition = {
  readonly id: string
  readonly staff?: StaffOperationRule
  readonly teacher?: TeacherOperationRule
  readonly guardian?: PortalOperationRule<GuardianCapability>
  readonly student?: PortalOperationRule<StudentCapability>
}

type StaffOperationRule = {
  readonly permission: Permission
  readonly scopeFrom?: OperationTargetKey   // optional request-scope binding
}

type TeacherOperationRule =
  | { readonly capability: TeachingCapability; readonly target: OperationTargetKey }
  | { readonly capability: HomeroomCapability; readonly target: OperationTargetKey }
  | { readonly anyOf: readonly TeacherOperationRule[] }

type PortalOperationRule<C extends string> = {
  readonly capability: C
  readonly target?: OperationTargetKey
}

type OperationTargetKey =
  | 'student'
  | 'classGroup'
  | 'classSubject'
  | 'none'

/** Runtime input when scope is entity-derived (save/delete gates) */
type OperationContext = {
  readonly studentId?: string
  readonly classGroupId?: string
  readonly classSubjectId?: string
}
```

Public API:

```typescript
// gates/operation-module.ts
export function operationModule(
  operation: OperationRef,
  context?: OperationContext | ((actor: ActorMetadata) => OperationContext),
): (actor: ActorMetadata) => void

export function anyOperationModule(
  operations: readonly OperationRef[],
  context?: OperationContext | ((actor: ActorMetadata) => OperationContext),
): (actor: ActorMetadata) => void
```

`operationModule` replaces `permissionAction`, `anyPermissionAction`, and all `*WriteModule` / `*ReadModule` helpers for migrated operations.

### 3.2 Policy strategies (layer 2)

```typescript
// policy/strategies/student-access/types.ts
export type StudentAccessStrategy = (
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: SchoolRepositories,
) => Promise<void>

// policy/strategies/student-access/index.ts
const strategies: Record<InteractiveActorKind, StudentAccessStrategy> = {
  staff: staffStudentAccess,
  teacher: teacherStudentAccess,
  guardian: guardianStudentAccess,
  student: studentSelfStudentAccess,
}

export async function checkStudentAccess(actor, studentIds, repos) {
  if (studentIds.length === 0) return
  return strategies[actor.kind](actor, studentIds, repos)
}
```

`AuthorizationPolicy` interface stays stable; factory wires compose functions.

### 3.3 Entity config shape (target)

```typescript
import { GradeOperations } from '@edaya/core/authorization/operations'
import { operationModule, resourceGate, write } from '@edaya/core/authorization/gates'

export const assessmentResultConfig = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessmentResults,
    tenant: assessmentResultTenant(),
    read: read(
      anyOperationModule([GradeOperations.read, AssessmentOperations.read]),
      resourceGate(policy.checkAssessmentAccess, e => e.assessmentId, { via: 'assessment' }),
    ),
    write: write(
      operationModule(GradeOperations.input, entity => ({ classSubjectId: entity._resolvedClassSubjectId })),
      resourceGateForSave(GradeOperations.input, policy, resolveAssessmentResultContext),
      resourceGateForDelete(GradeOperations.input, policy, resolveAssessmentResultContext),
    ),
    gates: { preSave: validateAssessmentResultSave, preDelete: validateAssessmentResultDelete },
    atomicExecution,
  })
```

Domain files declare **what** operation + **which resource keys**; they never branch on `actor.kind`.

### 3.4 Package layout

```
package/domain-core/src/capabilities/authorization/
├── operations/
│   ├── define-operation.ts       # OperationDefinition builder + OperationRef registry
│   ├── grades.ts
│   ├── assessments.ts
│   ├── attendance.ts
│   ├── discipline.ts
│   ├── report-cards.ts
│   ├── communications.ts
│   ├── workspace.ts
│   ├── attachments.ts
│   ├── finance.ts
│   ├── scheduling.ts
│   ├── access-control.ts
│   └── index.ts                  # re-export all OperationRefs
├── gates/
│   ├── operation-module.ts       # layer 1 entry
│   ├── resource-gate.ts          # layer 2 composables for entity configs
│   └── index.ts
├── policy/
│   ├── strategies/
│   │   ├── student-access/
│   │   │   ├── staff.ts
│   │   │   ├── teacher.ts
│   │   │   ├── guardian.ts
│   │   │   ├── student.ts
│   │   │   └── index.ts
│   │   ├── class-group-access/
│   │   ├── assessment-access/
│   │   ├── attendance-access/
│   │   ├── fee-access/
│   │   ├── attachment-access/
│   │   └── report-card-access/
│   ├── compose.ts                # only file that switches on actor.kind for policy
│   ├── types.ts                  # AuthorizationPolicy interface (unchanged surface)
│   └── create-repository-authorization-policy.ts
├── capabilities/                 # unchanged — enums + assert*
├── permissions/                  # unchanged — staff-only catalog
└── resolution/                   # unchanged — session scope preload
```

`application/entities/entity-config/authorization.ts` becomes thin re-exports from `gates/` during migration, then deprecated.

---

## 4. Operation catalog (initial inventory)

Operations are grouped by domain fold. Each row becomes one `OperationDefinition` (read and write are separate operations).

| Group | Operation ID | Replaces (module gate) | Staff permission | Portal capability |
|-------|--------------|------------------------|------------------|-------------------|
| **Grades** | `grades.read` | `permissionAction(GRADE_READ)`, teacher read | `GRADE_READ` | Guardian/Student `ReadGrades`; Teacher teaching/homeroom read |
| | `grades.input` | `gradeInputWriteModule` | `GRADE_INPUT` | Teacher `InputGrade` (classSubject) |
| **Assessments** | `assessments.read` | `ASSESSMENT_ACCESS_PERMISSIONS` | various read perms | Teacher roster read |
| | `assessments.manage` | `assessmentWriteModule`, `authorizeTeacherAssessmentSave/Delete` | `GRADE_INPUT` / structure perms | Teacher create/update subject assessment |
| **Attendance** | `attendance.read` | `permissionAction(ATTENDANCE_READ)` | `ATTENDANCE_READ` | Teacher subject/class read |
| | `attendance.record` | `attendanceRecordWriteModule` | `ATTENDANCE_RECORD` | Teacher session or daily (anyOf) |
| **Discipline** | `discipline.read` | `disciplineReadModule` | `DISCIPLINE_READ` | Teacher assignment gate |
| | `discipline.create` | `disciplineCreateModule` | `DISCIPLINE_CREATE` | Teacher subject or class incident |
| **Report cards** | `report-cards.read` | `reportCardReadModule` | `QUERY_REPORT_CARD_DETAIL_READ` | Teacher overview / subject |
| | `report-cards.comment` | `reportCardCommentWriteModule` | `REPORT_CARD_PUBLISH` (staff) | Teacher comment capabilities |
| **Workspace** | `workspace.read` | `workspaceReadModule` | `QUERY_WORKSPACE_READ` | Portal `ReadWorkspaceShell` |
| **Attachments** | `attachments.read` | `attachmentReadModule` | `ATTACHMENT_READ` | Portal `ReadAttachments` |
| **Finance** | `payments.read` | `permissionAction(PAYMENT_READ)` | `PAYMENT_READ` | Guardian/Student `ReadPayments` |
| **Scheduling** | `timetable.read` | `permissionAction(QUERY_TIMETABLE_READ)` | `QUERY_TIMETABLE_READ` | Portal + teacher |
| **Access control** | `access-control.assign` | `permissionAction(ACCESS_CONTROL_ASSIGN)` | staff only | — |
| **Teacher self** | `teacher.self-read` | `teacherSelfReadModule` | staff perms OR teacher pass-through | teacher always allowed |

Full enumeration of entity configs using `permissionAction` / `anyPermissionAction` (~55 files) is migrated fold-by-fold in §6.

---

## 5. Policy strategy inventory

| Resolver (public) | Strategy folder | Notes |
|-------------------|-----------------|-------|
| `checkStudentAccess` | `student-access/` | Extract from `policy/resolvers/student.ts` |
| `checkGuardianAccess` | `guardian-access/` | Self + staff admin |
| `checkClassGroupAccess` | `class-group-access/` | Staff grants + teacher homeroom/teaching |
| `checkAssessmentAccess` | `assessment-access/` | classSubject path |
| `checkAttendanceAccess` / `checkAttendanceRecordAccess` | `attendance-access/` | Merge scheduling branches |
| `checkFeeAccess` / `checkStudentFeeAccess` | `fee-access/` | Remove `isPortalActor`; delegate per kind |
| `checkAttachmentAccess` | `attachment-access/` | Remove `isPortalActor` |
| `checkReportCardResultAccess` | `report-card-access/` | Teacher draft comment scope |
| `checkLessonSessionAccess` | `scheduling-access/` | Teacher assignment |
| `checkStudentNoteAccess` | `student-note-access/` | Staff-only + student path |
| `checkStudentHealthAccess` | stays staff-only | No portal path |

`policy/compose.ts` is the **only** policy file that reads `actor.kind` for dispatch (plus system-actor short-circuit).

---

## 6. Implementation folds

Folds are ordered by dependency. Each fold ships with tests (§7) and updates static guards before merge.

```mermaid
flowchart TD
  G0[G0: Test harness + static guards]
  G1[G1: Operations framework]
  G2[G2: Grades + assessments reference]
  G3[G3: Policy strategies — student + class]
  G4[G4: Remaining operations]
  G5[G5: Entity + workflow sweep]
  G6[G6: Deprecate shims + docs]

  G0 --> G1
  G1 --> G2
  G1 --> G3
  G2 --> G4
  G3 --> G4
  G4 --> G5
  G5 --> G6
```

**G2 and G3 can run in parallel** after G1.

---

### Fold G0 — Test harness and static guards

**Goal:** Establish shared test infrastructure and CI rules before moving production code.

| Task | Path / action |
|------|----------------|
| G0.1 | Add `tests/support/authorization-fixtures.ts` — unified actor builders (staff, teacher, guardian, student, system) |
| G0.2 | Add `tests/support/operation-matrix.ts` — parametric runner for operation × actor × expect allow/deny |
| G0.3 | Add `tests/support/policy-fixtures.ts` — minimal in-memory `SchoolRepositories` stubs per strategy |
| G0.4 | Extend `authorization-migration-coverage.test.ts`: forbid `actor.kind` in `src/domain/**` (allowlist during migration) |
| G0.5 | Extend coverage test: forbid new `*WriteModule` / `*ReadModule` exports in `entity-config/authorization.ts` after G1 |
| G0.6 | Extend coverage test: forbid `isPortalActor` outside `policy/strategies/` (allowlist legacy files until G3) |

**Acceptance**

- [ ] `bun --filter @edaya/core test tests/support/` passes
- [ ] Static guards green with explicit allowlists documented in test file comments

---

### Fold G1 — Operations framework

**Goal:** Ship `defineOperation`, `operationModule`, `anyOperationModule` with no entity migrations yet.

| Task | Path / action |
|------|----------------|
| G1.1 | Implement `operations/define-operation.ts` — builder, validation (at least one actor path), `OperationRef` registry |
| G1.2 | Implement `gates/operation-module.ts` — staff `authorize`, portal `assertCapability`, teacher `anyOf` |
| G1.3 | Wire `OperationContext` resolution from entity fields |
| G1.4 | Implement `gates/resource-gate.ts` — `resourceGate`, `resourceGateForSave`, `resourceGateForDelete` |
| G1.5 | Unit tests: `tests/unit/auth/operations/operation-module.test.ts` |
| G1.6 | Unit tests: `tests/unit/auth/operations/define-operation.test.ts` — invalid defs rejected at import/define time |
| G1.7 | Export from `@edaya/core` authorization index |

**Acceptance**

- [ ] `operationModule` passes parity with `permissionAction` for one pilot operation (`workspace.read`) in test only
- [ ] Teacher `anyOf` (teaching miss → homeroom hit) covered by matrix test

---

### Fold G2 — Reference slice: grades + assessments

**Goal:** End-to-end reference implementation touching all three paths and write gates.

| Task | Path / action |
|------|----------------|
| G2.1 | Define `GradeOperations`, `AssessmentOperations` in `operations/grades.ts`, `operations/assessments.ts` |
| G2.2 | Migrate `assessment-result.ts` — remove `actor.kind` branches; use operations + resource gates |
| G2.3 | Migrate `assessment.ts` entity config |
| G2.4 | Migrate `class-subject-progress.ts` teacher branches |
| G2.5 | Delete `gradeInputWriteModule`, `assessmentWriteModule`, `authorizeTeacherAssessmentSave/Delete` after migration |
| G2.6 | Operation matrix tests: `tests/unit/auth/operations/grades.operations.test.ts` |
| G2.7 | Parity window test: old vs new module gate for grades (delete after G5) |

**Acceptance**

- [ ] No `actor.kind` in `domain/assessments/**`
- [ ] Existing `teacher-capability-gates.test.ts` scenarios covered by operation matrix
- [ ] `assessment-result` save/delete: staff class-scoped, teacher classSubject-scoped, guardian denied

---

### Fold G3 — Policy strategies: student + class group

**Goal:** Decompose the largest god-functions; unlock cleaner finance/scheduling migrations.

| Task | Path / action |
|------|----------------|
| G3.1 | Extract `policy/strategies/student-access/{staff,teacher,guardian,student}.ts` from `resolvers/student.ts` |
| G3.2 | Extract `policy/strategies/class-group-access/` from academic + scheduling resolvers |
| G3.3 | Add `policy/compose.ts`; thin wrappers keep `checkStudentAccess` signature |
| G3.4 | Split `repository-authorization-policy.test.ts` → `tests/unit/auth/policy/student-access.test.ts`, `class-group-access.test.ts` |
| G3.5 | Per-strategy tests use `policy-fixtures.ts` stubs (no full repo graph unless integration) |
| G3.6 | Delete duplicated cases from monolithic policy test as slices land |

**Acceptance**

- [ ] `checkStudentAccess` implementation is only compose + strategies (no inline kind switches)
- [ ] Policy test file count increases, total LOC decreases ≥20%
- [ ] All former `repository-authorization-policy` student/class cases still pass

---

### Fold G4 — Remaining operations + policy strategies

**Goal:** Complete operation catalog and policy strategy folders.

| Task | Domain area |
|------|-------------|
| G4.1 | `attendance.ts` operations + `attendance-access/` strategies |
| G4.2 | `discipline.ts` operations; migrate `incident.ts` |
| G4.3 | `report-cards.ts` operations; migrate `report-card-result.ts` |
| G4.4 | `finance.ts` operations + `fee-access/`; remove `isPortalActor` |
| G4.5 | `attachments.ts` + `attachment-access/` |
| G4.6 | `scheduling.ts` + `scheduling-access/` |
| G4.7 | `communications.ts`, `workspace.ts`, `access-control.ts` |
| G4.8 | Operation matrix test file per operations module |

**Acceptance**

- [ ] Zero `isPortalActor` in `policy/resolvers/`
- [ ] `teacher-portal-read-gates.test.ts` replaced by operation matrix tests (file deleted)
- [ ] `portal-permission-map.ts` used only inside `operations/` (not from entity configs)

---

### Fold G5 — Entity config and workflow sweep

**Goal:** Migrate remaining ~50 `permissionAction` call sites.

| Batch | Files (representative) |
|-------|------------------------|
| B1 — School structure | `class-group.ts`, `staff-assignment.ts`, `teacher-assignment.ts`, `school.ts`, `academic-year.ts` |
| B2 — Students | `student.ts`, `guardian.ts`, `guardian-student-link.ts`, `student-class-enrollment.ts`, `student-disciplinary-action.ts` |
| B3 — Scheduling | `schedule.ts`, `lesson-session.ts`, `activity-session.ts`, `attendance-record.ts`, `attendance.ts` |
| B4 — Finances | `fee.ts`, `student-fee.ts`, `payment.ts` |
| B5 — Workflows | `student.ts`, `communications.ts`, `scheduling.ts`, `academics.ts`, `setup.ts`, `access-control.ts` |

| Task | Action |
|------|--------|
| G5.1 | Migrate batch B1; run `bun --filter @edaya/core test` |
| G5.2–G5.5 | B2–B5 sequentially or parallel PRs per batch |
| G5.6 | Remove `permissionAction` / `anyPermissionAction` from `entity-config/authorization.ts` (re-export only) |
| G5.7 | Tighten static guard: **zero** `actor.kind` in `src/domain/**` (remove allowlist) |
| G5.8 | Tighten static guard: **zero** `permissionAction` in `src/domain/**` and `src/application/workflows/**` |

**Acceptance**

- [ ] `authorization-migration-coverage` passes with no allowlists
- [ ] `bun repo verify` green
- [ ] Integration auth tests in `tooling/integration-tests/src/auth/` unchanged behavior

---

### Fold G6 — Deprecation and documentation

| Task | Action |
|------|--------|
| G6.1 | Mark `permissionAction` `@deprecated` → remove after one release |
| G6.2 | Update `authorization/README.md` — operations model, corrected design principles |
| G6.3 | Add “Adding a new operation” section to README (replaces “Adding a new permission” for entity gates) |
| G6.4 | Link this plan from `relationship-native-auth-plan.md` as enforcement follow-up |
| G6.5 | Delete parity window tests from G2 |
| G6.6 | Optional: `GET /me/capabilities` documents operation IDs for portal (out of scope unless mobile needs it) |

**Acceptance**

- [ ] README no longer claims single `authorize()` path for all actors
- [ ] No deprecated shim exports without `@deprecated` JSDoc and tracking issue

---

## 7. Domain unit testing surface optimization

Today auth tests sprawl across **24 files** with duplicated actor factories, permission-shim tests (`teacher-portal-read-gates.test.ts`), and a **600+ line** `repository-authorization-policy.test.ts`. Entity domain tests rarely assert auth (correct — auth belongs in authorization package). This fold optimizes for **fewer, denser, better-located tests**.

### 7.1 Target test pyramid

```
                    ┌─────────────────────────┐
                    │  Integration (unchanged) │  tooling/integration-tests/src/auth/
                    │  session → scope → API    │  ~10 scenarios, full HTTP + DB
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │     Policy compose smoke (thin)    │  1 file, ~15 cases
              └─────────────────┬─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
 ┌──────┴──────┐      ┌─────────┴────────┐    ┌────────┴────────┐
 │  Operation  │      │ Policy strategy  │    │ Resolution +  │
 │   matrix    │      │  per actor kind  │    │ grants (keep) │
 │  per module │      │  per resource    │    │               │
 └─────────────┘      └──────────────────┘    └───────────────┘
```

| Layer | What to test | What **not** to test |
|-------|--------------|----------------------|
| Operation matrix | Allow/deny per actor kind for each `OperationRef` | Individual entity config wiring |
| Policy strategy | One kind + one resource graph scenario per file | Full cross-product in one file |
| Compose smoke | Dispatch reaches correct strategy; system actor bypass | Business logic duplicated from strategies |
| Resolution / grants | Keep existing `effective-grants.test.ts`, `resolve-portal-scopes.test.ts` | — |
| Entity domain | Business rules only (`preSave` immutability) | `actor.kind` branches |
| Static guards | CI forbids regression patterns | — |

### 7.2 Shared fixtures (`tests/support/authorization-fixtures.ts`)

Consolidate factories currently duplicated in `repository-authorization-policy.test.ts`, `teacher-portal-read-gates.test.ts`, `teacher-capability-gates.test.ts`:

```typescript
export const AuthFixtures = {
  staff: {
    elevated: () => ActorMetadata,
    withPermissions: (perms: Permission[], scope?: ScopeFixture) => ActorMetadata,
    coordinator: (classGroupId: string) => ActorMetadata,
  },
  teacher: {
    subject: (classSubjectId: string) => ActorMetadata,
    homeroom: (classGroupId: string) => ActorMetadata,
    unassigned: () => ActorMetadata,
    both: (classSubjectId: string, classGroupId: string) => ActorMetadata,
  },
  guardian: {
    linkedTo: (studentId: string, classGroupId?: string) => ActorMetadata,
  },
  student: {
    enrolledIn: (classGroupId: string) => ActorMetadata,
  },
}
```

Migrate existing tests to `AuthFixtures` as files are touched; do not big-bang refactor all 24 files in G0.

### 7.3 Operation matrix runner (`tests/support/operation-matrix.ts`)

Parametric tests replace permission-shim tests and reduce case duplication:

```typescript
describeOperationMatrix(GradeOperations.read, [
  { actor: () => AuthFixtures.staff.withPermissions([Permission.GRADE_READ]), expect: 'allow' },
  { actor: () => AuthFixtures.teacher.subject('cs-math'), expect: 'allow', context: { classSubjectId: 'cs-math' } },
  { actor: () => AuthFixtures.teacher.unassigned(), expect: 'deny' },
  { actor: () => AuthFixtures.guardian.linkedTo('student-1'), expect: 'allow', context: { studentId: 'student-1' } },
  { actor: () => AuthFixtures.guardian.linkedTo('student-2'), expect: 'deny', context: { studentId: 'student-1' } },
])
```

**Rules**

- One matrix file per operations module: `tests/unit/auth/operations/<module>.operations.test.ts`
- Matrix rows are data, not copy-pasted `test()` blocks
- Negative cases must name the **failing path** (wrong student, wrong classSubject, missing assignment)

### 7.4 Policy strategy test layout

```
tests/unit/auth/policy/
├── compose.smoke.test.ts           # thin dispatch verification
├── student-access/
│   ├── staff.test.ts
│   ├── teacher.test.ts
│   ├── guardian.test.ts
│   └── student.test.ts
├── class-group-access/
│   └── ...
└── fee-access/
    └── ...
```

Each strategy file:

- Uses `policy-fixtures.ts` — minimal mock repos (only methods the strategy calls)
- **≤ 80 LOC** target; split by scenario if larger
- No staff grant resolution unless testing staff strategy (inject grants directly, do not call `resolveEffectiveGrants` unless testing resolution integration)

### 7.5 Tests to delete or merge (net reduction target)

| File | Action |
|------|--------|
| `teacher-portal-read-gates.test.ts` | **Delete** after `workspace.operations.test.ts` + read ops matrix cover same cases |
| `portal-permission-policy.test.ts` | **Merge** into operation matrices for guardian/student read ops |
| `repository-authorization-policy.test.ts` | **Shrink** to compose smoke (~100 LOC); move cases to strategy files |
| `teacher-capability-gates.test.ts` | **Keep** low-level `assertTeachingCapability` edge cases; duplicate operation-level cases removed |
| `permission-engine-parity.test.ts` | **Keep** — staff `authorize()` only |

**Target:** auth unit test LOC −25% vs baseline; file count +~8 (operations/ + policy/), monolith −1.

### 7.6 Parity window (G2 only)

During G2, temporary test file `grades.operations.parity.test.ts`:

```typescript
// For each migrated operation, assert operationModule and legacy permissionAction
// agree on allow/deny for a shared fixture set. Delete in G6.
```

Prevents silent behavior drift while entity configs still partially migrated.

### 7.7 Static guards (CI — extend `authorization-migration-coverage.test.ts`)

| Guard | Enforced after |
|-------|----------------|
| No `actor.kind` in `src/domain/**` | G5 (allowlist G0–G4) |
| No `permissionAction` in entity configs / workflows | G5 |
| No new `*Module()` helpers in `entity-config/authorization.ts` | G1 |
| No `isPortalActor` outside strategies | G4 |
| Operations must have ≥1 actor path defined | G1 (AST check on `defineOperation` calls) |
| Every `OperationRef` has a matrix test file | G4 (registry cross-check) |

### 7.8 What we explicitly do not add

- **Per-entity authorization unit tests** — if `assessment-result.ts` only wires `GradeOperations.input`, testing belongs in `grades.operations.test.ts` + `assessment-access/` strategy tests
- **Full managed-entity-service auth integration tests per entity** — integration auth harness is sufficient
- **Duplicated mobile portal parity** — `fold-f-parity.test.ts` stays; operation matrices subsume permission-map parity

### 7.9 Verification commands

```sh
# Package auth tests only
bun --filter @edaya/core test tests/unit/auth/

# Static guards
bun --filter @edaya/core test tests/unit/auth/authorization-migration-coverage.test.ts

# Full verify before PR
bun repo verify
```

---

## 8. Multi-profile and link-based access (no special cases)

| Scenario | Enforcement behavior |
|----------|---------------------|
| Coordinator + teacher, same `subjectId` | Each request uses one `X-Actor-Kind`; operations evaluate that actor only |
| Guardian link to student | `guardianScope.studentIds` checked in guardian strategy; operation `context.studentId` for targeted reads |
| Student self | `studentScope.studentId` in student strategy |
| Teacher homeroom + subject same class | Operation `anyOf` tries teaching then homeroom — no entity branching |
| Staff with class_group grant | Staff strategy uses grant paths + enrollment lookup (unchanged logic, moved file) |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Behavior drift during migration | G2 parity window; batch PRs with integration auth run |
| Operation catalog sprawl | Group by domain file; `OperationRef` registry + matrix coverage guard |
| Teacher context missing on write | `OperationContext` required fields validated in `defineOperation` for write ops |
| Large PR for G5 | Split into B1–B5 batches per §6 |
| README / AGENTS drift | G6 doc fold mandatory before closing epic |

---

## 10. Out of scope

- Webapp `/me/permissions` → `/me/capabilities` UI (mobile may already use scope endpoints)
- Custom per-school operation sets
- Folding staff and teacher into one actor type
- Re-synthesizing portal `EffectiveGrants`
- Performance work on policy resolvers (orthogonal; strategies may help profiling)

---

## 11. Definition of done (epic)

- [ ] All entity configs and workflows use `operationModule` / `anyOperationModule`
- [ ] Zero `actor.kind` switches in `src/domain/**`
- [ ] Policy resolvers decomposed into strategies; `compose.ts` sole dispatcher
- [ ] `permissionAction` and `*WriteModule` helpers removed or deprecated with no call sites
- [ ] Operation matrix tests cover every `OperationRef`
- [ ] Auth unit test LOC reduced ≥25% vs 2026-07-06 baseline
- [ ] `authorization/README.md` reflects operations model
- [ ] `bun repo verify` green
- [ ] Portal actors verified per [edaya_web demo-accounts.md](../../../edaya_web/docs/reference/demo-accounts.md) after G5

---

## 12. Suggested first PR (G0 + G1 + G2 partial)

Smallest valuable slice:

1. G0 fixtures + static guard allowlists
2. G1 `defineOperation` + `operationModule`
3. G2 `GradeOperations.read` + `GradeOperations.input` only
4. Migrate `assessment-result.ts` as reference entity
5. `grades.operations.test.ts` matrix + parity window

Estimated size: ~800–1200 LOC production + ~400 LOC tests. Validates the pattern before G3–G5 scale-up.

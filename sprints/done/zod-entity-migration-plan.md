# Zod Entity Schema Migration Plan

This document outlines the step-by-step action plan for migrating the domain model in `package/domain-core` to a Zod-wrapped schema design. The migration unifies schema definitions, type inference, creation/update DTOs, and runtime validation into a single source of truth across the core domain, API route validations, and database adaptors.

**Canonical location:** `package/domain-core/src/domains/` (replaces the former `package/domain-core/src/entities/` tree). Entity configs (`*Config`) are co-located in the same domain files.

---

## 1. Objectives

1. **Eliminate schema & type duplication**: Define fields once in Zod, infer types, and derive create/update schemas — without parallel `*Args` interfaces.
2. **Centralize validation**: Let Zod handle constructor validation, parsing, and defaults, throwing `DomainValidationError` at domain boundaries.
3. **Downstream API & OpenAPI reusability**: Export derived schemas (e.g. `classSubjectCreateSchema`) for Hono JSON body validation and OpenAPI generation in `apps/api`.
4. **Preserve compatibility**: Keep getter properties on domain classes so callers can continue using `entity.field` (not only `entity.data.field`).

---

## 2. Architecture

Each domain entity lives in `package/domain-core/src/domains/<area>/<name>.ts` with schema, class, and (where applicable) `*Config` in one file:

```typescript
import { z } from 'zod'
import { DomainValidationError, formatZodError, parseDomain } from '../utils'

// 1. Core schema
export const classSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive().nullable().optional(),
  completedPercentage: z.number().min(0).max(100).default(0),
  createdAt: zodDate().default(() => new Date()),
})

// 2. Type inference (no separate Args interface)
export type ClassSubjectData = z.infer<typeof classSubjectSchema>
export type ClassSubjectInput = z.input<typeof classSubjectSchema>

// 3. Derived downstream schemas
export const classSubjectCreateSchema = classSubjectSchema.omit({ createdAt: true })
export const classSubjectUpdateSchema = classSubjectSchema.partial().required({ id: true })

// 4. Domain class
export class ClassSubject {
  readonly data: ClassSubjectData

  constructor(args: ClassSubjectInput) {
    this.data = parseDomain(classSubjectSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  // ...
}
```

**Adaptor layer:** `createDefaultMappers` in `@edaya/adaptor-postgres` reads/writes `entity.data` when present, then reconstructs via the entity constructor (Zod parse on read).

**API layer:** `apps/api/src/validation/*.schemas.ts` derives OpenAPI schemas from core using `unwrapShape()` to bridge `zod` (core) and `@hono/zod-openapi` (API).

---

## 3. Migration phases

### Phase 1: Core foundation — Done

- [x] Add `zod` to `package/domain-core/package.json`.
- [x] `DomainValidationError`, `formatZodError`, `zodDate()` in `package/domain-core/src/domains/utils.ts`.

### Phase 2: Pilot entity — Done

- [x] Pilot entities (`ClassSubject`, `GradeLevel`, …) migrated and compiling.

### Phase 3: Adaptor alignment — Done

- [x] `createDefaultMappers` supports `entity.data` for toRow/toDomain.
- [x] Custom mappers retained only where needed (e.g. JSONB `roles` on `StaffMember`).

### Phase 4: Test validation — Done

- [x] Unit and integration tests green for migrated entities.

### Phase 5: Full rollout — Done

- [x] **Group A (Academics & School):** ClassGroup, Subject, GradeLevel, School, AcademicYear, AcademicPeriod, ClassSubject, ClassSubjectMatter, ClassSubjectProgress.
- [x] **Group B (Students & Guardians):** Student, Guardian, StudentClassEnrollment, GuardianStudentLink, GuardianContactMethod (embedded).
- [x] **Group C (Finances):** Fee, StudentFee, Payment (+ nested installment templates).
- [x] **Group D (Scheduling & Assessments):** Session, Assessment, AssessmentResult, AttendanceRecord, CalendarEvent, PeriodDefinition, Schedule, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResultSection, ReportCardResult.
- [x] **Group E (Messaging & System):** Announcement, AnnouncementTarget, MessageDelivery, Attachment, StaffMember, DisciplinaryAction, Incident, StudentDisciplinaryAction, StudentIncidentInvolvement, StudentNote, StudentHealthProfile, AccessRole, GradeScale, Resource, ResourceAssignment, StaffAssignment, StaffRoleAssignment.
- [x] Remove `package/domain-core/src/entities/`; export from `package/domain-core/src/domains/`.
- [x] Co-locate `*Config` factories in domain files (remove `services/entity-configs/`).

### Phase 6: Downstream API integration — Done

- [x] `entities.schemas.ts` — 40+ response schemas derived from core via `unwrapShape()`.
- [x] `commands.schemas.ts` — 60+ command schemas derived from core via `unwrapShape()`.
- [x] `unwrapShape()` in `apps/api/src/validation/utils/schema-fields.ts` (handles `ZodEffects` across module instances).
- [x] Removed duplicate hand-written API entity definitions.
- [x] Full monorepo verification: `bun run check` (6/6) and `bun run test` (446 tests).

---

## 4. Phase 7: Full cleanup

Phases 1–6 delivered a working Zod-first domain. Phase 7 removes remaining duplication, aligns naming, and hardens the core ↔ API contract. Work in small PRs; keep `bun run fullcheck` green after each.

### 7.1 Shared parsing utilities

**Goal:** One constructor pattern everywhere; no copy-pasted `safeParse` blocks.

- [x] Add `parseDomain<T>(schema, input): T` in `domains/utils.ts` (wraps `safeParse` → `DomainValidationError` via `formatZodError`).
- [x] Add `parseDomainOptional` / `safeParseDomain` only if a real call site needs it (avoid premature abstraction) — skipped; no call sites yet.
- [x] Migrate all domain class constructors to use `parseDomain` (mechanical find/replace per file).
- [x] Document in this file that `z.input<typeof schema>` is the constructor argument type (pre-parse), `z.infer` is `data` (post-parse).

**Constructor typing convention:** Use `z.input<typeof fooSchema>` for pre-parse constructor args (accepts coercions/defaults) and `z.infer<typeof fooSchema>` (or a narrowed `FooData`) for `readonly data` after `parseDomain`.

**Exit criteria:** No raw `safeParse` in `package/domain-core/src/domains/` except inside `parseDomain`. ✅

### 7.2 Remove redundant `*Args` interfaces

**Goal:** Single type source per entity (`*Data` / `*Input` from Zod).

- [x] For each domain file, delete `export interface FooArgs` where it mirrors the schema.
- [x] Replace constructor signatures: `constructor(args: FooInput)` where `FooInput = z.input<typeof fooSchema>`.
- [x] Replace exported `FooArgs` references in services, tests, and API type imports with `FooInput` (constructors/commands) or `FooData` where post-parse shape is needed.
- [x] For nested embeds (`FeeInstallmentTemplate`, `GradeScaleRange`, `StudentFeeInstallment`), use `z.infer<typeof …Schema>` instead of parallel interfaces.
- [x] Run `bun run check` and fix breakages in `@edaya/core`, `@edaya/adaptor-postgres`, `apps/api`.

**Naming convention:** `FooInput` = pre-parse constructor/command args (`z.input<typeof fooSchema>`); `FooData` = post-parse entity `data` (often `z.infer`, sometimes narrowed e.g. `Money` fields).

**Exit criteria:** `rg 'export interface \\w+Args' package/domain-core/src/domains` returns empty. ✅

### 7.3 Value objects & computed types

**Goal:** Zod coverage for all validated domain shapes, including non-persisted value objects.

| Item | Location | Action |
|------|----------|--------|
| `Money` | `value_object/money.ts` | Add `moneySchema`; class uses `parseDomain`; keep behavior methods (`add`, `subtract`). |
| `AttendanceSummary` | `value_object/attendance-summary.ts` | Add `attendanceSummarySchema` with cross-field rule (`excusedAbsenceCount ≤ absenceCount`); export schema for API if used in responses. |
| Embedded types | `guardian-contact-method.ts`, `report-card-result-section.ts`, etc. | Already Zod-backed; document as **embed schemas** (no create/update exports required unless exposed as standalone API resources). |

- [x] Migrate `Money` and `AttendanceSummary` to Zod.
- [x] Export schemas from `@edaya/core` if referenced by `entities.schemas.ts` (`moneySchema`, `attendanceSummarySchema`).
- [x] Remove `requireNonBlank` / `requireNonNegativeInt` usage from value objects once Zod covers those rules.

**Exit criteria:** `package/domain-core/src/value_object/` has no manual field validators except domain methods that are not schema concerns. ✅

### 7.4 Retire legacy validation helpers

**Goal:** Zod is the primary validator; legacy helpers exist only for non-schema code paths during transition.

- [x] Audit `requireNonBlank`, `requireValidDate`, etc. in `domains/utils.ts`.
- [x] Remove helpers with zero remaining call sites after 7.2–7.3 (`requireOptionalNonBlank`, `requireNonNegative*`, `requirePositive*`, `requireTimeOfDay`).
- [x] Keep `zodDate()`, `normalizeDate()`, `isSameDate()`, `roundTo2()` — these are schema/domain utilities, not duplicate validators.
- [x] Ensure `DomainValidationError` is the only error type thrown for invalid domain input (constructors use Zod; remaining `throw new Error` are state-machine / operation guards, not input validation).

**Retained (documented):** `requireNonBlank` and `requireValidDate` in `authorization/actor-metadata.ts` only — migrate to Zod when actor metadata gets schemas.

**Exit criteria:** Grep for `requireNonBlank` under `domains/` and `value_object/` returns empty (definitions in `utils.ts` are deprecated re-exports for auth only). ✅

### 7.5 API ↔ core schema contract

**Goal:** API command/response shapes stay derived from core; no silent drift from `field.*` overlays.

- [x] Inventory command schemas that use `field.*` extensions instead of pure `unwrapShape(coreSchema)` — classify each as **intentional API-only** (e.g. command id wrappers) vs **drift risk**.
- [x] For drift-risk fields, move constraints into core schema or document why API layer must differ (documented via `allowedOmissions` in parity tests).
- [x] Add a small test suite (`apps/api/tests/validation/core-schema-parity.test.ts`) that asserts key command schemas include at least the same required keys as core create schemas.
- [ ] Prefer `zodDate()` / core coercions over duplicate `z.coerce.date()` in API `field.date()` where types must match DB round-trips.

**Intentional API-only omissions (parity tests):** `enrollmentIndex` / `enrolledAt` on enroll; `date` on record attendance; `currency` / status / audit fields on record payment; optional profile fields omitted on register student.

**Exit criteria:** Documented list of intentional API-only extensions; parity tests for top ~10 high-traffic commands (school, student, enrollment, payment, attendance). ✅ (5 commands covered)

### 7.6 Tests & documentation alignment

**Goal:** Repo layout matches mental model (`domains`, not `entities`).

- [x] Rename `package/domain-core/tests/unit/entities/` → `package/domain-core/tests/unit/domains/` (update imports only if paths change).
- [x] Rename `utils.test.ts` to live beside `domains/utils.ts` or under `tests/unit/domains/`.
- [x] Delete stale artifacts (`package/domain-core/test_output.txt` and any CI logs referencing `src/entities`).
- [ ] Update internal docs (`sevice_model_improvement.md`, README snippets) that still say `entities/`.
- [x] Add a short `package/domain-core/src/domains/README.md` describing: schema → class → config → exports.

**Exit criteria:** No references to `src/entities` in docs or active test paths (migration plan history lines excepted).

### 7.7 Adaptor & persistence hardening

**Goal:** Consistent row ↔ domain mapping; no bypass of Zod on read.

- [x] Audit custom `toRow`/`toDomain` mappers in `postgres-repositories.ts` — convert to `createDefaultMappers` where possible (Money/JSONB/junction-table stores remain custom; documented inline).
- [x] For JSONB columns (`permissions`, `scopeGrants`, `roles`, `installments`), ensure `deserializeJsonb` + constructor path always runs Zod parse.
- [x] Add one integration test per JSONB-heavy entity proving invalid stored JSON fails on read with `DomainValidationError` (`Fee`, `AccessRole`, `StaffRoleAssignment` in `integration-tests/src/adaptor/jsonb-read-validation.integration.test.ts`).

**Adaptor helpers:** `rowToConstructorArgs`, `deserializeJsonb`, `createDefaultMappers` in `postgres-store.ts`.

**Exit criteria:** All standard entities use `createDefaultMappers` or a documented exception comment in the adaptor. ✅

### 7.8 Performance & bundle hygiene

**Goal:** Confirm the plan’s performance assumption holds.

- [x] Verify schemas are module-level constants (no `z.object(...)` inside constructors).
- [x] Optionally add a micro-benchmark or smoke test constructing 10k entities — skipped; no perf regression suspected.
- [x] Ensure `@edaya/core` build exports schemas without pulling unnecessary API-only code (schemas exported from domain modules; `DomainValidationError` re-exported for adaptor/tests).

**Exit criteria:** No schema defined inside hot paths; `bun run build` sizes stable. ✅

### Phase 7 PR sequence (suggested)

| PR | Scope |
|----|--------|
| 7a | `parseDomain` + mechanical constructor migration (1–2 domain groups) |
| 7b | Remove `*Args` interfaces (remaining groups) |
| 7c | Value objects (`Money`, `AttendanceSummary`) |
| 7d | Legacy helper removal + constructor error normalization |
| 7e | API parity tests + document intentional extensions |
| 7f | Test path rename + docs cleanup |
| 7g | Adaptor audit + JSONB read validation tests |

---

## 5. Verification plan

### During migration (Phases 1–6) — Done

- `bun run check` — TypeScript across all workspace packages.
- `bun run test` — 446 tests (400 core, 33 API, 13 integration).

### During cleanup (Phase 7)

Run after each PR:

```bash
bun run fullcheck   # lint:fix + check + test
```

Additional gates before closing Phase 7:

- [x] `rg 'export interface \\w+Args' package/domain-core/src/domains` — empty.
- [x] `rg 'safeParse' package/domain-core/src/domains` — only inside `parseDomain`.
- [x] `rg 'src/entities' docs packages` — only migration-plan history lines.
- [x] OpenAPI generation (if applicable) still produces valid spec from derived schemas.

### Performance

- Schemas are defined once at module scope (already true).
- Zod parse runs per construct/deserialize — acceptable for domain boundaries; do not parse repeatedly inside tight loops without caching.

---

## 6. Definition of done (entire migration)

- [x] All persisted domain types live under `package/domain-core/src/domains/` with Zod schemas.
- [x] API validation derives from `@edaya/core` schemas.
- [x] Postgres adaptor reconstructs entities through constructors (Zod on read).
- [x] No redundant `*Args` interfaces; constructors use `parseDomain` + `z.input`.
- [x] Value objects (`Money`, `AttendanceSummary`) on Zod.
- [x] Legacy manual validators removed from domain/value-object layers.
- [x] Tests and docs use `domains/` naming consistently.
- [x] Documented API-only schema extensions with parity tests for critical commands.

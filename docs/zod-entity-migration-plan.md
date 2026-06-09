# Zod Entity Schema Migration Plan

This document outlines the step-by-step action plan for migrating the domain entities in `packages/core` to a Zod-wrapped schema design. This migration will unify schema definitions, type inference, creation/update DTOs, and runtime validation into a single source of truth, eliminating boilerplate across the core domain, API route validations, and database adaptors.

---

## 1. Objectives

1. **Eliminate Schema & Type Duplication**: Instead of manually writing interfaces (e.g. `ClassSubjectArgs`) and classes separately, define fields once in Zod, infer the types, and derive creation/update schemas.
2. **Centralize Validation**: Let Zod handle constructor validation, parsing, and defaults, throwing a normalized `DomainValidationError` to keep domain boundaries clean.
3. **Downstream API & OpenAPI Reusability**: Directly export derived schemas (e.g. `classSubjectCreateSchema`) for Hono JSON body validation and OpenAPI spec generation in `apps/api`.
4. **Preserve Compatibility**: Leverage TypeScript getter properties on domain classes so that existing callers (which access properties directly as `entity.field`) do not need to be refactored to `entity.data.field`.

---

## 2. Proposed Architecture

Each domain entity will be structured with a companion schema co-located in the same file or a `.schema.ts` file:

```typescript
import { z } from 'zod'
import { DomainValidationError } from '../utils'

// 1. Core Schema Definition
export const classSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive().nullable().optional(),
  completedPercentage: z.number().min(0).max(100).default(0),
  createdAt: z.date().default(() => new Date()),
})

// 2. Type Inference
export type ClassSubjectData = z.infer<typeof classSubjectSchema>

// 3. Derived Downstream Schemas
export const classSubjectCreateSchema = classSubjectSchema.omit({ createdAt: true })
export const classSubjectUpdateSchema = classSubjectSchema.partial().required({ id: true })

// 4. Domain Class Wrapper
export class ClassSubject {
  readonly data: ClassSubjectData

  constructor(args: ClassSubjectData) {
    const result = classSubjectSchema.safeParse(args)
    if (!result.success) {
      const errorMsg = result.error.errors.map(e => e.message).join(', ')
      throw new DomainValidationError(errorMsg)
    }
    this.data = result.data
  }

  // Getter properties ensure compatibility with existing code
  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get subjectId() { return this.data.subjectId }
  get coefficient() { return this.data.coefficient }
  get completedPercentage() { return this.data.completedPercentage }
  get createdAt() { return this.data.createdAt }
}
```

---

## 3. Step-by-Step Migration Phases

### Phase 1: Core Foundation Setup
1. Add `zod` as a dependency in `packages/core/package.json`.
2. Implement a generic helper in `packages/core/src/domains/utils.ts` to convert `ZodError` lists into clean `DomainValidationError` messages.

### Phase 2: Pilot Entity Migration
1. Choose a simple domain entity (e.g. `ClassSubject` or `GradeLevel`).
2. Implement the Zod schema, types, and class wrapper getters in its domain file.
3. Validate that the core package compiles successfully.

### Phase 3: Adaptor & Database Layer Alignment
1. Update repository mappers in `packages/adaptor-postgres` for the pilot entity.
2. When querying rows, map directly to the entity constructor using the raw row data (since Zod parses and normalizes values).
3. When writing to the database, use `entity.data` to supply the raw JSON fields.

### Phase 4: Test Suite Validation
1. Verify that all core unit tests and database integration tests for the pilot entity pass.
2. Resolve any test fixture issues (e.g. ensuring dates are correctly parsed as Date objects by Zod).

### Phase 5: Full Rollout
Migrate all remaining domain entities in groups:
- [x] **Group A (Academics & School)**: ClassGroup, Subject, GradeLevel, School, AcademicYear, AcademicPeriod, ClassSubjectMatter, ClassSubjectProgress. (Completed)
- [x] **Group B (Students & Guardians)**: Student, Guardian, StudentClassEnrollment, GuardianStudentLink. (Completed)
- [x] **Group C (Finances)**: Fee, StudentFee, Payment. (Completed)
- [x] **Group D (Scheduling & Assessments)**: Session, Assessment, AssessmentResult, ReportCard, AttendanceRecord, CalendarEvent, PeriodDefinition, Schedule, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResultSection, ReportCardResult. (Completed)
- [x] **Group E (Messaging & System)**: Announcement, AnnouncementTarget, MessageDelivery, Attachment, StaffMember, DisciplinaryAction, Incident, StudentDisciplinaryAction, StudentIncidentInvolvement, StudentNote, StudentHealthProfile, AccessRole, GradeScale, Resource, ResourceAssignment, StaffAssignment, StaffRoleAssignment. (Completed)

### Phase 6: Downstream API Integration ✅
1. [x] Updated `apps/api/src/validation/entities.schemas.ts` to derive all 40+ response schemas from core schemas using `unwrapShape()`.
2. [x] Updated `apps/api/src/validation/commands.schemas.ts` to derive all 60+ command schemas from core schemas using `unwrapShape()`.
3. [x] Added `unwrapShape()` utility to `schema-fields.ts` that uses duck-typing to extract `.shape` from both `ZodObject` and `ZodEffects`-wrapped schemas across different zod module instances.
4. [x] Removed duplicate schema definitions — API validation now derives directly from `@edaya/core`.
5. [x] All 446 tests pass. Full typecheck passes (6/6 tasks).

---

## 4. Verification Plan

- **Automated Verification**:
  - Run `bun run check` to ensure full TypeScript compile-time safety.
  - Run `bun run test` to verify that all 430+ unit/integration tests remain green.
- **Performance Verification**:
  - Ensure that Zod schema compilation only occurs once per module import, avoiding runtime overhead on repeated constructor calls.

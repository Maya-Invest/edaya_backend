# Timetable Generation - Implementation Plan

> **Status:** Implemented - 2026-07-10
> **Verification:** Integration, changed-package quality/tests, API build, OpenAPI drift, and repository hygiene passed; unrestricted full `bun run verify` rerun was unavailable because the execution escalation quota was exhausted
> **Created:** 2026-07-10
> **Prerequisite:** [timetable-generation-preparation-plan.md](./timetable-generation-preparation-plan.md), section 7
> **Archived source:** [timetable-generation-plan.md](./archive/timetable-generation-plan.md)
> **Scope:** Resolve, generate, publish, and republish date-range class timetables using prepared session-level contracts
> **Out of scope (v1):** Activity or assessment generation, room requirements, positive teacher-availability or preference calendars, CP-SAT, and stored solver-run or draft-process entities. Hard recurring and one-off teacher unavailability is implemented as teacher occupancy.

---

## 1. Goal

Generate deterministic lesson-session timetables for a concrete date range, reserve teachers across classes, and publish or replace generated work without changing standalone session saves or the independent `Schedule -> materializeSchedule` path.

No implementation task in this document starts until the preparation plan records a passing readiness gate.

## 2. Locked design

| Decision | Choice |
|----------|--------|
| Planning model | Weekly `PeriodDefinition` rows resolved into concrete date/period cells |
| Repetition | Resolver expansion; no stored periodicity enum |
| Draft output | `LessonSession` with `timetableGenerated = draft` |
| Publication | Transition surviving drafts to `published` |
| Republish | Preserve protected sessions, replace other generated sessions, regenerate, then publish |
| Conflicts | Session-level overlap across lessons, activities, and timed in-class assessments |
| Teacher model | Layered occupancy derived from active subject assignments |
| Co-teaching | Every active assigned teacher must be free and is occupied by the lesson |
| School generation | Sequential by `GradeLevel.order`, then class name |
| Process storage | None; solver state exists only in memory |
| Ad-hoc scheduling | Existing `Schedule` and materialization workflow remains independent |
| Standalone scheduling | Direct non-generated session saves remain supported with session-level conflict checks |

## 3. Public contracts

### 3.1 Resolved cells

```typescript
interface ResolveTimetableSpaceInput {
  classGroupId: string
  academicYearId: string
  startDate: Date
  endDate: Date
}

interface ResolvedTimetableCell {
  date: string
  weekKey: string
  weeklyIndex: number
  periodDefinitionId: string
  startsAt: Date
  endsAt: Date
}
```

`date` is the UTC calendar date and `weekKey` identifies the calendar-week slice used for workload and spacing calculations. `weeklyIndex` is stable within that slice and follows weekday, period order, then period identifier.

### 3.2 Generation options

```typescript
interface TimetableGenerationDefaults {
  enforceWorkloadFulfillment: boolean
  excludeBreakSlots: boolean
  minPeriodGapSameSubject: number
  preferredPeriodDefinitionIds: string[]
}

interface TimetablePlacementParameters {
  periodsPerWeekByClassSubjectId?: Record<string, number>
}
```

Command options override school defaults. Placement workload overrides apply only to the requested run and are not persisted.

### 3.3 Commands

```typescript
interface GenerateClassGroupTimetableInput {
  classGroupId: string
  academicYearId: string
  startDate: Date
  endDate: Date
  placementParameters?: TimetablePlacementParameters
  options?: Partial<TimetableGenerationDefaults>
}

interface GenerateSchoolTimetableInput {
  academicYearId: string
  startDate: Date
  endDate: Date
  placementParameters?: TimetablePlacementParameters
  options?: Partial<TimetableGenerationDefaults>
}

interface PublishClassGroupTimetableInput {
  classGroupId: string
  startDate: Date
  endDate: Date
  sessionConflictPolicy?: 'fail' | 'skip'
}

interface RepublishClassGroupTimetableInput
  extends GenerateClassGroupTimetableInput {
  sessionConflictPolicy?: 'fail' | 'skip'
}
```

Dates are inclusive. Reject an inverted range, a range outside the selected academic year, and a class group that does not belong to the selected academic year or school.

## 4. Resolver

Implement `resolveTimetableSpace` as a query and reusable workflow helper:

1. Validate class group, academic year, school ownership, and inclusive date range.
2. Iterate each UTC calendar date in the range.
3. Apply the existing calendar-event scope rules and omit non-school dates for the class group.
4. Select period definitions matching the date's `DayOfWeek`.
5. Exclude `isTeachingSlot = false` rows unconditionally.
6. Exclude `isBreak = true` when `excludeBreakSlots` is enabled; v1 defaults it to enabled.
7. Compute concrete `startsAt` and `endsAt` values from the UTC date and period times.
8. Emit cells ordered by date, period order, then period identifier.
9. Assign `weekKey` and `weeklyIndex` within each Monday-Sunday calendar-week slice.

Return an empty cell list for a range containing no teaching dates. Generation treats that as an unsatisfied workload when enforcement is enabled and as a successful empty draft otherwise.

## 5. Occupancy layers

Use transient layered occupancy:

```typescript
interface OccupiedCell {
  date: string
  periodDefinitionId: string
  layer: 'teacher' | 'class_group'
  layerKey: string
  sourceSessionId?: string
}
```

Build occupancy for the full requested range before solving:

- Class-group layer: all overlapping lessons, activities, and timed in-class assessments for the target class.
- Teacher layer: lessons and timed in-class assessments across every class whose active subject assignments include a teacher needed by the target class.
- Generated drafts from other classes reserve both their class and teacher cells.
- Published, materialized, and standalone sessions reserve their applicable layers.
- Completed sessions and pending `isException` sessions are immutable pins.
- Activities reserve class-group cells only because the current activity model has no teacher identifier.

For each offered class subject, require at least one active subject teacher assignment. Multiple active assignments mean co-teaching: candidate placement succeeds only when every assigned teacher layer is free, and placement occupies every one of those layers.

Use interval overlap checks in addition to cell keys so non-period-aligned activities, assessments, and ad-hoc sessions still block candidates correctly.

## 6. Deterministic greedy solver

Create a pure solver that receives resolved cells, offered class subjects, workload targets, teacher assignments, occupancy, and effective options. It returns placements or a typed preflight/unsatisfied-workload error without writing repositories.

Deterministic ordering:

1. Subjects with the fewest currently available cells first.
2. Higher `periodsPerWeek` next.
3. `ClassSubject.id` as the final subject tie-breaker.
4. Preferred period identifiers first for candidate cells.
5. Then date, period order, and period identifier.

Placement rules:

- Resolve workload from run override first, then `ClassSubject.periodsPerWeek`.
- Enforce each subject's workload independently within each calendar-week slice intersecting the range.
- For partial first or last weeks, place only the occurrences whose matching weekdays exist in the resolved range; do not manufacture cells outside the requested range.
- Do not place more than one occurrence of the same subject in one cell.
- Enforce class-group and every co-teacher occupancy layer.
- Enforce `minPeriodGapSameSubject` using `weeklyIndex` within each week slice.
- Never move existing, completed, or pinned sessions.
- If workload enforcement is enabled, fail without writes when any required workload cannot be placed.
- If disabled, return the maximal deterministic placement plus diagnostics for unmet workload.
- **Span packing (greedy lookahead):** when several block sizes or candidate slots fit, score each choice by simulating a largest-first fill for the remaining weekly quota on a copy of occupancy. Pick the candidate that maximizes total placeable slots, then larger span, then preferred periods. Still no backtracking or CP-SAT — one committed placement per loop iteration.

Unit-test the solver independently from dates, repositories, and command authorization.

## 7. Generate workflows

### 7.1 Class group

`generateClassGroupTimetable` runs atomically:

1. Resolve effective options from school defaults and command overrides.
2. Resolve candidate cells.
3. Load offered class subjects, workload values, and active teacher assignments.
4. Build occupancy layers from existing occurrences in range.
5. Run all preflight checks and the pure solver.
6. Persist one pending `LessonSession` per placement with `timetableGenerated = draft` and no `scheduleId`.
7. Return created sessions and unmet-workload diagnostics when enforcement is disabled.

Generation does not delete or replace existing drafts. Reject a generation request when the target class already has generated draft sessions in the range and direct the caller to republish for replacement behavior.

### 7.2 School

`generateSchoolTimetable` selects class groups for the academic year and processes them sequentially by `GradeLevel.order`, class name, then class identifier. Each later class sees drafts written for earlier classes through the teacher occupancy layer.

The school command is atomic for the requested range: any class failure rolls back drafts created for earlier classes in that command.

## 8. Publish and republish

### 8.1 Publish

Add `SchedulingOperations.timetablePublish` and require it for publish and republish. Generation uses the existing scheduling-management authorization unless a narrower generation operation already exists when implementation starts.

`publishClassGroupTimetable`:

1. Select generated drafts for the class and inclusive range.
2. Re-run `assertNoSessionConflict` for each draft while excluding the draft itself.
3. With `fail` (default), perform one atomic validation pass and change no rows if any conflict exists.
4. With `skip`, leave conflicting sessions as drafts and transition only conflict-free sessions to `published`.
5. Return published and skipped session identifiers.

Publishing creates no separate timetable artifact.

### 8.2 Republish

`republishClassGroupTimetable` is one atomic class-group workflow:

1. Preserve all standalone and schedule-materialized sessions where `timetableGenerated = null`.
2. Preserve generated sessions with `status = completed`.
3. Preserve pending generated sessions with `isException = true` as pinned occupancy.
4. Delete other generated draft or published sessions in the range.
5. Run class-group generation using the supplied options.
6. Publish the new drafts using the supplied conflict policy.
7. Roll back deletion, generation, and publication together on a `fail` conflict or any other error.

## 9. Registration and boundaries

- Register resolver query and command handlers in the domain-service catalogs.
- Expose the query and commands through the school API registry with typed input/output schemas.
- Apply tenant and relationship-native authorization checks consistently with existing scheduling workflows.
- Ensure generated API clients include the new operations.
- Keep direct `lessonSessions.save` available for standalone sessions with `timetableGenerated = null` or omitted.
- Reject direct client attempts to create or transition generated states; generation and publication workflows own those values.
- Apply `assertNoSessionConflict` to standalone creates and schedule-changing updates.
- Do not modify the semantics or conflict-policy parameter of `materializeSchedule`.

## 10. Edge cases

| Case | Required behavior |
|------|-------------------|
| Calendar closure in range | Resolver emits no cells for affected class/date |
| No teaching cells | Fail only when enforced workload remains unsatisfied |
| Missing teacher assignment | Generation preflight fails without writes |
| Multiple active teachers | All are required and occupied |
| Activity overlap | Candidate is blocked for the class group |
| Cross-class teacher overlap | Candidate is blocked for every shared teacher |
| Adjacent occurrence | Allowed when end equals next start |
| Existing generated draft | Generate rejects; republish is the replacement path |
| Completed generated session | Preserved and pinned on republish |
| Pending exception | Preserved and pinned on republish |
| Other generated pending session | Replaced on republish |
| Ad-hoc materialized session | Preserved and blocks occupancy |
| Standalone session | Preserved and blocks occupancy |
| Publish with `skip` | Conflict remains draft; other drafts publish |

## 11. Verification

Unit tests:

- Resolver ordering, weekday matching, calendar exclusions, breaks, disabled slots, and partial weeks.
- Occupancy for classes, activities, assessments, standalone and materialized sessions, drafts, completed sessions, exceptions, and co-teachers.
- Deterministic solver output, preferred slots, workload enforcement, disabled enforcement, and same-subject gaps.
- Publish selection and `fail`/`skip` behavior.
- Republish preservation and rollback rules.

Integration tests:

- Generate produces pending draft sessions only inside the requested range.
- Publish transitions drafts to published without creating another artifact.
- Republish preserves completed, exception, standalone, and materialized sessions while replacing other generated work.
- Sequential generation for two classes does not double-book a shared or co-teacher.
- Calendar closures and Wednesday disabled teaching slots are respected.
- Existing `Schedule -> materializeSchedule` behavior still works with required `scheduleId`.
- Standalone conflict-free sessions save without `scheduleId`, while conflicting saves are rejected.
- Command registration, authorization, API schemas, and generated clients work end to end.

Run:

```sh
bun run verify
bun run test:integration
```

## 12. Delivery phases

| Phase | Deliverable |
|-------|-------------|
| 1 | Resolver, resolved-cell contract, and tests |
| 2 | Occupancy builder and pure deterministic solver |
| 3 | Class and school generation commands |
| 4 | Publish/republish authorization and workflows |
| 5 | API registration, generated clients, integration coverage, and demo smoke |

The feature is complete when both verification commands pass and every implementation scenario in section 11 is covered.

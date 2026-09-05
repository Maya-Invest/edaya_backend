# Timetable Generation - Preparation Plan

> **Status:** Complete - readiness gate passed 2026-07-10
> **Verification:** `bun run verify` and `bun run test:integration` passed
> **Created:** 2026-07-10
> **Scope:** Close domain, persistence, API, session-conflict, fixture, and compatibility gaps required by timetable generation
> **Out of scope:** Timetable resolver, occupancy builder, solver, generate commands, publish, and republish
> **Next plan:** [timetable-generation-implementation-plan.md](./timetable-generation-implementation-plan.md)
> **Archived source:** [timetable-generation-plan.md](./archive/timetable-generation-plan.md)

---

## 1. Goal

Establish stable, tested contracts that the timetable generator can consume without mixing schema migration and compatibility work into the feature implementation.

Preparation is complete only when the readiness gate in section 7 passes. The implementation plan remains blocked until then.

## 2. Current gaps

| Area | Current state | Required state |
|------|---------------|----------------|
| `PeriodDefinition` | One reusable daily grid; no weekday or teaching-slot flag | Required weekly `dayOfWeek` and `isTeachingSlot` fields |
| Subject workload | No weekly period target | `periodsPerWeek` synchronized from grade subject to class subject |
| `LessonSession` origin | `scheduleId` is required; no generation state | Optional `scheduleId` plus `timetableGenerated` lifecycle flag |
| School defaults | Only existing scheduling conflict configuration | Persisted timetable-generation defaults |
| Conflict checks | Class-group helper used by schedule materialization | Shared session-level class and teacher conflict helper |
| Contracts and data | Existing stores, clients, and fixtures use the old shapes | All layers updated and migration-tested |

## 3. Locked contracts

### 3.1 Weekly period definitions

Extend `PeriodDefinition` in place:

```typescript
dayOfWeek: DayOfWeek
isTeachingSlot: boolean // default true
```

Keep the existing `order`, `startTime`, `endTime`, `isBreak`, and `academicYearId` fields. A candidate teaching slot must eventually satisfy `isTeachingSlot && !isBreak`; this filtering belongs to the implementation plan.

Migration rules:

1. Add `dayOfWeek` temporarily nullable and add `isTeachingSlot` with database default `true`.
2. Treat the existing daily grid as a Monday-Friday template.
3. Retain each original row and identifier as the Monday row.
4. Clone each row for Tuesday through Friday with new identifiers, preserving school, academic year, label, order, times, and break status.
5. Set `isTeachingSlot = true` for migrated rows, including breaks; `isBreak` remains the independent exclusion flag.
6. Make `dayOfWeek` non-null after backfill.
7. Update fixtures so Wednesday afternoon can be represented by `isTeachingSlot = false` without marking the period as a break.

`Schedule` is not migrated to period identifiers. Its existing `dayOfWeek`, `startTime`, and `endTime` recurrence contract remains independent.

### 3.2 Weekly subject workload

Add `periodsPerWeek` to both `GradeLevelSubject` and `ClassSubject`.

- Store it as a nullable positive integer so existing records can be migrated safely.
- Copy it through grade-level subject synchronization on create and update.
- A missing value is accepted by the domain and persistence layers.
- The future generator preflight fails when workload enforcement is enabled and an offered class subject has no value.
- Add representative values to demo and integration fixtures.

### 3.3 Generated lesson sessions

Add the lifecycle enum and field:

```typescript
export enum TimetableGenerated {
  Draft = 'draft',
  Published = 'published',
}

timetableGenerated: TimetableGenerated | null
scheduleId: string | null
```

Validation rules:

| Origin | `timetableGenerated` | `scheduleId` |
|--------|----------------------|--------------|
| Timetable generation | `draft` or `published` | Optional |
| `Schedule` materialization | `null` | Required by the materialization workflow |
| Standalone/manual session | `null` | Optional |

Migration rules:

- Make the database `schedule_id` column nullable.
- Add nullable `timetable_generated`; existing rows remain `null`.
- Preserve the current schedule identifier on every existing lesson session.
- Keep `scheduleId` optional at the domain level so standalone sessions can be saved independently.
- Keep `scheduleId` required inside `materializeSchedule`, where the originating schedule is known.

Carry both fields through domain constructors, store serialization, API schemas, generated clients, fixtures, and test builders.

### 3.4 School timetable defaults

Add these persisted school settings:

```typescript
timetableEnforceWorkloadFulfillment: boolean // default true
timetableExcludeBreakSlots: boolean          // default true
timetableMinPeriodGapSameSubject: number     // default 2
timetablePreferredPeriodDefinitionIds: string[]
```

Validate the gap as a non-negative integer. Default preferred period identifiers to an empty array.

Update school configuration workflows to preserve every scheduling field, including the existing `enforceScheduleConflicts`, whenever unrelated school configuration is changed.

### 3.5 Shared session conflicts

Replace or extend `assertNoClassGroupScheduleConflict` with a shared `assertNoSessionConflict` contract:

```typescript
interface AssertNoSessionConflictInput {
  classGroupId: string
  teacherIds?: string[]
  startsAt: Date
  endsAt: Date
  excludeSessionId?: string
}
```

The helper must:

- Reject class-group overlap with any `LessonSession`, `ActivitySession`, or timed in-class `Assessment`.
- Reject teacher overlap with lessons and timed in-class assessments whose active subject assignments intersect `teacherIds`.
- Treat multiple active subject assignments as co-teaching; all assigned teachers participate in occupancy checks.
- Apply strict interval overlap semantics, allowing one occurrence to start exactly when another ends.
- Ignore the excluded session when validating an update or publication.
- Not infer teacher occupancy for activities, because `Activity.coach` is free text rather than a teacher identifier.

Refactor schedule materialization to use this helper without changing `materializeConflictPolicy` behavior.

### 3.6 Standalone session creation

Keep direct API creation of standalone `LessonSession` rows. Supported creation paths are:

- `materializeSchedule`, producing `timetableGenerated = null` with a required `scheduleId`.
- Timetable generation workflows added by the implementation plan, producing `timetableGenerated = draft`.
- Direct standalone saves, producing `timetableGenerated = null` with an optional `scheduleId`.

Direct clients must not create or transition a session with `timetableGenerated = draft` or `published`; those values remain owned by generation and publication workflows. Run `assertNoSessionConflict` for standalone creates and for updates that change class group or time boundaries. Existing authorized update behavior remains available for attendance, completion, cancellation, and rescheduling.

## 4. Layer-by-layer work

1. Update domain schemas, enums, getters, refinements, and exports.
2. Add the Postgres migration and update Drizzle table definitions and entity-store mappings.
3. Update repository filters where new fields are queryable by generation state, date range, weekday, or teaching-slot state.
4. Update command/API schemas and regenerate checked-in API clients.
5. Update demo fixtures, integration datasets, and builders to provide weekly periods and workload values.
6. Generalize conflict tests and retain materialization regression coverage.
7. Apply session-level conflict validation to standalone creates and schedule-changing updates while reserving generation-state transitions for workflows.

## 5. Compatibility requirements

- Existing lesson sessions remain valid ad-hoc sessions after migration.
- Standalone lesson sessions can be created without a `Schedule` or `scheduleId`.
- `materializeSchedule` still creates schedule-backed lessons and activities over the academic-year range.
- Existing non-school-day skipping and `materializeConflictPolicy` semantics do not change.
- Timetable fields must not alter class timetable query output except for additional optional session metadata.
- Existing school configuration updates must not reset any old or new scheduling setting.

## 6. Tests

Add focused tests for:

- Monday retention and Tuesday-Friday cloning during period migration.
- Required weekday and default teaching-slot domain behavior.
- Nullable workload persistence and grade-to-class synchronization.
- Generated, materialized, and standalone `timetableGenerated`/`scheduleId` combinations.
- Existing lesson-session storage round trips after the nullable column migration.
- School defaults and preservation across unrelated configuration updates.
- Lesson, activity, assessment, and co-teacher conflict detection.
- Adjacent non-overlapping time ranges.
- Successful conflict-free standalone lesson-session creation without `scheduleId`.
- Rejection of conflicting standalone creation and schedule-changing updates.
- Rejection of direct client attempts to set or transition `timetableGenerated`.
- Successful ad-hoc schedule materialization after all schema changes.
- API schema and generated-client compatibility.

## 7. Readiness gate

**Result: PASSED on 2026-07-10.** Domain, migration, storage, service, API/client, fixture, and compatibility coverage is implemented. Repository verification and both integration-test stages pass.

The implementation plan may start only when all conditions are true:

- Domain and Postgres contracts match for every new field.
- Migration tests prove existing sessions and daily periods are preserved according to the locked rules.
- Store round-trip tests cover all changed entities.
- Grade-level workload synchronization is covered.
- The generalized conflict helper is used by materialization and passes regression tests.
- Standalone lesson-session creation and schedule-changing updates use the shared conflict helper.
- Generation-state creation and transitions remain restricted to generation and publication workflows.
- Demo and integration fixtures use weekly period definitions and workload values.
- Generated API clients are current.
- `bun run verify` passes.
- Targeted scheduling and fixture integration tests pass.

The gate result should be recorded at the top of this document before changing the implementation plan status from blocked.

## 8. Key files

| Area | Path |
|------|------|
| Period definition | `package/domain-core/src/domain/scheduling/period-definition.ts` |
| Lesson session | `package/domain-core/src/domain/scheduling/lesson-session.ts` |
| Subject workload sync | `package/domain-service/src/services/workflows/grade-level-subject-sync.ts` |
| School configuration | `package/domain-service/src/services/workflows/setup.ts` |
| Conflict helper | `package/domain-service/src/services/workflows/schedule-conflicts.ts` |
| Postgres schema | `package/adaptor-postgres/src/postgres-schema.ts` |
| API registry | `apps/api/src/lib/school-api/registry.ts` |

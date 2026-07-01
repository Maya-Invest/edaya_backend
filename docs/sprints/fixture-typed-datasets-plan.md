# Fixture typed datasets — Sprint Plan

> **Status:** Complete — Phases 0–7 done  
> **Created:** 2026-07-01  
> **Scope:** Purpose-driven fixture datasets typed with `@edaya/core` `*Input` types; fixtures stay data-only, `@edaya/seeding` owns orchestration  
> **Package:** `tooling/fixtures` (`@edaya/fixtures`)

## Goal

Replace ad-hoc `Seed*` shapes with **clear datasets** (`minimal`, `integration`, `demo`, `bulk`) whose records use `satisfies *Input` from `@edaya/core`. Entity schema changes surface at compile time in fixtures.

## Design constraints (agreed)

1. Use `*Input` types, not entity classes.
2. ISO date strings in fixture files (`satisfies StudentInput` via Zod input).
3. `@edaya/fixtures` is data-only; seeding maps to HTTP/commands.
4. Non-domain fields (e.g. `mockCategory`) live outside `*Input` records.
5. Migrate incrementally; keep `SEED_*` / `scenarios/demo-central` shims until Phase 7.

## Target layout

```text
tooling/fixtures/src/
  datasets/
    types.ts
    minimal/
    integration/
    demo/              # Phase 3+
    bulk/              # Phase 5
  shared/
    ids.ts
    builders/
  onboarding/          # unchanged
  scenarios/           # legacy — remove Phase 7
  meta/
```

## Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **0** | `FixtureDataset` type, `shared/ids`, manifest `dataset` field, README, compile test | Done |
| **1** | `datasets/minimal` — school, owner staff, primary guardian | Done |
| **2** | `datasets/integration` — students g1–g6 / s1–s6, enrollments, links; `integration-light` shims | Done |
| **3** | Demo foundation (school shell, people, curriculum) | Done |
| **4** | Demo domain slices (scheduling, assessments, …) | Done |
| **5** | Bulk generators → `datasets/bulk` | Done |
| **6** | Peel presentation metadata from domain records | Done |
| **7** | Remove `scenarios/demo-central`, slim exports | Done |

## Phase 0 — Foundation

- [x] `src/datasets/types.ts` — `FixtureDataset`, `FixtureDatasetPurpose`, `FixtureDatasetEntities`
- [x] `src/shared/ids.ts` — stable cross-dataset ids
- [x] `SeedEntityManifestEntry.dataset` optional field
- [x] `test/datasets/types.test.ts` — `satisfies StudentInput` smoke
- [x] README migration map

## Phase 1 — Minimal dataset

Auth + register-school smoke (`st8`, `g1`, `sch-edaya-central`).

- [x] `datasets/minimal/school.ts` → `SchoolInput`
- [x] `datasets/minimal/people.ts` → `StaffMemberInput`, `GuardianInput`
- [x] `datasets/minimal/index.ts` → `minimalDataset`
- [x] Optional: point `seed-minimal-school.ts` at `minimalDataset.entities`

## Phase 2 — Integration dataset

Formalize `integration-light` as typed `datasets/integration`.

- [x] `datasets/integration/people.ts` — typed students, guardians, enrollments, links
- [x] `datasets/integration/index.ts` → `integrationDataset`
- [x] Narrative adapters for seeding (`INTEGRATION_LIGHT_STUDENTS`, etc.)
- [x] `scenarios/demo-central/integration-light.ts` → re-exports
- [ ] `buildSeedValidationTargets('integration')` (optional follow-up)

## Phase 3 — Demo foundation

- [x] `datasets/demo/foundation/shell.ts` — school, academic year/periods, grade levels, period defs, core classes
- [x] `datasets/demo/people.ts` — 8 typed staff members
- [x] `datasets/demo/curriculum.ts` — subjects, matters, class subjects + teacher map
- [x] `datasets/demo/narrative.ts` — `DEMO_FOUNDATION_*` legacy adapters
- [x] `datasets/demo/index.ts` → `demoFoundationDataset`
- [x] `core.ts` foundation `SEED_*` re-exports from demo narrative
- [x] Entity manifest paths updated with `dataset: 'demo'`

## Phase 4 — Demo domain slices

One vertical per PR: scheduling, assessments, attendance, finance, report-cards, communications, discipline, activities.

### Scheduling (done)

- [x] `datasets/demo/domains/scheduling.ts` — typed `ResourceInput`, `ScheduleInput`, slot metadata, progress anchor
- [x] `datasets/demo/domains/scheduling-narrative.ts` — `SEED_PLANNING_SLOTS`, `SEED_RESOURCES`, `SEED_SESSION_PROGRESS`, `planningSessionDate`
- [x] `scenarios/demo-central/domains/scheduling.ts` → shim re-exports
- [x] `core.ts` resources/session progress moved to scheduling slice

### Assessments (done)

- [x] `datasets/demo/domains/assessments.ts` — builders (`inClassAssessment`, `studentScores`, `fixturePeriodIdForDate`) + typed in-class assessments + extended term-s slice
- [x] `datasets/demo/domains/assessments-homework.ts` — homework builders + fixtures + submissions
- [x] `assessments-*-narrative.ts` removed; `*-types.ts` merged into domain files
- [x] `assessments-counts.ts` — combined count helpers
- [x] Seeding workflow consumes `demoInClassAssessments`, `demoExtendedInClassAssessments`, `demoHomework*`

### Finance (done)

- [x] `datasets/demo/domains/finance.ts` — builders (`demoFee`, `demoPayment`, `demoStudentFeeAssignment`) + typed fees, assignments, payments
- [x] `finance-narrative.ts` removed; `finance-types.ts` merged into `finance.ts`
- [x] Seeding workflow consumes `demoFees`, `demoAllStudentFeeAssignments`, `demoAllPayments`

### Report-cards (done)

- [x] `datasets/demo/domains/report-cards.ts` — builders (`demoGradeScale`, `demoReportCardDefinition`) + typed scales, definitions, results
- [x] `report-cards-narrative.ts` removed; `report-cards-types.ts` merged into `report-cards.ts`
- [x] Seeding workflow consumes `demoGradeScaleFixtures`, `demoReportCardDefinitionFixtures`, `demoReportCardResults`

### Attendance (done)

- [x] `datasets/demo/domains/attendance.ts` — `attendanceForLessonSession()` builder + absence/reference-date sessions
- [x] `attendance-narrative.ts` removed — `countSeedAttendanceRecords()` lives in `attendance.ts`; pending ids as `demoPendingJustificationRecordIds`
- [x] `SEED_ABSENCE_RECORDS`, `SEED_TODAY_ATTENDANCE`, `SEED_PENDING_JUSTIFICATION_RECORD_IDS` removed from package barrel
- [x] Seeding workflow consumes typed `demoAttendance*` fixtures

### Activities (done)

- [x] `datasets/demo/domains/activities.ts` — `demoActivity()` / `demoActivityEnrollment()` builders + 6 activities + enrollments
- [x] Seeding workflow consumes `demoActivities` + `demoActivityEnrollments`

### Communications (done)

- [x] `datasets/demo/domains/communications.ts` — announcement/target/delivery builders + typed fixtures
- [x] `communications-narrative.ts` removed — count helpers (`countSeedAnnouncements`, `countSeedAnnouncementTargets`, `countSeedExplicitMessageDeliveries`, `countSeedMessageDeliveriesMinimum`) live in `communications.ts`
- [x] `SEED_ANNOUNCEMENTS`, `SEED_ANNOUNCEMENT_TARGETS`, `SEED_ANNOUNCEMENT_MATERIALIZE_PLANS`, `SEED_MESSAGE_DELIVERIES` removed from package barrel
- [x] Seeding workflow consumes `demoAnnouncements`, `demoAnnouncementTargets`, `demoMessageDeliveries`, `demoAnnouncementMaterializePlans`

### Discipline (done)

- [x] `datasets/demo/domains/discipline.ts` — disciplinary action builders + typed catalog + applied actions
- [x] `discipline-narrative.ts` removed — count helpers live in `discipline.ts`
- [x] `SEED_DISCIPLINARY_ACTIONS`, `SEED_STUDENT_DISCIPLINARY_ACTIONS` removed from package barrel
- [x] Seeding workflow consumes `demoDisciplinaryActions` + `demoStudentDisciplinaryActions`

## Phase 5 — Bulk

- [x] `datasets/bulk/` — generator, population, narrative, constants, email helpers
- [x] Typed `bulkStudents`, `bulkGuardians`, `bulkGuardianLinks`, `bulkEnrollments`, `bulkClassGroups`
- [x] `scenarios/generators/population-generator.ts` → shim re-exports

## Phase 6 — Peel metadata

- [x] `meta/narrative.ts` — incident `mockCategory`/`mockSeverity`, calendar `mockType` by event id
- [x] `datasets/demo/domains/incidents.ts` — domain incidents without presentation fields; `countSeedIncidents()`; presentation via `meta/narrative.ts`
- [x] `incidents-narrative.ts` removed — `SEED_INCIDENTS` dropped from package barrel
- [x] `datasets/demo/population/guardians.ts` + `guardian-links.ts` — typed `GuardianInput` + `GuardianStudentLinkInput[]` for g1–g21
- [x] `datasets/demo/population/people-narrative.ts` — derives legacy `studentIds` from links
- [x] `scenarios/demo-central/domains/calendar.ts` — domain events + presentation merge
- [x] `core.ts`, `population.ts`, `extended.ts` — consume typed guardians / incidents

## Phase 7 — Cleanup

- [x] Move `extended.ts`, `population.ts`, `seed-core.ts` into `datasets/demo/`
- [x] Move `calendar.ts`, `attachments.ts` into `datasets/demo/domains/`
- [x] Repoint barrel, validation harness, meta, bulk, integration imports
- [x] Update entity manifest paths
- [x] Remove `scenarios/demo-central/` and package subpath export
- [x] `SEED_*` aliases retained on main barrel via `datasets/demo/seed-core` (consumers unchanged)

## Compatibility

During migration, old exports remain:

| Legacy | New |
|--------|-----|
| `MINIMAL_AUTH_FIXTURE_*` | `minimalDataset` |
| `INTEGRATION_LIGHT_*` | `integrationDataset` + narrative adapters |
| `SEED_*` / `scenarios/demo-central/*` | `datasets/demo/*` (Phase 3+) |

## Verification

Each phase: `bun --filter @edaya/fixtures test`, `bun verify` green, `bun seed` / integration tests unchanged.

## Related

- [tooling/fixtures/README.md](../../tooling/fixtures/README.md)
- [tooling/seeding/seed-contract.md](../../tooling/seeding/seed-contract.md)

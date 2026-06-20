# Data Loading Sprint — Codebase Alignment

> **Target spec:** [data-loading-spec.md](./data-loading-spec.md)

This document plans incremental work to align `apps/webapp` with the data loading spec. It describes **current gaps** and a phased sprint — the spec itself stays independent of implementation state.

---

## Current gaps (audit)

| Gap | Where | Impact |
|-----|-------|--------|
| Global domain preload at login | `bootstrap-app.ts` → `getDetailDataSnapshot()` | Pays cost of all modules on every session start |
| Report cards + teaching log at bootstrap | `bootstrap-app.ts` | Same — unrelated routes block on their data |
| Duplicate fetches | Bootstrap + `query*Page` loaders (e.g. `loadPeopleData` in `people.queries.ts`) | Wasted network; confusing ownership |
| List renders query result, not store | Most `+page.svelte` pass `data.students` etc. to views | Optimistic mutations invisible on list until refetch |
| Timetable bypasses `PageQuery` | `classes/[classId]/timetable/[[id]]/+page.svelte` | Inconsistent pattern; tied to global bootstrap |
| Drawer gated on global store ready | `(app)/+layout.svelte` waits for `detailDataContext.ready` | Deep links slow; couples drawer to full preload |
| `detail-routes.ts` reads global store only | All matchers use `detailDataContext.*` | Requires bootstrap hydrate before any detail URL works |
| Mixed mutation strategies | `academic.mutations.ts` (`refresh: true`), `report-cards.mutations.ts` (targeted refresh), `student.mutations.ts` (partial optimistic), assessment/attendance (none) | Unpredictable UI after save |
| Hybrid cache reads | `subjects.queries.ts` `getAllSubjects()` checks `detailDataContext.ready` | Ambiguous source of truth |
| No `seed*` methods on store | `detail-data/context.svelte.ts` only has `hydrate` + `patch*` | Routes cannot incrementally populate store |
| Views mix store + query | e.g. `ClassReportCardsView.svelte` uses `reportCardsContext` + `detailDataContext` | Works only because bootstrap preloads both |

---

## Sprint principles

1. **One vertical slice at a time** — finish seed → list → drawer → mutations for a domain before moving on.
2. **Keep the app shippable** — each phase leaves the app runnable; avoid a long-lived broken branch.
3. **Spec wins** — when in doubt, match [data-loading-spec.md](./data-loading-spec.md), not existing habit.
4. **Delete dead paths** — remove bootstrap fetches only after the route path seeds the store.

---

## Phase 0 — Store foundation

**Goal:** Entity store supports route-driven hydration without global `hydrate()`.

### Tasks

- [ ] Add `seed*` methods to `detail-data/context.svelte.ts`:
  - `seedStudents(students, scope?: { classId?: string })` — merge by id; class scope replaces class slice
  - `seedGuardians`, `seedStaff`, `seedSubjects`, `seedPlanning`, `seedEvaluations`, `seedDeadlines`, `seedIncidents`, `seedActivities`, `seedBilling`, `seedFees`, `seedAbsences`, `seedResources`, `seedRolePermissions`
- [ ] Add read helpers where useful: `studentsForClass(classId)`, `planningForClass(classId)`, etc.
- [ ] Document seed policy per collection in code comments (mirror spec table)
- [ ] Unit tests for merge vs replace-slice behavior

### Files

- `apps/webapp/src/lib/detail-data/context.svelte.ts`
- `apps/webapp/src/lib/detail-data/context.test.ts` (new)

### Done when

Store can be populated incrementally from route loaders; `hydrate()` is no longer required for new code paths.

---

## Phase 1 — Shell diet

**Goal:** Bootstrap loads shell context only.

### Tasks

- [ ] Change `runBootstrapAppShell()` to call only `getAppShellData()` + `academicContext.initFromShell()`
- [ ] Remove `getDetailDataSnapshot()` from bootstrap (keep function temporarily for reference or delete once unused)
- [ ] Move `getReportCardsLayoutData()` out of bootstrap → loaded by report-card routes
- [ ] Move `fetchTeachingLogEntries()` out of bootstrap → loaded by teaching-log route
- [ ] Update `(app)/+layout.svelte`:
  - Remove `detailDataContext.ready` gate for drawer sync
  - Gate drawer on route query completion + record lookup (coordinate with Phase 2)
- [ ] Keep `reportCardsContext.ready` gate only until report-card routes own their load

### Files

- `apps/webapp/src/lib/auth/bootstrap-app.ts`
- `apps/webapp/src/routes/(app)/+layout.svelte`
- `apps/webapp/src/lib/queries/detail-data.queries.ts` (deprecate or shrink)

### Done when

Login loads shell in one request bundle; no domain entity fetch at bootstrap.

### Risk

Drawer deep links break until Phase 2 completes for affected domains. **Mitigation:** complete Phase 2 slice for students before merging Phase 1, or ship 0+1+2a together.

---

## Phase 2a — Students vertical slice (pilot)

**Goal:** End-to-end reference implementation for one high-traffic domain.

### Tasks

- [ ] `querySchoolStudentsPage` / `queryClassStudentsPage`: call `entityStore.seedStudents` in `load`
- [ ] `StudentsView` (and class variant): read `entityStore.studentsForClass(classId)` or filtered derived, not props from query payload
- [ ] `+page.svelte` routes: pass `classId` / status only; drop `students={data.students}`
- [ ] `detail-routes.ts` student matchers: unchanged lookup path, now fed by route seed
- [ ] Audit `student.mutations.ts`:
  - [ ] Add optimistic `apply`/`rollback` to `recordStudentAssessmentResultMutation`, `recordStudentDailyAttendanceMutation`, `recordStudentIncidentMutation`
  - [ ] Verify list + drawer update after `updateStudentProfileMutation`, `transferStudentMutation`
- [ ] Manual test: edit student in drawer → list updates without navigation

### Files

- `apps/webapp/src/lib/queries/people.queries.ts`
- `apps/webapp/src/routes/(app)/school/students/[[id]]/+page.svelte`
- `apps/webapp/src/routes/(app)/classes/[classId]/students/[[id]]/+page.svelte`
- `apps/webapp/src/lib/components/school/students/StudentsView.svelte`
- `apps/webapp/src/lib/api/mutations/student.mutations.ts`

### Done when

Students domain matches spec; usable as template for other domains.

---

## Phase 2b — Guardians + staff

**Goal:** People domain complete.

### Tasks

- [ ] Seed guardians/staff in `people.queries.ts` loaders
- [ ] Update `GuardiansView`, staff config views to read from store
- [ ] `people.mutations.ts` — ensure all mutations have `apply`/`rollback`
- [ ] `linkGuardianToStudentMutation` — verify guardian list + drawer + student tab sync

### Files

- `apps/webapp/src/lib/queries/people.queries.ts`
- `apps/webapp/src/routes/(app)/school/guardians/[[id]]/+page.svelte`
- `apps/webapp/src/routes/(app)/configuration/staff/[[id]]/+page.svelte`
- Related views + `people.mutations.ts`

---

## Phase 3 — Class tabs

**Goal:** All `/classes/:id/*` tabs follow the same PageQuery + store pattern.

| Tab | Query | Store seed | View updates |
|-----|-------|------------|--------------|
| subjects | `queryClassSubjectsPage` | `seedSubjects` | `SubjectsView` |
| teaching | `queryClassTeachingPage` | same | teaching views |
| homework | `queryClassHomeworkPage` | `seedDeadlines` | homework view |
| evaluations | `queryClassEvaluationsPage` | `seedEvaluations` | evaluations view |
| timetable | **new** `queryClassTimetablePage` | `seedPlanning` | `PlanningView` |
| report-cards | `queryClassReportCardsPage` | report cards domain store | `ClassReportCardsView` |

### Timetable-specific tasks

- [ ] Replace `detailDataContext` reads in `timetable/[[id]]/+page.svelte` with `PageQuery`
- [ ] Wire `planning.mutations.ts` reschedule to `seedPlanning` / `patchPlanningEvent` (already optimistic)
- [ ] Remove `getClassTimetable` duplicate if bootstrap path is gone

### Subjects-specific tasks

- [ ] Remove `getAllSubjects()` bootstrap cache branch in `subjects.queries.ts`
- [ ] Config subjects routes seed store independently

### Files

- `apps/webapp/src/lib/queries/planning.queries.ts`
- `apps/webapp/src/lib/queries/subjects.queries.ts`
- `apps/webapp/src/lib/queries/assessments.queries.ts`
- `apps/webapp/src/lib/queries/prototype.queries.ts` (homework)
- All `classes/[classId]/*/[[id]]/+page.svelte`

---

## Phase 4 — School-life + finance

### School-life

- [ ] `school-life.queries.ts` — seed activities, incidents, calendar events, absences
- [ ] Routes: `/school/activities`, `/school/events`, `/school/calendar`
- [ ] Views + drawer matchers + mutations

### Finance

- [ ] `finance.queries.ts` — seed billing, fees
- [ ] Routes: `/finance/billing`, `/finance/fees`, `/finance/payment`
- [ ] Billing/fee detail drawers + mutations

---

## Phase 5 — Configuration + access

- [ ] Roles: `access.queries.ts` → `seedRolePermissions`
- [ ] Config subjects, grade scales, report card definitions
- [ ] `StaffPermissionsBlock.svelte` reads store seeded by roles route
- [ ] Academic admin (`configuration/academic`) — keep `refresh: true` only for academic structure mutations (already correct tier)

---

## Phase 6 — Domain stores (report cards, teaching log)

- [ ] `report-cards.queries.ts`: route loaders call `reportCardsContext.hydrateFromServer` (or seed API)
- [ ] Remove any remaining bootstrap dependency for `reportCardsContext.ready`
- [ ] Teaching log route loads `teachingLogContext` on demand
- [ ] Normalize mutations: prefer optimistic patch where possible; keep `refreshReportCardsLayout()` only for server-generated aggregates

### Files

- `apps/webapp/src/lib/queries/report-cards.queries.ts`
- `apps/webapp/src/lib/report-cards/context.svelte.ts`
- `apps/webapp/src/lib/teaching-log/context.svelte.ts`
- `apps/webapp/src/routes/(app)/configuration/report-cards/[[id]]/+page.svelte`
- Teaching log route / view

---

## Phase 7 — Cleanup

- [ ] Delete `getDetailDataSnapshot()` if unused
- [ ] Remove `detailDataContext.hydrate()` / `ready` flag if replaced by per-collection readiness
- [ ] Remove `refreshAppShellData()` call sites except academic structure mutations
- [ ] Grep for `detailDataContext.ready` and eliminate
- [ ] Grep for list components still receiving full collections as props from `PageQuery` children
- [ ] Update agent docs / PR checklist to reference spec compliance

---

## Suggested sprint order (timeline)

| Sprint | Phases | Outcome |
|--------|--------|---------|
| **S1** | 0 + 2a | Store API + students reference slice |
| **S2** | 1 + 2b | Shell diet + guardians/staff (ship together to avoid broken drawers) |
| **S3** | 3 | All class tabs aligned |
| **S4** | 4 + 5 | School-life, finance, config |
| **S5** | 6 + 7 | Domain stores + dead code removal |

---

## Per-module checklist

Copy when opening a PR for any route/domain:

- [ ] `query*Page` fetches scoped data only
- [ ] `load` seeds entity store (correct merge/replace policy)
- [ ] List/view reads from store, not query result
- [ ] Drawer resolves same store
- [ ] Mutations use Tier 1 (`apply`/`rollback`) or documented Tier 2/3
- [ ] No new bootstrap fetches added
- [ ] Tests for seed + at least one mutation patch

---

## Verification matrix

| Scenario | Expected after alignment |
|----------|--------------------------|
| Open `/dashboard` after login | Shell fetch only; no students/planning fetch |
| Navigate to `/classes/6a/students` | One people fetch; store seeded for class |
| Edit student name in drawer | List row updates immediately |
| Failed save | Rollback in list + drawer |
| Refresh on `/classes/6a/students/xyz` | List query runs → drawer opens when record in store |
| Create academic year | Shell refresh (Tier 3); domain stores untouched |
| Reschedule timetable slot | Optimistic calendar update; no full reload |
| Generate class report cards | Tier 2 refresh of report-cards domain only |

---

## Related

- [data-loading-spec.md](./data-loading-spec.md) — target architecture
- [app-shell-spec.md](./app-shell-spec.md) — drawer / modal interaction (unchanged)

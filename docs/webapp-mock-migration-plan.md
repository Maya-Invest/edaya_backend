# Webapp mock → API migration plan

Living plan for replacing `apps/webapp` mock data (`$lib/data/school.ts`, `report-cards.ts`, `teachingLog.ts`) with live reads from `apps/api` via the established BFF pattern.

**Related docs**

- [Webapp ↔ API integration plan](./webapp-api-integration-plan.md) — architecture, remote functions, domain mapping
- [Rapport comparaison UI ↔ API](../apps/webapp/docs/rapport-comparaison-ui-api.md) — screen-by-screen gap analysis
- [`@edaya/api-client` README](../packages/api-client/README.md) — typed client usage
- [Better Auth integration plan](./better-auth-integration-plan.md) — auth backend
- [API runtimes](./api-runtimes.md) — headers, session semantics

**Last updated:** 2026-06-11

---

## 1. Goal

End state: when a user is logged in (Better Auth session cookie present), **all primary list/read screens** load from `/api/core/*` through:

1. SvelteKit `+page.server.ts` → `loaders.ts` (`hasSession` gate)
2. `.remote.ts` query **or** `$lib/server/*-data.ts` mapper
3. `getSchoolClient()` transport (cookies + `X-Academic-Year-Id`)
4. Dev seed data in `apps/api/src/lib/seed/` for every migrated slice

Mocks remain only for **unauthenticated demo mode** and `?demo=` load-state scenarios.

---

## 2. Current state (baseline)

### Done — read path wired when `hasSession`

| Slice | Loader / remote | API entities | Mapper | Seed |
|-------|-----------------|--------------|--------|------|
| App shell | `shell.remote.ts` | schools, academic-years, academic-periods, grade-levels, period-definitions, class-groups, enrollments | inline in remote | partial |
| Students (school) | `people.remote.ts` | students, enrollments, guardians, guardian-links | `people-data.ts` | yes |
| Guardians | `people.remote.ts` | same bundle | `people-data.ts` | yes |
| Staff (config) | `people.remote.ts` → `staff-data.ts` | staff-members, staff-role-assignments, staff-assignments, class-groups | `staff-data.ts` | partial |
| Class → students | `loaders.ts` + `people-data.ts` | same as students | filter by enrollment | yes |
| Class → subjects | `loaders.ts` + `subjects-data.ts` | subjects, class-subjects, subject-matters, staff-* | `subjects-data.ts` | yes |
| Session / grants | `+layout.server.ts` | effective-grants | — | via auth seed |
| Login | `authClient.signIn.email` | `/auth/*` | — | yes |

### Partial / technical debt

| Item | Issue | Target fix |
|------|-------|------------|
| `staff-data.ts` | still uses raw `apiFetch` | migrate to `getSchoolClient()` |
| `+layout.server.ts` | `apiFetch` for effective-grants | `client.authorization.effectiveGrants()` |
| `authSession` | duplicates API session in `sessionStorage` | hydrate only from `effective-grants` |
| `permissions.ts` | falls back to mock `staff[0]` | require grants; remove enum fallback |
| Entity list filters | query schemas expect UUIDs; seed ids are `6a`, `s1` | list-all + client filter **or** migrate seed ids to UUIDs |
| Detail drawers | import `$lib/data/school` directly | feed from page data / remote |
| Write flows | all UI mutations are local/mock | route to `/api/core/commands/*` |

### Still 100% mock (loaders without `hasSession`)

| Loader | Mock source | Route(s) |
|--------|-------------|----------|
| `loadSchoolActivitiesPage` | `activities` | `/school/activities` |
| `loadSchoolCalendarPage` | `schoolYearEvents` | `/school/calendar` |
| `loadSchoolEventsPage` | `incidents` | `/school/events` |
| `loadFinancePage` | `fees`, `billing` | `/finance/fees`, `/finance/billing` |
| `loadPaymentsPage` | `billing`, `fees` | `/finance/payment` |
| `loadRolesPage` | `staff` (wrong entity) | `/configuration/roles` |
| `loadConfigSubjectsPage` | `subjects` (UI shape) | `/configuration/subjects` |
| `loadClassTimetablePage` | `planning` | `/classes/[id]/timetable` |
| `loadClassEvaluationsPage` | `evaluations` | `/classes/[id]/evaluations` |
| `loadClassTeachingPage` | `subjects` | `/classes/[id]/teaching` |
| `loadClassReportCardsPage` | shell only | `/classes/[id]/report-cards` |

### Modules bypassing loaders (always mock)

| Module | File | Notes |
|--------|------|-------|
| Report cards context | `report-cards/context.svelte.ts` | definitions, results, grade scales |
| Teaching log | `data/teachingLog.ts` | derived from mock subjects |
| Educator dashboard | `EducatorDashboardView.svelte` | composite mock imports |
| Student detail tabs | `StudentDetailsDialog.svelte` | health, notes, incidents from mock |
| Login school picker | `login/+page.svelte` | mock `schools` array |

---

## 3. Standard slice recipe

Use this checklist for **every** migration PR:

### Webapp

- [ ] Add or extend `$lib/server/<domain>-data.ts` (fetch + map API → UI type)
- [ ] Add remote query in `$lib/remote/<domain>.remote.ts` **or** call mapper from loader (prefer remote when reused)
- [ ] Update loader: `hasSession` + `withApiFallback(mock)`
- [ ] Convert route to `+page.server.ts` with `session` from parent
- [ ] Stop importing mock arrays in the page component
- [ ] Map fields explicitly (document unmapped UI-only fields)

### API / seed

- [ ] Add `SEED_*` entries in `apps/api/src/lib/seed/dataset.ts` aligned with webapp mocks
- [ ] Extend `run-dev-seed.ts` (entities) and `run-dev-access-seed.ts` (permissions + staff assignments)
- [ ] Add permissions to `DEV_WEBAPP_*_READ_PERMISSIONS` if new entity lists are hit
- [ ] Extend `tests/seed/test-dev-access-seed.test.ts` with one list assertion

### Client

- [ ] Run `bun run openapi:generate` if registry/schemas changed
- [ ] `bun run check` in webapp + api tests for seed

### Definition of done (per slice)

1. Logged-in user sees API data on the target screen(s)
2. Logged-out user still sees mocks (no regression)
3. 401/403 falls back to mocks without crashing
4. Dev seed populates enough rows to render non-empty UI
5. No new raw `apiFetch('/api/core/...')` paths in webapp (use `getSchoolClient()`)

---

## 4. Cross-cutting work (do early)

These unblock multiple slices. **Recommended before Phase 2.**

| # | Task | Why | Effort |
|---|------|-----|--------|
| C1 | Migrate `staff-data.ts` + `+layout.server.ts` to `getSchoolClient()` | one HTTP pattern | S |
| C2 | Shared `fetchWithSession()` helper in loaders (DRY `hasSession` from parent) | fewer copy-paste `+page.server.ts` | S |
| C3 | Document UI-only fields per mapper (e.g. `Student.attendance`, `Student.average`) | avoid fake API fields | S |
| C4 | Decide **seed id strategy**: keep human ids (`6a`) vs UUIDs | fixes entity query filters | M |
| C5 | Remove `sessionStorage` auth shadow state; drive UI from `effective-grants` | single session source | M |
| C6 | Wire `academicContext` year header → `X-Academic-Year-Id` on all requests | grant scoping | M |
| C7 | Detail drawer refactor: accept data from page props, not `$lib/data/school` | enables per-entity migration | L |

---

## 5. Phased migration roadmap

### Phase 1 — Finance (high API alignment)

**Target:** fee management screens match API model.

| Slice | UI mock | API entities | Mapper module | Commands (writes) | Seed | Effort |
|-------|---------|--------------|---------------|-------------------|------|--------|
| Fees catalogue | `fees` | `fees` | `finance-data.ts` | `create-fee` | `SEED_FEES` | M |
| Student billing | `billing` | `student-fees` + `students` | join mapper | `assign-fee-to-student`, `adjust-student-fee` | `SEED_STUDENT_FEES` | M |
| Payments | `billing` (paid slice) | `payments` + `student-fees` | `finance-data.ts` | `record-payment`, `reverse-payment` | `SEED_PAYMENTS` | M |

**Routes:** `/finance/fees`, `/finance/billing`, `/finance/payment`

**Permissions to add:** `PAYMENT_READ`, `FEE_READ`, finance query permissions per `run-dev-access-seed.ts`

**Notes**

- `student-fees` and `payments` are `allowDirectSave: false` — read via list; writes via commands only
- UI `billing` installments map to `student-fees` fee lines / installment templates

---

### Phase 2 — Class module (remaining tabs)

**Depends on:** Phase 0 subjects slice (done), C6 academic year header (recommended)

| Slice | UI mock | API entities | Mapper | Seed | Effort |
|-------|---------|--------------|--------|------|--------|
| Timetable | `planning` | `schedules`, `sessions`, `resources` | `scheduling-data.ts` | schedules + sessions for `6a` | L |
| Evaluations | `evaluations` | `assessments`, `assessment-results` | `assessments-data.ts` | assessments per class-subject | L |
| Teaching log | `teachingLog.ts` | `sessions`, `class-subject-progress`, `class-subject-matters` | extend `subjects-data` or new module | session progress rows | L |
| Report cards (class) | `report-cards.ts` results | `results`, `definitions` | `report-cards-data.ts` | definitions + sample results | L |

**Routes:** `/classes/[classId]/timetable`, `/evaluations`, `/teaching`, `/report-cards`

**Notes**

- `planning` day/room/teacher maps to `sessions` + `resource-assignments` + staff assignments
- `evaluations.graded/total` derived from `assessment-results` count
- Teaching log reuses class-subjects from Phase 0

---

### Phase 3 — School life & calendar

| Slice | UI mock | API entities | Mapper | Seed | Effort |
|-------|---------|--------------|--------|------|--------|
| School calendar | `schoolYearEvents` | `calendar-events` | `calendar-data.ts` | holidays + ceremonies | M |
| Incidents / events | `incidents` | `incidents`, `student-incident-involvements`, `disciplinary-actions` | `incidents-data.ts` | sample incidents | L |
| Absences (student detail) | `absences` | `attendance` | part of `people-data` or `attendance-data.ts` | attendance records | M |

**Routes:** `/school/calendar`, `/school/events`, student detail drawers

**Commands for writes:** `record-incident`, `record-attendance`, `create-calendar-event`

---

### Phase 4 — Configuration & access control

| Slice | UI mock | API entities | Mapper | Seed | Effort |
|-------|---------|--------------|--------|------|--------|
| Subject catalogue | `subjects` (config) | `subjects`, `subject-matters`, `grade-levels` | reuse / extend `subjects-data.ts` | already partial | S |
| Roles matrix | `staff` + `StaffRole` enum | `access-roles`, `staff-role-assignments` | `access-data.ts` | expand access seed | L |
| Staff admin (polish) | `staff` | already wired | unify `staff-data` → client | add missing staff from mocks (`st2` done) | S |

**Routes:** `/configuration/subjects`, `/configuration/roles`, `/configuration/staff`

**Product note:** UI has 4 roles; API has granular `Permission` + `access-roles`. Plan UI refactor to permission matrix or map roles → API role ids.

---

### Phase 5 — Student 360° (detail surfaces)

Composite read model across entities for drawers and tabs.

| UI field / tab | API entities |
|----------------|--------------|
| Profile | `students` |
| Class | `enrollments` |
| Guardian | `guardians`, `guardian-links` |
| Health | `student-health-profiles` |
| Notes | `student-notes` |
| Incidents | `student-incident-involvements`, `incidents` |
| Absences | `attendance` |
| Report card panel | `results`, `assessment-results` |

**Deliverable:** `getStudentDetailData(studentId)` remote + seed for health profiles and notes

**Effort:** L (touches many components)

---

### Phase 6 — Report cards module (configuration)

| Slice | Mock file | API entities |
|-------|-----------|--------------|
| Grade scales | `report-cards.ts` | `grade-scales` |
| Definitions | `report-cards.ts` | `definitions`, `sections` |
| Results | `report-cards.ts` | `results` (command-only save) |

**Routes:** `/configuration/grade-scales`, `/configuration/report-cards`, class report views

**Commands:** `create-grade-scale`, `create-report-card-definition`, `generate-report-card-result`, `publish-report-card-result`

**Effort:** L

---

### Phase 7 — Auth & session hardening

| Task | Description |
|------|-------------|
| Login schools list | load from `client.entities.schools.list` instead of mock |
| Remove demo `authSession.setSession(userId)` after sign-in | trust cookie + `effective-grants` |
| `permissions.ts` | 100% from `authSession.grants`; delete `getCurrentUser()` mock fallback |
| Guardian / student portals | test non-staff actors if in scope |
| Cookie / privacy copy | privacy policy mention (session cookies) |

**Effort:** M

---

### Phase 8 — Product decisions (may block migration)

| UI feature | API today | Options |
|------------|-----------|---------|
| Extracurricular activities | **no entity** | (A) new domain entity (B) drop screen (C) map to `calendar-events` with type tag |
| Homework / deadlines | **no entity** | (A) reuse `assessments` with type (B) new entity (C) drop screen |
| Student `honor` / `warning` badges | **no field** | (A) compute from grades + attendance (B) drop badges |
| `periodDefinitions` in header | API = daily time slots, mock = trimester labels | (A) fix shell mapper (B) seed trimester templates separately |
| UI `resources` (rooms) | `resources` + `resource-assignments` | migrate `ResourcesView` or defer |

**Action:** product owner signs off before engineering Phase 3+ items that touch these screens.

---

## 6. Suggested PR sequence (thin vertical slices)

Ordered for reviewable PRs and demo value:

```
PR 1  C1 + C2  Unified client + loader helper
PR 2  Finance fees
PR 3  Finance billing (student-fees)
PR 4  Finance payments
PR 5  Config subjects catalogue
PR 6  School calendar (calendar-events)
PR 7  Class timetable (schedules/sessions)
PR 8  Class evaluations (assessments)
PR 9  Incidents / school events
PR 10 Student detail (read-only composite)
PR 11 Class teaching log + progress
PR 12 Report cards (read)
PR 13 Roles / access-roles UI alignment
PR 14 Auth session cleanup (Phase 7)
PR 15 Write commands (first: register-student, enroll-student, record-payment)
```

Each PR should include seed data for its slice (rule: **no empty logged-in screens** after fresh `bun dev`).

---

## 7. Seed data tracker

Extend `apps/api/src/lib/seed/dataset.ts` as slices land.

| Dataset | Status | Used by |
|---------|--------|---------|
| School, years, periods, grades, classes | done | shell |
| Students + enrollments | done | students, class students |
| Guardians + links | done | guardians, student mapper |
| Staff + role assignments | partial | staff, subjects teachers |
| Subject catalog + matters + class-subjects | done | class subjects |
| Fees | todo | finance |
| Student fees | todo | billing |
| Payments | todo | payments |
| Schedules + sessions | todo | timetable, teaching |
| Assessments + results | todo | evaluations |
| Calendar events | todo | school calendar |
| Incidents + involvements | todo | school events |
| Attendance | todo | absences, educator dashboard |
| Health profiles + student notes | todo | student detail |
| Report card defs + results | todo | report cards |
| Access roles (full matrix) | partial | roles screen |

---

## 8. Permissions tracker

Add to `run-dev-access-seed.ts` when new entity lists are called.

| Permission group | Status | Slices |
|------------------|--------|--------|
| `DEV_WEBAPP_SHELL_READ_PERMISSIONS` | done (+ curriculum) | shell, subjects |
| `DEV_WEBAPP_PEOPLE_READ_PERMISSIONS` | done | students, guardians |
| `DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS` | done | staff config |
| Finance read permissions | todo | fees, billing, payments |
| Assessment read | todo | evaluations |
| Attendance read | todo | absences |
| Discipline read | todo | incidents |
| Report card read/configure | todo | report cards |

Director (`st5`) should eventually receive elevated grants via seed or separate admin role.

---

## 9. Write path strategy (post-read migration)

Reads first; writes in a second wave per domain.

| UI action | API command |
|-----------|-------------|
| Add student | `register-student` + `enroll-student` |
| Edit student | `update-student-profile` |
| Add guardian | `register-guardian` + `link-guardian-to-student` |
| Offer subject to class | `offer-subject-to-class` |
| Assign teacher | `assign-staff-to-class-subject` |
| Record payment | `record-payment` |
| Create assessment | `create-assessment` |
| Record grade | `record-assessment-result` |
| Record attendance | `record-attendance` |
| Record incident | `record-incident` |

Implement as `command` remotes in `$lib/remote/*.remote.ts`, calling `client.commands.*`.

---

## 10. Metrics

Track progress with:

| Metric | Baseline (2026-06-11) | Target |
|--------|----------------------|--------|
| Loaders with `hasSession` API path | 6 / 17 | 17 / 17 |
| `*.remote.ts` modules | 2 | ~8–10 |
| `$lib/server/*-data.ts` mappers | 2 | ~8–10 |
| Routes on `+page.server.ts` | 6 | all data routes |
| Components importing `school.ts` directly | ~50 files | trend down; drawers last |
| Seed datasets for migrated slices | 4 domains | all read slices |

---

## 11. Out of scope (for this plan)

- Mobile / external API clients (JWT bearer)
- Multi-school tenant switching (UI has `SchoolSelector`; API supports multiple schools)
- Real-time subscriptions / websockets
- Full OpenAPI Generator client (using `@edaya/api-client` instead)
- Replacing Better Auth with custom JWT

---

## 12. References

| Resource | Path |
|----------|------|
| API registry (entity/command names) | `apps/api/src/lib/school-api/registry/index.ts` |
| OpenAPI types (webapp) | `apps/webapp/src/lib/api/schema.d.ts` |
| Loader entry points | `apps/webapp/src/lib/data/loaders.ts` |
| Dev seed dataset | `apps/api/src/lib/seed/dataset.ts` |
| Access / permissions seed | `apps/api/src/lib/seed/run-dev-access-seed.ts` |

When a slice ships, update **§2 Current state**, **§7 Seed tracker**, and **§10 Metrics** in this document.

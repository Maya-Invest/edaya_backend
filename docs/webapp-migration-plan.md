# Webapp migration plan — API-backed static SPA

**Goal:** delete all runtime mock data from `apps/webapp`, load everything from `apps/api` (PGLite seed in dev), and deploy the UI as a **static SPA on Cloudflare Pages** (no SSR worker cost) talking to the API on a **separate domain**.

**Supersedes:** [webapp-mock-migration-plan](./done/webapp-mock-migration-plan.md) and any separate SPA plan. Seed side is done — see [mock-to-pglite-migration-plan](./done/mock-to-pglite-migration-plan.md). Former filename: `mock-removal-plan.md`.

**Last updated:** 2026-06-11

---

## Scope decisions (fixed)

| Decision | Choice |
|----------|--------|
| **UI hosting** | Static SPA on Cloudflare Pages — `adapter-static`, no Pages Functions / worker invocations for the webapp |
| **API hosting** | Cloudflare Worker — `apps/api` on its own domain (e.g. `api.edaya.com`) |
| **Domains** | Split domain — prefer **subdomains on one parent** (`app.edaya.com` + `api.edaya.com`) over unrelated TLDs |
| **Schools** | **One school only** — `sch-edaya-central` (remove nord picker, prototype `schools/list`, mock `schools[]`) |
| **Unauthenticated UI** | **No mock browsing** — `/login` required |
| **Missing core entities** | **Prototype endpoints** under `/core/prototype/*` backed by `@edaya/dev-fixtures` |
| **UI-only fields** | **Compute in mappers** when obvious; **extend core entity / seed** when the field is real product data |
| **Auth** | **Better Auth** — email + password demo login; session from httpOnly cookie on API domain + `effective-grants` |
| **Data loading** | **Client query modules** (`$lib/queries/*.ts`) — browser calls API via `@edaya/api-client`; no BFF, no mock fallbacks |
| **Routing** | Keep SvelteKit file-based routing (`+page.svelte`, layouts, URL-backed drawers) — routing only, not SSR |

---

## 1. End-state architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────────┐
│  app.edaya.com               │  CORS   │  api.edaya.com                   │
│  Cloudflare Pages (static)   │ ──────► │  Cloudflare Worker (Hono)        │
│                              │ cookies │                                  │
│  SvelteKit SPA (ssr: false)  │         │  Better Auth  /auth/*            │
│  +page.svelte / layouts      │         │  School API   /core/*            │
│       │                      │         │  PGLite + seed (dev)             │
│       ▼                      │         └──────────────────────────────────┘
│  $lib/queries/*.ts           │
│       │                      │
│       ├── createBrowserTransport()
│       │     credentials: 'include'
│       ├── createSchoolClient()  →  /core/entities/*, /core/queries/*
│       └── apiFetch()            →  /core/prototype/*
│       ▼
│  $lib/api/*-data.ts          ← map API DTO → UI types (browser-safe)
└──────────────────────────────┘

Deleted:
  $lib/data/school.ts arrays
  $lib/data/report-cards.ts arrays
  $lib/data/teachingLog.ts demo entries
  $lib/data/loaders.ts
  $lib/data/loaders.server.ts
  $lib/server/api-client.ts, $lib/server/school-client.ts
  All +page.server.ts / root data loads in +layout.server.ts
  SvelteKit remote functions ($lib/remote/*.remote.ts) — convert, do not extend
  withApiFallback(mock), sessionStorage auth shadow
  academicContext / reportCardsContext mock seed initialization
  Cloudflare worker binding for webapp (wrangler `_worker.js`)
```

### Why not SSR or a BFF?

| Approach | Problem for this project |
|----------|--------------------------|
| SvelteKit SSR + `+page.server.ts` | Worker invocation cost on every navigation; split-domain cookies don't reach a webapp BFF |
| SvelteKit CSR (`ssr: false`) + server loads | Still hits SvelteKit server endpoints — worker cost remains |
| SvelteKit remote functions (`$app/server`) | Require a SvelteKit server — incompatible with static-only hosting |
| **Static SPA + direct API** | Zero webapp worker cost; auth cookies owned by API domain; matches split-domain deploy |

### Client query conventions

| Rule | Detail |
|------|--------|
| One file per domain | `shell.queries.ts`, `people.queries.ts`, `finance.queries.ts`, … |
| Query = thin | `export async function getStudents() { return mapStudents(await client.entities.students.list({})) }` — mapping stays in `*-data.ts` |
| No raw `fetch` in components | Components call query functions or receive props from parent pages that called them |
| Prototype | Group under `prototype.queries.ts` wrapping `/core/prototype/*` |
| Types | UI interfaces in `$lib/types/` (no seed arrays) |
| Academic year header | Browser transport sends `X-Academic-Year-Id` from `academicContext` |
| Errors | 401 → redirect `/login`; other errors → `DataState` error + toast on mutations |

### Page load pattern (target)

```ts
// +page.svelte (or +page.ts with ssr: false — no +page.server.ts)
<script lang="ts">
  import { getClassEvaluations } from '$lib/queries/assessments.queries';
  import { DataState } from '$lib/components/DataState.svelte';

  let evaluations = $state<Evaluation[] | null>(null);
  let error = $state<unknown>(null);

  $effect(() => {
    getClassEvaluations(classId).then(v => evaluations = v).catch(e => error = e);
  });
</script>

<DataState loading={!evaluations && !error} {error} empty={evaluations?.length === 0}>
  <!-- list view -->
</DataState>
```

For routes that already receive shell data from the app layout bootstrap, pages may read from context instead of re-fetching.

---

## 2. Authentication & login

### Production auth (split domain)

**Preferred:** subdomains on one registrable domain.

| Host | Role |
|------|------|
| `app.edaya.com` | Static SPA |
| `api.edaya.com` | API + Better Auth |

API Better Auth config (`create-auth.ts`):

```ts
baseURL: env.BETTER_AUTH_URL,           // https://api.edaya.com
trustedOrigins: ['https://app.edaya.com'],
advanced: {
  crossSubDomainCookies: { enabled: true, domain: 'edaya.com' },
},
```

**Fallback (unrelated root domains):** use `crossOriginCookies` + `sameSite: 'none'` + `secure: true`. Less reliable in Safari — accept or plan token fallback later.

Webapp auth client:

```ts
// $lib/auth/client.ts
export const authClient = createAuthClient({
  baseURL: import.meta.env.PUBLIC_API_URL,  // https://api.edaya.com
  basePath: '/auth',
  fetchOptions: { credentials: 'include' },
});
```

API CORS (`create-app.ts`) — replace hardcoded localhost with env-driven origins:

```ts
cors({
  origin: env.TRUSTED_ORIGINS.split(','),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Cookie', 'X-Academic-Year-Id'],
  credentials: true,
})
```

### Session bootstrap (SPA)

```
App mount (+layout.svelte)
  → GET PUBLIC_API_URL/core/authorization/effective-grants  (credentials: include)
  → if 401: authSession.clear(); stay on /login or redirect
  → if 200: authSession.setFromServer(session); fetch staff profile if staff
  → parallel: getAppShellData() for shell context
  → render app shell
```

No `sessionStorage` user/school shadow. `isLoggedIn` derives from `effective-grants` only.

### Demo login page — current problems

- `authSession.setSession(userId, schoolId)` writes **mock staff id** to `sessionStorage` before server confirms grants
- `authSession.user` falls back to mock `staff[]` when `userProfile` is missing
- School picker uses mock `schools[]` (two schools)
- `DEMO_ACCOUNTS` built from mock `staff` (wrong roles/names vs seed)
- `invalidateAll()` assumes SSR reload — replace with explicit session + shell re-bootstrap

### Demo login — target flow

```
Login click (demo account)
  → authClient.signIn.email({ email, password: DEV_AUTH_PASSWORD })
  → cookie set by Better Auth on api domain
  → bootstrapSession() — fetch effective-grants + staff profile
  → bootstrapAppShell() — fetch shell data into contexts
  → redirect to app
```

### Auth work items

| # | Task |
|---|------|
| A1 | Add `POST /core/prototype/demo-accounts/list` → `DEV_AUTH_STAFF_ACCOUNTS` (+ role from seed staff assignments) |
| A2 | Login page: load accounts via `getDemoAccounts()` query; **remove school picker** |
| A3 | Login: only `signIn.email` + client bootstrap — **delete** `setSession` / `setSchool` / mock paths |
| A4 | `authSession`: derive state from `effective-grants` fetch — **remove** `sessionStorage` user/school keys |
| A5 | `(app)/+layout.svelte`: redirect to `/login` when bootstrap completes with no session |
| A6 | `permissions.ts`: use `authSession.grants` only — delete mock `staff[0]` fallback |
| A7 | Remove `sch-edaya-nord` from mock, prototype `schools/list`, shell merge, docs |
| A8 | API: `crossSubDomainCookies` (or `crossOriginCookies`) + env `TRUSTED_ORIGINS` |
| A9 | Webapp: `authClient.baseURL = PUBLIC_API_URL`; add `bootstrapSession()` used on app mount and post-login |
| A10 | Dev: keep Vite proxy (`/auth`, `/core` → localhost:9999) so `PUBLIC_API_URL` can stay empty/same-origin in dev |

---

## 3. Browser transport & API client

Add to `apps/webapp` (or extend `@edaya/api-client`):

```ts
// $lib/api/browser-transport.ts
import { PUBLIC_API_URL } from '$env/static/public';
import { ApiError } from '@edaya/api-client';

export function createBrowserTransport(getYearId: () => string | undefined): Transport {
  return {
    async request(method, path, options) {
      const headers = new Headers({ Accept: 'application/json' });
      if (options?.body !== undefined) headers.set('Content-Type', 'application/json');
      const yearId = getYearId();
      if (yearId) headers.set('X-Academic-Year-Id', yearId);

      const base = PUBLIC_API_URL || '';  // empty = same-origin (dev proxy)
      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      });
      // ... ApiError handling (mirror server transport)
    },
  };
}
```

Move mappers from `$lib/server/*-data.ts` → `$lib/api/*-data.ts`. They become browser-safe (no `$env/static/private`, no `getRequestEvent()`). Inject `getSchoolClient` (or transport) as a parameter where mappers today call it directly — keeps mappers testable and free of singletons.

Add `$lib/api/browser-fetch.ts` for prototype routes (`/core/prototype/*`) — same JSON/error handling as today's server `apiFetch`, without entity-envelope unwrapping (prototype responses are plain JSON).

**In-progress note:** `shell.remote.ts` and `people.remote.ts` exist as server remotes — **do not extend**. Convert their logic into `$lib/queries/shell.queries.ts` and `$lib/queries/people.queries.ts` using the browser transport, then delete the remote files.

---

## 4. Prototype API surface (no core entity yet)

Existing:

| Endpoint | Data |
|----------|------|
| `POST /core/prototype/activities/list` | `SEED_ACTIVITIES` |
| `POST /core/prototype/deadlines/list` | `SEED_DEADLINES` |
| `POST /core/prototype/teaching-log/list` | `SEED_TEACHING_LOG_ENTRIES` |

Add:

| Endpoint | Purpose |
|----------|---------|
| `POST /core/prototype/demo-accounts/list` | Login page account cards |

Remove / do not add:

| Endpoint | Reason |
|----------|--------|
| `POST /core/prototype/schools/list` | Single school — use `entities/schools/list` |

**Rule:** if a screen needs data with **no** `ManagedEntityService` in core, add a prototype route + `SEED_*` fixture + webapp query — never re-add mock arrays.

---

## 5. UI-only fields — resolution matrix

Fields below exist on webapp UI types but not (fully) on API responses today. Each row picks **Compute**, **Entity**, or **Drop**.

### Students (`Student`)

| Field | Strategy | Implementation |
|-------|----------|------------------|
| `initials` | **Compute** | `firstName[0]+lastName[0]` in `people-data.ts` ✅ |
| `name` | **Compute** | `firstName + lastName` ✅ |
| `classId` | **Compute** | active enrollment ✅ |
| `guardian` | **Compute** | guardian link + name ✅ |
| `email` | **Compute** (dev) / **Entity** (prod) | Dev: derive from name; Prod: add student contact |
| `birthdate` | **Entity** | Map `Student.birthDate` ✅ |
| `status` | **Compute** | Map core `StudentStatus` + optional honor rule |
| `attendance` | **Compute** | `attendanceRecords` → % present for current period |
| `average` | **Compute** | weighted mean from `assessment-results` for period |

### Staff (`StaffMember`)

| Field | Strategy | Implementation |
|-------|----------|------------------|
| `initials` | **Compute** | from staff member name |
| `role` | **Compute** | from `staff-role-assignments` ✅ |
| `email` | **Entity** | from auth user link / staff contact when added |
| `classIds`, `subjectIds` | **Compute** | staff-assignments + class-subjects |

### Subjects (`Subject`)

| Field | Strategy | Implementation |
|-------|----------|------------------|
| `teacher` | **Compute** | staff-assignment on class-subject |
| `hoursPerWeek` | **Entity** | add to `ClassSubject` or read from schedule |
| `description`, `category` | **Entity** | optional fields on `Subject` catalog |
| `color` | **Compute** | hash subject id → palette |

### Evaluations, guardians, report cards, prototype data

Same as prior plan — compute in mappers where possible; prototype routes for activities/deadlines/teaching-log until domain entities exist. See git history for full tables if needed.

---

## 6. Client contexts — refactor

Today `academicContext`, `reportCardsContext`, `teachingLogContext` boot from mock and optionally hydrate from layout server props.

| Context | Target |
|---------|--------|
| `academicContext` | Initialize **empty**; `initFromShell(shellData)` after client bootstrap; local mutations call API commands (phase 6) |
| `reportCardsContext` | Same — hydrate from `getReportCardsData()` query |
| `teachingLogContext` | Same — hydrate from `getTeachingLogEntries()` query |
| `getRuntimeClasses()` etc. | **Delete** — use context or page query results, not mock fallback |

**SPA rule:** never branch on `browser ? context : mock`. Single client fetch path; show loading state until bootstrap completes.

---

## 7. Client query module map (target)

| Query file | Functions | Source |
|------------|-----------|--------|
| `shell.queries.ts` | `getAppShellData` | entities: schools, years, periods, grade-levels, period-definitions, class-groups, enrollments |
| `people.queries.ts` | `getStudents`, `getGuardians`, `getStaff` | entities + `people-data.ts` |
| `finance.queries.ts` | `getFees`, `getBilling`, `getPayments` | entities + `finance-data.ts` |
| `planning.queries.ts` | `getClassTimetable`, `getResources` | entities + `planning-data.ts` |
| `assessments.queries.ts` | `getClassEvaluations` | entities + `assessments-data.ts` |
| `subjects.queries.ts` | `getClassSubjects`, `getConfigSubjects` | entities + `subjects-data.ts` |
| `school-life.queries.ts` | `getCalendarEvents`, `getIncidents`, `getAbsences` | entities + `school-life-data.ts` |
| `student-360.queries.ts` | `getHealthProfiles`, `getPedagogicalNotes` | entities + `student-360-data.ts` |
| `report-cards.queries.ts` | `getGradeScales`, `getDefinitions`, `getResults` | entities + `report-cards-data.ts` |
| `access.queries.ts` | `getAccessRoles` | entities + `access-roles-data.ts` |
| `prototype.queries.ts` | activities, deadlines, teaching-log, demo-accounts | `/core/prototype/*` |
| `auth.queries.ts` | `getSession`, `getStaffProfile` | `effective-grants` + staff entity |

### Delete after queries wired

- `$lib/data/loaders.ts`, `$lib/data/loaders.server.ts`
- `$lib/server/api-client.ts`, `$lib/server/school-client.ts`
- `$lib/server/*-data.ts` (after move to `$lib/api/`)
- `$lib/remote/*.remote.ts`
- All `+page.server.ts` and data-bearing `+layout.server.ts` loads
- Remaining client-only `+page.ts` files that call mock `loaders.ts`

---

## 8. Component migration — kill direct mock imports

| Component / module | Replace with |
|--------------------|--------------|
| `EducatorDashboardView.svelte` | shell context + `school-life.queries` + `assessments.queries` |
| `StudentDetailsDialog.svelte`, `StudentTabs.svelte` | `student-360.queries` + page data |
| `ActivityDetail.svelte` | activity from page + `people.queries` |
| `HomeworkView.svelte` | page `deadlines` from `prototype.queries` |
| `ResourcesView.svelte` | `planning.queries` |
| `StaffPermissionsBlock.svelte` | shell classes/subjects from context |
| `RoleDetail.svelte` | `access.queries` + staff query |
| `BillingDetail.svelte`, `EvaluationForm.svelte`, … | props from parent page query |
| `detail-routes.ts` | resolve from page stores / context |
| `permissions.ts` | grants only |
| `login/+page.svelte` | `getDemoAccounts()` query + client bootstrap |

**Gate:** `rg "from '\$lib/data/school'" apps/webapp` → **type-only** imports (or zero).

---

## 9. Deployment & Cloudflare

### Webapp — static only

```js
// svelte.config.js (target)
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ fallback: 'index.html' }),  // SPA mode
    prerender: { entries: [] },                   // or crawl for public routes
  },
};
```

Root layout:

```ts
// src/routes/+layout.ts
export const ssr = false;
export const prerender = true;
```

Deploy: Cloudflare Pages **direct upload** or Git integration — static assets only, **no** `wrangler.jsonc` worker binding.

Remove current `adapter-cloudflare` worker config (`exclude: ['<all>']` was a partial step — replace with `adapter-static`).

### API — worker (unchanged)

`apps/api` stays on Cloudflare Worker. All dynamic cost is here, which is expected.

### Environment variables

| Var | Where | Purpose |
|-----|-------|---------|
| `PUBLIC_API_URL` | webapp | `https://api.edaya.com` (empty in dev → Vite proxy) |
| `BETTER_AUTH_URL` | api | `https://api.edaya.com` |
| `TRUSTED_ORIGINS` | api | `https://app.edaya.com` (+ localhost for dev) |
| `BETTER_AUTH_SECRET` | api | secret |

### Local dev (unchanged)

`bun dev` at repo root — Vite proxies `/auth` and `/core` to `:9999`. Browser sees same-origin requests; cookies work without cross-domain config.

---

## 10. Phased delivery

Phases are sequential. Do not extend server remotes or `+page.server.ts` — every new data path should use client queries.

### Phase 0 — Foundations (1 PR)

- [ ] Browser transport + `getSchoolClient()` browser singleton
- [ ] Move `*-data.ts` mappers to `$lib/api/` (browser-safe)
- [ ] Auth A1–A7, A8–A10 (real login, API cookie config, client bootstrap)
- [ ] Split `$lib/types/school.ts`, `$lib/types/report-cards.ts` from mock files
- [ ] Delete `withApiFallback(mock)` — API errors surface properly (401 → login)
- [ ] Remove nord school / prototype schools list
- [ ] API CORS origins from env

### Phase 1 — Client query layer + app bootstrap (1–2 PRs)

- [ ] Create all `$lib/queries/*.ts` modules (table §7)
- [ ] Convert existing `shell.remote.ts` / `people.remote.ts` → queries; delete remotes
- [ ] `(app)/+layout.svelte`: `bootstrapSession()` + `bootstrapAppShell()` on mount
- [ ] Refactor contexts: empty init + hydrate from bootstrap
- [ ] Delete `getRuntime*` mock fallbacks
- [ ] Remove `(app)/+layout.server.ts` data loads (keep file deleted or empty)

### Phase 2 — Page migration (2–3 PRs)

Migrate each route to client queries; delete corresponding `+page.server.ts` and `loaders.server.ts` paths:

| Route group | Query module(s) |
|-------------|-----------------|
| `/school/students`, guardians, staff | `people.queries` |
| `/finance/*` | `finance.queries` |
| `/school/calendar`, events | `school-life.queries` |
| `/school/activities` | `prototype.queries` |
| `/classes/[id]/*` | planning, subjects, assessments, prototype |
| `/configuration/*` | subjects, report-cards, access |

Remaining client `+page.ts` files calling mock `loaders.ts` → convert or delete.

### Phase 3 — UI-only compute (1–2 PRs)

- [ ] Student attendance % from `attendanceRecords`
- [ ] Student average from `assessment-results`
- [ ] Evaluation aggregates in `assessments-data.ts`
- [ ] Subject color/category (entity or compute)
- [ ] Seed `rcd-ms-draft` or remove from UI

### Phase 4 — Delete mocks & server BFF (1 PR)

- [ ] Delete mock arrays from `school.ts`, `report-cards.ts`, `teachingLog.ts`
- [ ] Delete `loaders.ts`, `loaders.server.ts`
- [ ] Delete `$lib/server/api-client.ts`, `$lib/server/school-client.ts`
- [ ] Delete all `+page.server.ts`, root `+layout.server.ts` session/API loads (session moves to client bootstrap entirely)
- [ ] Remove unused nord fixtures

### Phase 5 — Static SPA cutover (1 PR)

- [ ] Switch to `@sveltejs/adapter-static` + `ssr = false`
- [ ] Add SPA fallback (`index.html`)
- [ ] Remove webapp `wrangler.jsonc` worker binding; update deploy scripts
- [ ] Verify production CORS + cookie config on staging
- [ ] Update OpenAPI generate if prototype demo-accounts added

### Phase 6 — Writes (follow-up, out of scope)

Wire context mutations to `/core/commands/*` (create year, publish bulletin, etc.).

---

## 11. Definition of done

| Check | Expected |
|-------|----------|
| `rg "from '\$lib/data/school'" apps/webapp` | **type-only** imports (or zero) |
| `rg "withApiFallback" apps/webapp` | **0** |
| `rg "loadMock" apps/webapp` | **0** |
| `rg "sessionStorage.*edaya:" apps/webapp` | **0** |
| `rg "\\+page\\.server\\.ts" apps/webapp/src/routes` | **0** |
| `rg "\\$lib/server/" apps/webapp` | **0** (after mapper move) |
| `rg "\\.remote\\.ts" apps/webapp` | **0** |
| Logged-out visit to `/school/*` | redirect `/login` |
| Login as `m.dupont@school.edu` / `DevPassword1!` | all primary screens non-empty |
| `bun run fullcheck` | green |
| Mock file line count | `school.ts` / `report-cards.ts` → types + helpers only (< 150 lines each) |
| Webapp deploy | static assets only, no Pages Functions |
| API + webapp staging | cross-domain auth persists across refresh |

---

## 12. Risk register

| Risk | Mitigation |
|------|------------|
| Safari blocks cross-domain cookies | Prefer `app.*` + `api.*` on same parent domain; test Safari early in Phase 5 |
| Login flash before redirect | Show shell loading gate until `bootstrapSession()` resolves |
| Slow app bootstrap (many entity lists) | Parallel fetch in `getAppShellData()`; consider aggregate queries later |
| Missing compute makes UI blank | Phase 3 before Phase 4 delete; show `—` for unavailable fields |
| Prototype drift from future entities | Fixtures in `@edaya/dev-fixtures` only; prototype routes are thin passthrough |
| Login race (user not found) | Keep retry loop ✅; ensure auth seed completes before webapp in dev |
| Partial remote work wasted | Convert existing remotes in Phase 1 — do not add new server remotes |
| CORS misconfiguration in prod | Staging deploy in Phase 5 before cutover; env-driven origins |

---

## 13. Tracker (living)

| Phase | Status | PR |
|-------|--------|-----|
| 0 — Transport + auth + types | 🟡 | in progress |
| 1 — Client queries + bootstrap | ⬜ | |
| 2 — Page migration | ⬜ | |
| 3 — UI-only compute | ⬜ | |
| 4 — Delete mocks & server BFF | ⬜ | |
| 5 — Static SPA deploy | ⬜ | |
| 6 — Commands (writes) | ⬜ | |

Update this table at each PR merge.

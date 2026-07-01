# Webapp migration plan — API-backed static SPA

**Goal:** zero runtime mock data in `apps/webapp`; all reads from `apps/api` (PGLite seed in dev); deploy as a **static SPA on Cloudflare Pages** talking to the API on a **separate domain**.

**Supersedes:** [webapp-mock-migration-plan](./webapp-mock-migration-plan.md). Seed side is done — [mock-to-pglite-migration-plan](./mock-to-pglite-migration-plan.md).

**Last updated:** 2026-06-11

---

## Progress dashboard

| Indicator | Status |
|-----------|--------|
| **Mock arrays** | ✅ Removed from `school.ts`, `report-cards.ts`, `teachingLog.ts` |
| **Server BFF** | ✅ No `+page.server.ts`, no `loaders.server.ts`, no `$lib/remote/*.remote.ts` |
| **Client queries** | ✅ `$lib/queries/*.ts` + `$lib/api/*-data.ts` |
| **Auth** | ✅ Better Auth email/password + `bootstrapSession()`; no auth `sessionStorage` |
| **App bootstrap** | ✅ `bootstrapAppShell()` hydrates contexts from API |
| **Static SPA** | ✅ `adapter-static`, `ssr = false` |
| **Pages on API** | ✅ 19 list routes via `PageQuery`; shell/config via bootstrap context |
| **Remaining cleanup** | ✅ Read path + Phase 6 writes complete |

```
[████████████████████]  100 % — mock removal + API writes
 Phase 0–6 done
```

---

## Scope decisions (fixed)

| Decision | Choice |
|----------|--------|
| **UI hosting** | Static SPA on Cloudflare Pages — `adapter-static`, no Pages Functions for the webapp |
| **API hosting** | Cloudflare Worker — `apps/api` on its own domain (e.g. `api.edaya.com`) |
| **Domains** | Split domain — prefer subdomains on one parent (`app.edaya.com` + `api.edaya.com`) |
| **Schools** | **One school only** — `sch-edaya-central` (no nord picker, no `prototype/schools/list`) |
| **Unauthenticated UI** | **No mock browsing** — `/login` required |
| **Missing core entities** | **Prototype endpoints** under `/core/prototype/*` backed by `@edaya/dev-fixtures` |
| **UI-only fields** | **Compute in mappers** when obvious; **extend core entity / seed** when product data |
| **Auth** | **Better Auth** — email + password demo login; session from httpOnly cookie + `effective-grants` |
| **Data loading** | **Client query modules** (`$lib/queries/*.ts`) — browser → API via `@edaya/api-client`; no BFF, no mock fallbacks |
| **Routing** | SvelteKit file-based routing (`+page.svelte`, layouts, URL-backed drawers) — routing only, not SSR |

> **Note:** SvelteKit remote functions (`$app/server`) were evaluated and **not used** — they require a SvelteKit server, which conflicts with static-only hosting. Client queries are the final pattern.

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
│       ├── getBrowserSchoolClient()
│       │     credentials: 'include', X-Academic-Year-Id
│       ├── createSchoolClient()  →  /core/entities/*, /core/queries/*
│       └── browserFetch()        →  /core/prototype/*
│       ▼
│  $lib/api/*-data.ts          ← map API DTO → UI types (browser-safe)
└──────────────────────────────┘

Removed (done):
  Mock arrays and `$lib/data/*` (types → `$lib/types/*`, helpers → `$lib/academic/hierarchy.ts`, `$lib/page/load-state.ts`)
  `$lib/server/*` duplicate mappers
  loaders.ts, loaders.server.ts, +page.server.ts
  $lib/remote/*.remote.ts
  withApiFallback(mock), auth sessionStorage shadow
  academicContext / reportCardsContext mock seed defaults

Still to remove:
  None for read path — Phase 6 writes only
```

### Why not SSR or a BFF?

| Approach | Problem for this project |
|----------|--------------------------|
| SvelteKit SSR + `+page.server.ts` | Worker cost on every navigation; split-domain cookies don't reach a webapp BFF |
| SvelteKit remote functions | Require a SvelteKit server — incompatible with static-only hosting |
| **Static SPA + direct API** | Zero webapp worker cost; auth cookies on API domain; matches split-domain deploy |

### Data loading patterns (implemented)

**A — App shell (once per session)**

```
(app)/+layout.svelte mount
  → bootstrapSession()        (root +layout.svelte on every visit)
  → bootstrapAppShell()       (when logged in)
       → getAppShellData()
       → getReportCardsLayoutData()
       → fetchTeachingLogEntries()
       → getDetailDataSnapshot(classIds)
  → academicContext.initFromShell(...)
  → detailDataContext, reportCardsContext, teachingLogContext hydrate
```

**B — Page lists (per route)**

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import PageQuery from '$lib/components/ui/PageQuery.svelte';
  import { querySchoolStudentsPage } from '$lib/queries/people.queries';
  const query = querySchoolStudentsPage();
</script>

<PageQuery {query} loadingTitle="…">
  {#snippet children(data)}
    <SchoolStudentsView students={data.students} … />
  {/snippet}
</PageQuery>
```

**C — Config screens fed by bootstrap context**

Grade scales, academic admin, report-card definitions list read from `reportCardsContext` / `academicContext` after shell bootstrap — no second fetch needed.

### Client query conventions

| Rule | Detail |
|------|--------|
| One file per domain | `shell.queries.ts`, `people.queries.ts`, `finance.queries.ts`, … |
| Query = thin | delegates to `$lib/api/*-data.ts` mappers |
| No raw `fetch` in components | Use `PageQuery` or context from bootstrap |
| Prototype | `prototype.queries.ts` → `browserFetch('/core/prototype/*')` |
| Types | `$lib/types/school.ts`, `$lib/types/report-cards.ts`, `$lib/types/teaching-log.ts` |
| Academic year header | `configureBrowserSchoolClient({ getYearId: () => academicContext.yearId })` |
| Errors | 401 → `authSession.clear()` + redirect `/login`; mutations → toast |

---

## 2. Authentication & login

### Implemented ✅

| Item | Location |
|------|----------|
| `bootstrapSession()` | `$lib/auth/bootstrap.ts` — fetches `effective-grants`, loads staff profile |
| Demo login | `login/+page.svelte` — `authClient.signIn.email` + `bootstrapSession()` |
| Demo accounts API | `POST /core/prototype/demo-accounts/list` |
| No auth sessionStorage | `authSession` — grants-driven `isLoggedIn` |
| Single school | Hardcoded in `authSession.school` from `session.schoolId` |
| App gate | `(app)/+layout.svelte` redirects when `!authSession.isLoggedIn` |
| Permissions | `$lib/permissions.ts` — grants only, no mock staff fallback |
| CORS + cookies (dev) | `TRUSTED_ORIGINS` in API env; Vite proxy same-origin locally |
| Staging CORS + cookies | ✅ `test-cors-config.test.ts`, `test-staging-cors-auth.test.ts` |

### Production auth (split domain) — staging checklist

| Host | Role |
|------|------|
| `app.edaya.com` | Static SPA |
| `api.edaya.com` | API + Better Auth |

API (`create-auth.ts`): `crossSubDomainCookies` when `BETTER_AUTH_COOKIE_DOMAIN` set. Webapp: `PUBLIC_API_URL` + `authClient` with `credentials: 'include'`.

| # | Task | Status |
|---|------|--------|
| A8 | API CORS origins from env | ✅ dev |
| A9 | `PUBLIC_API_URL` on webapp; client bootstrap | ✅ |
| A10 | Vite proxy for local dev | ✅ |
| — | Staging verify Safari cross-subdomain cookies | ⬜ Phase 5 staging |

---

## 3. Browser transport & API client

**Implemented** in `$lib/api/`:

| Module | Role |
|--------|------|
| `browser-transport.ts` / `school-client.ts` | Typed entity client + `X-Academic-Year-Id` |
| `browser-fetch.ts` | Prototype routes, `effective-grants` |
| `check-api-health.ts` | Login page API readiness |
| `*-data.ts` | Mappers (moved from `$lib/server/`) |

**Cleanup:** `$lib/server/` removed — mappers live only in `$lib/api/`.

---

## 4. Prototype API surface

| Endpoint | Data | Status |
|----------|------|--------|
| `POST /core/prototype/activities/list` | `SEED_ACTIVITIES` | ✅ |
| `POST /core/prototype/deadlines/list` | `SEED_DEADLINES` | ✅ |
| `POST /core/prototype/teaching-log/list` | `SEED_TEACHING_LOG_ENTRIES` | ✅ |
| `POST /core/prototype/demo-accounts/list` | `DEV_AUTH_STAFF_ACCOUNTS` + roles | ✅ |
| ~~`POST /core/prototype/schools/list`~~ | — | **Removed** (single school) |

**Rule:** no core entity → prototype route + `SEED_*` + `prototype.queries.ts` — never mock arrays.

---

## 5. UI-only fields — resolution matrix

### Done in mappers ✅

| Field | Where |
|-------|--------|
| Student `initials`, `name`, `classId`, `guardian` | `people-data.ts` |
| Student `average` | weighted from assessment results |
| Student `status` | from `StudentStatus` + average rules |
| Student `attendance` | computed from attendance records |
| Staff `role`, assignments | `staff-data.ts` |
| Guardian `initials`, `preferredContact`, `studentIds` | `people-data.ts` |

### Still open 🟡

| Field | Strategy | Action |
|-------|----------|--------|
| Student `email` | Compute (dev) / Entity (prod) | Derive or add contact field |
| Client-only report card generation | Phase 6 | wire `/core/commands/*` |

---

## 6. Client contexts

| Context | Status |
|---------|--------|
| `academicContext` | ✅ empty init → `initFromShell()`; year/period in `sessionStorage` (UX preference, not auth) |
| `reportCardsContext` | ✅ hydrate from bootstrap; local publish mutations still client-only |
| `teachingLogContext` | ✅ hydrate from prototype query |
| `detailDataContext` | ✅ snapshot for drawers / educator dashboard |
| `getRuntime*` helpers | ✅ removed |

---

## 7. Client query module map

| Query file | Status |
|------------|--------|
| `shell.queries.ts` | ✅ |
| `people.queries.ts` | ✅ |
| `finance.queries.ts` | ✅ |
| `planning.queries.ts` | ✅ |
| `assessments.queries.ts` | ✅ |
| `subjects.queries.ts` | ✅ |
| `school-life.queries.ts` | ✅ |
| `student-360.queries.ts` | ✅ |
| `report-cards.queries.ts` | ✅ |
| `access.queries.ts` | ✅ |
| `prototype.queries.ts` | ✅ |
| `detail-data.queries.ts` | ✅ |

### Routes using `PageQuery` (19)

`school/students`, `guardians`, `calendar`, `events`, `activities` · `finance/fees`, `billing`, `payment` · `classes/[id]/*` (students, subjects, timetable, teaching, homework, evaluations, report-cards) · `configuration/staff`, `subjects`, `subjects/level`, `roles`

### Routes using bootstrap context only (4)

`configuration/grade-scales`, `academic`, `classes`, `report-cards/[[id]]` (definitions list)

---

## 8. Component migration

Direct mock **value** imports: **0**. Types live under `$lib/types/*`.

Detail drawers resolve via `detailDataContext` + `reportCardsContext` after bootstrap — no mock imports in `detail-routes.ts` values.

---

## 9. Deployment & Cloudflare

### Webapp — static ✅

```js
// svelte.config.js
adapter: adapter({ fallback: '200.html', strict: false })
// routes/+layout.ts
export const ssr = false;
export const prerender = true;
```

### Environment variables

| Var | Where | Purpose |
|-----|-------|---------|
| `PUBLIC_API_URL` | webapp | `https://api.edaya.com` (empty in dev → Vite proxy) |
| `BETTER_AUTH_URL` | api | public API URL |
| `TRUSTED_ORIGINS` | api | SPA origin(s) |
| `BETTER_AUTH_COOKIE_DOMAIN` | api | e.g. `edaya.com` for cross-subdomain cookies |

### Local dev

`bun dev` — Vite proxies `/auth` and `/core` to `:9999`. Browser same-origin; no cross-domain cookie setup needed.

---

## 10. Phased delivery

### Phase 0 — Foundations ✅

- [x] Browser transport + `getBrowserSchoolClient()`
- [x] Mappers in `$lib/api/*-data.ts`
- [x] Auth: demo-accounts prototype, real sign-in, no auth sessionStorage
- [x] Single school (no nord)
- [x] API CORS from env (dev)
- [x] Delete `withApiFallback(mock)`

### Phase 1 — Client query layer + bootstrap ✅

- [x] All `$lib/queries/*.ts` modules
- [x] Converted / deleted `shell.remote.ts`, `people.remote.ts`
- [x] `(app)/+layout.svelte`: `bootstrapAppShell()` on mount
- [x] Contexts: empty init + hydrate from bootstrap
- [x] Removed `+layout.server.ts` data loads

### Phase 2 — Page migration ✅

- [x] List routes on `PageQuery` + domain queries
- [x] Deleted `loaders.ts`, `loaders.server.ts`, all `+page.server.ts`
- [x] `detailDataContext` for drawer/educator dashboard data

### Phase 3 — UI-only compute ✅

- [x] Student attendance % + average (`people-data.ts`)
- [x] Evaluation aggregates (`assessments-data.ts`)
- [x] Subject color / category / hours / description (`subjects-data.ts`)
- [x] Seed draft report card model `rcd-ms-draft` (`report-cards-seed.ts`)

### Phase 4 — Final cleanup ✅

- [x] Delete mock arrays from data files
- [x] Delete dead `$lib/server/` directory
- [x] Move interfaces to `$lib/types/*`; `buildClassHierarchy` → `$lib/academic/hierarchy.ts`; load state → `$lib/page/load-state.ts`
- [x] Remove empty `$lib/data/` directory

### Phase 5 — Static SPA cutover ✅

- [x] `@sveltejs/adapter-static` + `ssr = false`
- [x] SPA fallback `200.html`
- [ ] Staging: production CORS + cross-subdomain cookies verified on real deploy | Automated in CI ✅; manual smoke on staging infra ⬜ |
- [ ] Deploy scripts / remove old Cloudflare worker binding if any remain

### Phase 6 — Writes ✅

- [x] `$lib/api/mutations/*` — academic, report-cards, student commands via `client.commands.*`
- [x] Mutations refresh shell bootstrap after success (`runMutation`)
- [x] Academic admin: create year + trimesters, activate year, publish period, create/update class
- [x] Report cards: create grade scale, publish model (`definitions.save`), generate/publish results
- [x] Student transfer: `transferStudent` from change-class dialog
- [ ] Class delete — no API command (UI shows error toast)

---

## 11. Definition of done

| Check | Expected | Current |
|-------|----------|---------|
| Mock arrays in `$lib/data` | none | ✅ |
| `withApiFallback` | 0 | ✅ |
| `loadMock` | 0 | ✅ |
| `sessionStorage` auth keys | 0 | ✅ (year/period UX keys OK) |
| `+page.server.ts` | 0 | ✅ |
| `$lib/data/` | gone | ✅ |
| `$lib/server/` | gone | ✅ |
| `$lib/data/school` value imports | 0 | ✅ |
| Logged-out `/school/*` | redirect login | ✅ |
| Login `m.dupont@school.edu` / `DevPassword1!` | screens non-empty | ✅ |
| `bun run fullcheck` | green | verify after each PR |
| Webapp deploy | static only | ✅ config |
| Staging cross-domain auth | persists refresh | ✅ CI tests (`test-staging-cors-auth`) · manual staging smoke ⬜ |

---

## 12. Risk register

| Risk | Mitigation |
|------|------------|
| Safari cross-domain cookies | Same parent domain; test in Phase 5 staging |
| Login flash before redirect | Loading gate in `(app)/+layout` until `shellReady` ✅ |
| Slow bootstrap (many lists) | Parallel fetch in `bootstrapAppShell()` ✅ |
| Prototype drift | Fixtures only in `@edaya/dev-fixtures` |
| Client-only writes feel real but aren't | Phase 6 — wire commands or disable buttons |
| Stale `$lib/server/` confuses contributors | Resolved — folder deleted ✅ |

---

## 13. Tracker (living)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Transport + auth | ✅ | |
| 1 — Queries + bootstrap | ✅ | |
| 2 — Page migration | ✅ | |
| 3 — UI-only compute | ✅ | |
| 4 — Cleanup | ✅ | |
| 5 — Static deploy | ✅ | manual staging smoke optional |
| 6 — Commands (writes) | ⬜ | |

Update this table at each PR merge.

---

## 14. Related docs

| Doc | Purpose |
|-----|---------|
| [mock-to-pglite-migration-plan](./mock-to-pglite-migration-plan.md) | API seed tracker (complete) |
| [webapp-api-integration-plan](./webapp-api-integration-plan.md) | Original integration architecture |
| [app-shell-spec](../../specs/app-shell-spec.md) | Shell UX contract |
| [rapport-comparaison-ui-api](../../apps/webapp/docs/rapport-comparaison-ui-api.md) | Screen ↔ entity gap (needs refresh post-migration) |

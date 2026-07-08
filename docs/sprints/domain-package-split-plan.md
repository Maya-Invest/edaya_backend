# Domain Package Split — Migration Plan

> **Status:** PR1–PR5 complete  
> **Created:** 2026-07-08  
> **Last updated:** 2026-07-08  
> **Scope:** Split `package/domain-core` into `@edaya/core`, `@edaya/authorization`, and `@edaya/service`  
> **Related:** [integrations-restructure.md](../reference/integrations-restructure.md), [relationship-native-auth-plan.md](./relationship-native-auth-plan.md)

## Target architecture

```text
@edaya/core              domain/, ports/, adapters/, registry/, entity-access/, shared/
@edaya/authorization     auth engine (promoted from capabilities/authorization)
@edaya/service    services/, capabilities/ (notifications, cron, files, invitations, email)

Dependency: school-service → authorization → core
```

## PR plan

| PR | Scope | Status |
|----|-------|--------|
| **PR1** | Scaffold + mechanical move, fix imports, tests moved | ✅ Done |
| **PR2** | Break cycles + core port purity (`SchoolRepositories`, cron ports, `AuthorizationRepositories`, report-card comment auth) | ✅ Largely done |
| **PR3** | Extract 54 entity `*Config` factories from domain (batches 3a–3f) | ✅ Done |
| **PR4** | Test split + consumer import migration | ✅ Done |
| **PR5** | Enforcement + docs (`bun repo verify` boundary checks) | ✅ Done |

---

## PR1 — Completed

### Packages created

- `package/authorization/` — `package.json`, `tsconfig.json`, `src/index.ts`
- `package/domain-service/` — same scaffolding

### Source moved

| From | To |
|------|-----|
| `domain-core/src/capabilities/authorization` | `authorization/src/` |
| `domain-core/src/application` | `school-service/src/services/` |
| `domain-core/src/capabilities/{notifications,files,invitations,scheduling-jobs,email}` | `school-service/src/capabilities/` |

### Core slimmed

`package/domain-core/src/index.ts` exports only: `entity-access`, `registry`, `shared`, `adapters`, `domain`, `ports`.

### Early PR2 work (done during PR1)

- `core-entity-map.ts` — `CoreEntityMap`, `CORE_ENTITY_KEYS`
- `entity-access/types.ts` — `EntityReadAuthorization`, `EntityWriteAuthorization` (generic actor)
- `shared/unique.ts`, `shared/read-storage-body.ts`
- `domain/school/find-active-academic-year.ts`
- `ScopeGrant` → `authorization/src/model/scope-grant.ts`
- `auth-cache-hooks` → `school-service/src/integration/auth-cache-hooks.ts`
- `AuthCacheInvalidationPort` → `authorization/src/ports/`
- `inline-cron-job-dispatcher` → `school-service/src/adapters/`
- Transitional core re-exports removed (caused duplicate exports + circular `ScopeGrant`)

### Import migration tooling

- `tooling/repo/migrate-split-imports.ts` — rewrites imports across the 3 packages
- `tooling/repo/migrate-consumer-imports.ts` — rewrites consumer imports (~224 files)

### Consumer deps partially updated

`apps/api`, `adaptor-postgres`, `tooling/integration-tests`, `tooling/seeding`, `tooling/fixtures` — added `@edaya/authorization` and `@edaya/service`.

### Tests partially moved

- `domain-core/tests/unit/auth/` → `authorization/tests/unit-auth/`
- `domain-core/tests/{services,cron,notifications,queries,application}/` → `school-service/tests/`
- Test imports not fully fixed — many still reference old `../../../src/...` paths

### Verification (PR1 end state)

**Passes (src only; tests excluded from tsconfig `include`):**

```sh
bun --filter @edaya/core check
bun --filter @edaya/authorization check
bun --filter @edaya/service check
bun --filter @edaya/adaptor-postgres check
```

**Does not pass yet:**

- Package unit tests (import path failures after move)
- `apps/api` full typecheck with tests
- `bun run verify` / integration tests — not run to completion

---

## PR2 — Largely complete

### Goals

1. Move `SchoolRepositories` aggregate to `@edaya/service` ✅
2. Keep `CoreEntityRepositories` in `@edaya/core` only ✅
3. Define `AuthorizationRepositories` in `@edaya/authorization` ✅
4. Move cron platform ports to school-service ✅
5. Split report-card comment access — `report-card-comment-rules.ts` (core) + `comment-access.ts` (authorization) ✅
6. Update consumer imports (`SchoolRepositories` → `@edaya/service`) — partial; apps/api tests remain for PR4

### Not in PR2 (completed in PR3)

- ~~54 entity `*Config` factories still in `domain/*.ts`~~ → extracted to school-service
- ~~`@edaya/service` in core deps~~ → removed in PR3

### PR2 checklist

- [x] `school-service/src/ports/school-repositories.ts` — full `SchoolRepositories`
- [x] `core/ports/repositories/school-repositories.ts` — `CoreEntityRepositories` only
- [x] `authorization/src/ports/authorization-repositories.ts` — `AuthorizationRepositories`
- [x] Cron ports moved to `school-service/src/ports/platform/`
- [x] Report-card comment auth split
- [x] Consumer import updates (adaptor-postgres, school-service, authorization)
- [x] `bun --filter @edaya/core check` green (with transitional entity-config deps)
- [x] `bun --filter @edaya/authorization check` green
- [x] `bun --filter @edaya/service check` green
- [ ] Remaining `apps/api` / test import fixes (PR4)
- [ ] Re-enable tests in package `tsconfig.json` `include` arrays (PR4)

---

## PR3 — Entity config extraction (complete)

Extracted all 54 `*Config` factories from `package/domain-core/src/domain/**/*.ts` → `school-service/src/services/entities/config/<area>/<entity>.ts`.

### Tooling

- `tooling/repo/extract-entity-configs.ts` — mechanical extraction
- `tooling/repo/regenerate-config-imports.ts` — import header regeneration
- `tooling/repo/fix-config-supplements.ts` — targeted import fixes

### Outcomes

- `school-service/src/services/entities/config/index.ts` — 54 config exports + gate validators
- `school-service/src/services/runtime/core-entity-catalog.ts` — imports configs from `../entities/config`
- Domain entity files retain types/schemas only; `isActivityAvailableForClassGroup` stays in domain (used by tests)
- `notification-template-document-schema.ts` in core; school-service re-exports where needed
- `@edaya/service` removed from `@edaya/core` `package.json`
- `@edaya/authorization` retained in core for `staff-assignment.ts` and `staff-permission-assignment.ts` schema coupling (`Permission`, `validateScopeIds`)

### Verification

```sh
bun --filter @edaya/core check          # ✅
bun --filter @edaya/authorization check  # ✅
bun --filter @edaya/service check   # ✅
bun --filter @edaya/adaptor-postgres check # ✅
```

Domain purity:

```sh
rg "@edaya/service|EntityConfigFactory" package/domain-core/src/domain  # no matches
```

### PR3 checklist

- [x] Extract 54 entity configs to `school-service/src/services/entities/config/`
- [x] Update `core-entity-catalog` imports
- [x] Remove `@edaya/service` from `@edaya/core` deps
- [x] Export configs/validators from `@edaya/service` barrel
- [x] Fix authorization test import (`staffPermissionAssignmentConfig` → `@edaya/service`)
- [x] Fix `entity-config-edge-gates.test.ts` validator imports
- [ ] Move remaining domain-core tests that import school-service (PR4)
- [x] Remove `@edaya/authorization` from core production deps (`Permission` + scope validation in `domain/permissions/`)

---

## PR3 (original batch plan)

Extract `*Config` from `package/domain-core/src/domain/*.ts` → `school-service/src/services/entities/config/<area>/<entity>.ts` in batches:

| Batch | Area |
|-------|------|
| 3a | school (staff, teachers, assignments) |
| 3b | students, guardians |
| 3c | academics, scheduling |
| 3d | assessments, finances |
| 3e | messaging, school-life |
| 3f | access, attachments |

After PR3: remove `@edaya/service` from `@edaya/core` `package.json`. (`@edaya/authorization` remains for staff permission schema coupling.)

---

## PR4 — Consumer migration (largely complete)

### Done

- Extended `tooling/repo/migrate-consumer-imports.ts` — 102+ consumer files rewritten (`apps/api`, `adaptor-postgres`, `adaptor-novu`, `tooling/*`)
- Added `tooling/repo/fix-test-imports.ts`, `fix-school-service-test-adapters.ts`, `fix-school-service-relative-imports.ts`
- Re-enabled tests in package `tsconfig.json` `include` arrays (core, authorization, school-service)
- Removed duplicate `domain-core/tests/{services,cron,notifications,queries,application,unit/auth,unit/invitations}` (copies live in school-service / authorization)
- Restored shared test support files (`effective-grants`, `create-test-app`, `authorization-fixtures`, `operation-matrix`, etc.)
- Exported gate validators from `school-service/src/services/entities/config/index.ts`
- Added `@edaya/service` dependency to `@edaya/adaptor-novu`

### Verification (PR4)

```sh
bun --filter @edaya/core check              # ✅ src + tests
bun --filter @edaya/authorization check      # ✅ src + tests
bun --filter @edaya/api check                # ✅
bun --filter @edaya/adaptor-postgres check   # ✅
bun --filter @edaya/adaptor-novu check       # ✅
bun run verify                             # ✅ quality + build + unit tests + repo hygiene
```

### PR4 checklist

- [x] Finish `apps/api` imports
- [x] Finish `tooling/*`, `adaptor-postgres`, `adaptor-novu` imports
- [x] Re-enable tests in package `tsconfig.json` `include` arrays
- [x] Fix domain-core test imports (gate validators → `@edaya/service`)
- [x] Remove duplicate domain-core test trees
- [x] Restore shared test harness (`create-test-app`, `effective-grants`, …)
- [x] Finish school-service workflow test imports (`workflow-test-context.ts`, `account-invitation-workflows.test.ts`, …)
- [x] Fix config linter scan path (`src/services/entities/config`)
- [x] Run `bun run verify` end-to-end

---

## PR4 (original scope)

- Finish `apps/api` imports
- Finish `tooling/*`, `adaptor-postgres` remaining imports
- Re-enable tests in package `tsconfig.json` `include` arrays
- Fix test import paths (`../../src/...` within package or `@edaya/*` barrels)
- No transitional `@edaya/core` re-export shim

---

## PR5 — Enforcement (complete)

- Extended `tooling/repo/lib/boundaries.ts` — core/authorization must not import `@edaya/service`; domain packages must not import `apps/` or `@edaya/adaptor-auth`
- ESLint `no-restricted-imports` on `package/domain-core/src` and `package/authorization/src`
- Updated `AGENTS.md` and `docs/reference/integrations-restructure.md`

Turbo `dependsOn: ["^check"]` re-enabled after breaking the test-only workspace cycle (see **Workspace cycle cleanup** below).

### Verification

```sh
bun run verify   # includes import boundary checks
```

### PR5 checklist

- [x] `bun repo verify` boundary grep checks for domain package split
- [x] ESLint `no-restricted-imports` per domain package
- [x] Turbo upstream `check` ordering
- [x] Update `AGENTS.md` and `integrations-restructure.md`

### Workspace cycle cleanup (complete)

Production dependency chain is acyclic: `school-service` → `authorization` → `core`.

To remove test-only workspace cycles that blocked Turbo upstream `check`:

- Moved gate/storage/auth tests that needed `@edaya/service` or `@edaya/authorization` out of `@edaya/core` into `package/domain-service/tests/unit/` and `package/authorization/tests/unit-auth/`
- Moved authorization tests that needed school-service fixtures into `package/domain-service/tests/unit/auth/`
- Removed `@edaya/authorization` and `@edaya/service` from `@edaya/core` `devDependencies`
- Removed `@edaya/service` from `@edaya/authorization` `devDependencies` (authorization `create-test-app` re-exports school-service support via relative path)

### Previously deferred (complete)

- ~~Remove `@edaya/authorization` from `@edaya/core`~~ ✅ `Permission` + scope validation moved to core; production dependency removed
- ~~Break `core` ↔ `authorization` test-only workspace cycle~~ ✅ tests relocated; workspace devDependencies removed

---

## Import cheat sheet

| Symbol | Import from |
|--------|-------------|
| Entity types, `CoreEntityRepositories`, ports (gateways) | `@edaya/core` |
| `*Config` factories, gate validators (`validate*Save`) | `@edaya/service` |
| `Permission`, `ScopeType`, `validateScopeIds`, `scopeGrantSchema` | `@edaya/core` |
| `permissionDefinitions`, `AuthorizationPolicy`, `ActorMetadata`, `ScopeGrant` (type) | `@edaya/authorization` |
| `SchoolRepositories`, `SchoolService`, `ManagedEntityService`, workflows, cron ports | `@edaya/service` |
| `createInlineCronJobDispatcher` | `@edaya/service` |
| `NotificationGatewayPort`, `FileStoragePort` | `@edaya/core` |

---

## Key files

| Path | Role |
|------|------|
| `package/domain-core/src/index.ts` | Slim core barrel |
| `package/authorization/src/index.ts` | Auth barrel |
| `package/domain-service/src/index.ts` | Service + capabilities barrel |
| `package/domain-service/src/services/entities/config/` | 54 extracted entity configs (PR3) |
| `package/domain-service/src/services/runtime/core-entity-catalog.ts` | Entity service registry |
| `package/domain-service/src/integration/auth-cache-hooks.ts` | Auth cache lifecycle hooks |
| `package/domain-service/src/ports/school-repositories.ts` | Full repo aggregate (PR2) |
| `package/domain-core/src/ports/repositories/school-repositories.ts` | `CoreEntityRepositories` only (PR2) |

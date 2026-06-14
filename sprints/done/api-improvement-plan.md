# API Improvement Plan

This document outlines improvements to `apps/api` so the HTTP layer fully leverages the Zod entity schema model and two-layer authorization system in `@edaya/core`.

**Related docs:** [Zod entity migration plan](./zod-entity-migration-plan.md), [Value object candidates](../../docs/value-object-candidates.md), [Authorization README](../../packages/core/src/authorization/README.md).

---

## 1. Current state

`apps/api` is a thin Hono gateway over `@edaya/core`:

```
HTTP → Better Auth session → ActorMetadata + EffectiveGrants
     → SchoolApplication.forActor(actor)
     → ManagedEntityService / SchoolService workflows
     → authorize() + AuthorizationPolicy (in core)
```

**What works well today:**

- Entity **response** OpenAPI schemas derive from core Zod schemas via `unwrapShape()`.
- ~70 **commands** use typed request schemas from `commands.schemas.ts` (parity-tested against core `*CreateSchema`).
- Authorization enforcement is delegated to core (`ManagedEntityService`, workflows); API returns 401 when unauthenticated, 403 on `AuthorizationError`.
- Grants are resolved once per session and cached in memory, with invalidation on staff/role changes.

**Gaps:** loose entity save contracts, incomplete grant context, stale portal grants, domain errors mapped to 500, and some schema duplication at the API boundary.

---

## 2. Objectives

1. **Typed API boundary** — every entity save and command has an OpenAPI schema derived from core (no `z.record(z.unknown())` or `z.any()` where avoidable).
2. **Correct grant context** — year-scoped role assignments resolve against the active academic year.
3. **Fresh portal grants** — guardian/student effective grants invalidate when enrollments or links change.
4. **Proper HTTP semantics** — validation and business rule failures return 400/409 with structured `{ message, code }`, not 500.
5. **Schema single source of truth** — reuse core value object schemas (`timeOfDaySchema`, `guardianContactMethodSchema`, etc.) instead of local duplicates.

---

## 3. Improvement phases

### Phase 1 — High impact (correctness + client contract)

| # | Item | Problem | Solution | Status |
|---|------|---------|----------|--------|
| Phase 1.1 | Domain error HTTP mapping | `BusinessRuleViolationError` and post-save validation errors return 500 | Export errors from `@edaya/core`; map in `routeErrorResponse` to 400/409 | Done |
| 1.2 | Per-entity save schemas | Save routes use `z.record(z.unknown())`; OpenAPI shows no entity shape | Register per-entity `saveSchema` from core entity schemas (same source as response schemas) | Done |
| 1.3 | Academic year grant context | `resolveEffectiveGrants({ academicYearId })` supported in core but never passed from API | Read `X-Academic-Year-Id` header; include in cache key and `resolveActorGrants` | Done |
| 1.4 | Portal grants cache invalidation | Guardian/student grants stale after enrollment/link changes | Invalidate portal actor caches on `enrollments`, `guardianLinks`, `students`, `guardians` writes | Done |

### Phase 2 — Medium impact (OpenAPI quality + consistency)

| # | Item | Problem | Solution | Status |
|---|------|---------|----------|--------|
| 2.1 | Command response typing | All commands use `z.any()` response | Wire `command-response.schemas.ts` per command (start with list-returning commands) | Done |
| 2.2 | Command schema cleanup | `list-class-subject-assessment-results-for-period` uses inline Zod | Move to `commands.schemas.ts` | Done |
| 2.3 | Value object schema reuse | `schema-fields.timeOfDay` duplicates core regex; guardian contact methods hand-built | Import `timeOfDaySchema`, `guardianContactMethodSchema` from `@edaya/core` | Done |
| 2.4 | Entity save vs command guidance | Generic save bypasses workflow-only invariants | `allowDirectSave: false` on command-only entities; save/batch-save return 405 | Done |

### Phase 3 — Lower priority (architecture + ops)

| # | Item | Problem | Solution | Status |
|---|------|---------|----------|--------|
| 3.1 | Multi-replica grants cache | In-process `Map` only | Pluggable `EffectiveGrantsCacheStore` + generation stamp; optional `GRANTS_CACHE_TTL_MS` | Done |
| 3.2 | System actor routes | No API path for background/system operations | `POST /api/core/system/commands/{commandName}` with `X-System-Actor-Secret` | Done |
| 3.3 | Capability introspection | Clients cannot discover actor permissions | `GET /api/core/authorization/effective-grants` exposing sanitized `EffectiveGrants` | Done |
| 3.4 | Type-safe command dispatch | `(service as Record<string, unknown>)[methodName]` | `dispatchCoreCommand()` with `CoreCommandMethodName` from registry | Done |
| 3.5 | Dead code removal | `route.schemas.ts`, unused `lib/utils.ts` | Delete or wire up | Done |

---

## 4. Phase 1 implementation details

### 4.1 Domain error HTTP mapping

**Core exports:**

```typescript
// packages/core/src/index.ts
export { BusinessRuleViolationError } from './shared/business-rule-error'
// DomainValidationError already exported via domains
```

**API mapping** (`apps/api/src/lib/http-responses.ts`):

| Error | HTTP | Body |
|-------|------|------|
| `AuthorizationError` | 403 | `{ message, code? }` |
| `DomainValidationError` | 400 | `{ message }` |
| `BusinessRuleViolationError` | 409 | `{ message, code }` |
| Other | 500 | `{ message: "Internal server error occurred" }` |

Constructor-time validation already returns 400 in entity save handlers; this covers `preSave` / `preDelete` gates and workflow throws.

### 4.2 Per-entity save schemas

Each entity in `core-registries.ts` gains a `saveSchema` derived from the same core Zod schema as its response schema:

```typescript
interface CoreEntityConfig {
  // ...
  saveSchema: AnySchema  // OpenAPI-validated request body for POST .../save
}
```

`core.route.ts` uses `entityConfig.saveSchema` instead of `z.record(z.unknown())`. Batch save uses `z.object({ entities: z.array(entityConfig.saveSchema) })`.

Validation runs at the OpenAPI layer **before** entity construction, giving clients early **422** responses with schema details. Domain-level validation after construction still returns **400**.

### 4.3 Academic year grant context

Staff role assignments can be scoped to an academic year. Grant resolution must filter assignments accordingly.

**Header:** `X-Academic-Year-Id: <uuid>`

**Flow:**

1. `sessionActorDependency` reads header when resolving grants.
2. `resolveCachedEffectiveGrants` passes `academicYearId` to `repositories.authorization.resolveActorGrants`.
3. Cache key includes academic year segment so different years do not share cached grants.

When header is absent, behavior is unchanged (all year-scoped and school-wide assignments apply).

### 4.4 Portal grants cache invalidation

Extend `withAuthorizationCacheInvalidation` in `service-accessors.ts`:

| Entity service | Invalidate |
|----------------|------------|
| `guardianLinks` | `guardianId` (guardian), `studentId` (student) |
| `enrollments` | `studentId` (student) |
| `students` | entity `id` (student) |
| `guardians` | entity `id` (guardian) |

Uses existing `invalidateEffectiveGrantsCacheForActor(id, actorType, schoolId?)`.

---

## 5. Phase 2 implementation details

### 5.1 Command response schemas

Replace global `commandResponseSchema = z.any()` with per-command schemas. Priority order:

1. Commands returning entity arrays (`listClassSubjectAssessmentResultsForPeriod`, session lists, etc.)
2. Commands returning single entities (`createAcademicYear`, `registerStudent`, …)
3. Message-only commands (`{ message: string }`)

### 5.2 Entity save vs command boundaries

Entities with `allowDirectSave: false` reject `POST .../save` and `POST .../batch-save` with **405**. Read and delete routes remain available.

| `allowDirectSave: false` | Use commands instead |
|--------------------------|----------------------|
| `students` | `register-student`, `update-student-profile`, `update-student-status` |
| `enrollments` | `enroll-student`, `promote-student`, `transfer-student`, `graduate-student`, `close-enrollment`, `record-progression-decision` |
| `studentFees` | `assign-fee-to-student`, `adjust-student-fee`, `cancel-student-fee` |
| `payments` | `record-payment`, `reverse-payment`, `cancel-payment` |
| `assessmentResults` | `record-assessment-result`, `record-assessment-result-compliance` |
| `results` | `generate-report-card-result`, `publish-report-card-result` |

Generic save remains enabled for school configuration entities (`gradeLevels`, `subjects`, `accessRoles`, etc.).

### 5.3 Schema deduplication checklist

- [x] `field.timeOfDay` → `timeOfDaySchema` from `@edaya/core`
- [x] `guardianResponseSchema.contactMethods` → `guardianContactMethodSchema`
- [ ] Audit other `schema-fields.ts` helpers against `value_object/` exports

---

## 6. Testing strategy

| Area | Test location | Coverage |
|------|---------------|----------|
| Error mapping | `apps/api/tests/lib/test-http-responses.test.ts` | 400/403/409/500 for each error type |
| Save schema validation | Extend `test-commands-save-and-delete-behavior.test.ts` | 422 on malformed save before entity ctor |
| Academic year grants | Extend `test-session-middleware-resolves-actors.test.ts` | Header forwarded to `resolveActorGrants` |
| Portal cache invalidation | `apps/api/tests/lib/test-service-accessors.test.ts` | Invalidation on enrollment/link save |
| OpenAPI contract | Existing `test-openapi-doc.test.ts`, `test-query-registry-contract.test.ts` | No regressions in route count |

---

## 7. Rollout order

1. **Phase 1.1** — Error mapping (no breaking changes; fixes misleading 500s)
2. **Phase 1.2** — Save schemas (may surface 422 where 400/500 occurred before; improves clients)
3. **Phase 1.3** — Academic year header (opt-in; no change without header)
4. **Phase 1.4** — Portal cache invalidation (correctness fix)
5. **Phase 2** — OpenAPI polish and schema deduplication
6. **Phase 3** — As operational needs arise

---

## 9. Phase 3 implementation details

### 9.1 Pluggable grants cache

`EffectiveGrantsCacheStore` (`lib/effective-grants-cache-store.ts`) abstracts cache storage. Default: `InMemoryEffectiveGrantsCacheStore` with a **generation stamp** bumped on global clear — stale entries are rejected after `clearEffectiveGrantsCache()`.

Optional env: `GRANTS_CACHE_TTL_MS` (parsed via `env-runtime`).

For multi-replica deployments, implement `EffectiveGrantsCacheStore` backed by Redis and call `setEffectiveGrantsCacheStore()` at bootstrap.

### 9.2 System actor routes

`POST /api/core/system/commands/{commandName}`

- Requires `SYSTEM_ACTOR_SECRET` in env (route returns **503** when unset)
- Header: `X-System-Actor-Secret`
- Body: `{ schoolId, systemId, reason, payload }`
- Creates `createSystemActorMetadata()` and dispatches via `dispatchCoreCommand()`

### 9.3 Capability introspection

`GET /api/core/authorization/effective-grants`

Returns sanitized grants for the current interactive actor:

```json
{
  "kind": "staff",
  "actorId": "...",
  "schoolId": "...",
  "assuranceLevel": "standard",
  "effectiveGrants": {
    "permissions": ["STUDENT_READ"],
    "scopeGrants": [{ "permission": "...", "scopeType": "...", "scopeEntityIds": ["..."] }],
    "isElevated": false,
    "expiresAt": "..."
  }
}
```

### 9.4 Type-safe command dispatch

`dispatchCoreCommand(service, methodName, payload)` in `lib/core-command-dispatch.ts` uses `CoreCommandMethodName` derived from the command registry. Both session commands and system actor routes use this helper.

---

## 8. Success criteria

- [x] `bun fullcheck` passes (lint, typecheck, tests)
- [x] OpenAPI documents per-entity save request bodies for all 42 entities
- [x] Business rule violations from entity save/delete return 409 with `code`
- [x] `X-Academic-Year-Id` affects staff grant resolution and cache isolation
- [x] Portal actor grants invalidate within the same request after enrollment/link mutations
- [x] No duplicate time/contact validation rules between API and core (timeOfDay + guardian contact methods)
- [x] Phase 3 architecture items implemented (cache store, introspection, system routes, typed dispatch)

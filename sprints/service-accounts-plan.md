# Service accounts and unified API authorization

Replace god-mode **system actor** routes (`/core/system/*` + `X-System-Actor-Secret`) with **permissioned service accounts** that use the same `/core/commands/*` and `/core/entities/*` surface as human staff.

**Related docs:** [Authorization README](../packages/core/src/authorization/README.md), [API folder structure](../docs/api-folder-structure.md), [integrations restructure](../docs/integrations-restructure.md).

---

## 1. Goals and non-goals

### Goals

| # | Outcome |
|---|---------|
| G1 | Service accounts are first-class **staff-shaped** actors with `effectiveGrants` |
| G2 | Machine callers authenticate via **API key** and hit **normal** core routes |
| G3 | Creating a service account requires permission; granted permissions ⊆ creator |
| G4 | Owner can provision an **owner-level** service account (for seeding / integrations) |
| G5 | Seeding creates owner service account after school bootstrap, then uses API key |
| G6 | `ActorAssuranceLevel.Service` enables service-only and human-only workflow gates |
| G7 | `/core/system/*` deprecated; bootstrap allowlist shrinks to school registration only |

### Non-goals (this iteration)

- OAuth2 / OpenID Connect (designed for, not implemented)
- Cross-school workflows except **billing** (platform scope defined separately)
- Webapp admin UI for service account management (API + seed first)
- Removing `SYSTEM_ACTOR_SECRET` entirely until migration completes

### Locked product decisions

| Topic | Decision |
|-------|----------|
| **Credentials** | API key now; OAuth/OIDC later |
| **Assurance** | `ActorAssuranceLevel.Service` — orthogonal to human `Standard` / `Verified` / `Strong` |
| **Tenancy** | School-scoped actors only; no cross-school data except billing integrations |
| **Delegation** | `SERVICE_ACCOUNT_*` permissions; assignee grants ⊆ creator grants |
| **Owner bots** | School owner may create owner-level (`isElevated`) service account |
| **Seeding** | After school exists → create owner service account → seed via `/core/*` |

---

## 2. Current state

```
Machine caller
  └─ X-System-Actor-Secret
       └─ POST /core/system/commands/{name}
       └─ POST /core/system/entities/{entity}/list|one|save
            └─ createSystemActorMetadata()
                 └─ authorize() SKIPPED (god-mode)
                 └─ policy resolvers often SKIPPED

Human caller
  └─ Better Auth session cookie
       └─ POST /core/commands/* · /core/entities/*
            └─ StaffActorMetadata + effectiveGrants
                 └─ full authorize() + policy
```

**Pain:** duplicated OpenAPI surface, duplicated handlers (`system-entity-handlers.ts` vs `entity-handlers.ts`), no least-privilege for integrations.

**Consumers today:** `@edaya/seeding` (`testing/seeding/src/http/system-entity.ts`, `system-command.ts`), integration tests, dev HTTP seed.

---

## 3. Target architecture

```mermaid
flowchart TB
  subgraph auth [Authentication]
    Cookie["Session cookie"]
    APIKey["Authorization: Bearer sk_…"]
  end

  subgraph middleware [session-actor middleware]
    Resolve["Resolve subjectId"]
    Grants["resolveCachedEffectiveGrants"]
    Actor["StaffActorMetadata<br/>accountKind: human | service"]
  end

  subgraph routes [Single route surface]
    Core["/core/commands/* · /core/entities/*"]
  end

  subgraph core [Authorization]
    AuthZ["authorize() — no system bypass"]
    Policy["AuthorizationPolicy resolvers"]
  end

  Cookie --> Resolve
  APIKey --> Resolve
  Resolve --> Grants --> Actor --> Core
  Core --> AuthZ --> Policy
```

**Bootstrap only** (no service account yet):

```
POST /core/onboarding/register-school   (session or public registration)
  OR minimal /core/system/* allowlist   (until onboarding provisions first service account)
```

---

## 4. Domain model

### 4.1 StaffMember extensions

| Field | Type | Purpose |
|-------|------|---------|
| `accountKind` | `'human' \| 'service'` | Distinguish people from integrations |
| `serviceId` | `string?` | Stable integration id (`seeding`, `billing-sync`, …) |
| `createdBySubjectId` | `string?` | Audit: who provisioned this account |

Humans: `accountKind = 'human'` (default). Service accounts: `accountKind = 'service'`, no login UX.

### 4.2 Service API keys (new persistence)

Separate from Better Auth password — machine credentials only.

| Field | Purpose |
|-------|---------|
| `id` | Primary key |
| `staffMemberId` | Linked service staff |
| `schoolId` | Tenant boundary |
| `keyPrefix` | Display / lookup (`sk_live_abc…`) |
| `keyHash` | Stored hash (never persist plaintext) |
| `createdBySubjectId` | Delegation audit |
| `expiresAt` | Optional rotation policy |
| `revokedAt` | Soft revoke |
| `lastUsedAt` | Observability |

**Schema location:** `@edaya/adaptor-postgres` (+ Drizzle migration). Auth adapter stays in `betterauth-d1-migrations` for human users only.

### 4.3 New permissions

Add to `Permission` enum under **Staff and access**:

| Permission | Purpose |
|------------|---------|
| `SERVICE_ACCOUNT_READ` | List service accounts for the school |
| `SERVICE_ACCOUNT_CREATE` | Create service staff + initial API key |
| `SERVICE_ACCOUNT_UPDATE` | Update metadata / role assignment |
| `SERVICE_ACCOUNT_REVOKE` | Revoke keys / deactivate service staff |
| `SERVICE_ACCOUNT_ROTATE_KEY` | Issue new key, invalidate old |

`permissionDefinitions`: school-scoped; `SERVICE_ACCOUNT_CREATE` requires `ActorAssuranceLevel.Verified` for **human** creators (service accounts use `Service` — see §5).

### 4.4 Owner service account

When creator is school owner (`isElevated`) and explicitly requests `elevated: true`:

- Service staff linked with role assignment that resolves to `isElevated: true` (same as owner), **or**
- Dedicated “owner integration” access role seeded per school

**Guardrails:**

- Max **one** active owner-level service account per school (configurable override for platform ops)
- Mandatory `serviceId` (e.g. `school-owner-integration`)
- All actions audited with `systemId` = `serviceId`

---

## 5. `ActorAssuranceLevel.Service`

Extend enum in `packages/core/src/authorization/model/actor.ts`:

```ts
export enum ActorAssuranceLevel {
  Standard = 'standard',
  Verified = 'verified',
  Strong = 'strong',
  Service = 'service',  // machine actors only
}
```

**Do not** add `Service` to `ASSURANCE_RANK` ladder used for human step-up.

Instead, extend `assertPermissionAssurance` (or parallel `assertAccountKind`):

| Rule | Behavior |
|------|----------|
| Service account actor | Always `assuranceLevel: Service` |
| Human-only permission | Reject if `accountKind === 'service'` |
| Service-only command | Reject if `accountKind === 'human'` (registry flag `serviceOnly: true`) |
| Shared permissions | Normal grant + scope checks; assurance gate uses explicit map |

Example `PERMISSION_ASSURANCE` additions:

```ts
[Permission.SERVICE_ACCOUNT_CREATE]: ActorAssuranceLevel.Verified, // human creator only
// Service accounts skip human assurance ranks via accountKind check
```

Registry flag on commands (optional phase):

```ts
{ methodName: 'bulkImportStudents', serviceOnly: true }
```

---

## 6. Delegation rules (permissions ⊆ creator)

### 6.1 Who may create

Caller must hold `SERVICE_ACCOUNT_CREATE` and pass `authorize()` for the target school.

### 6.2 Permission subset

Requested role permissions ⊆ creator's `effectiveGrants.permissions`.

If creator is not `isElevated`, cannot assign permissions the creator does not hold.

### 6.3 Scope subset

Each requested `ScopeGrant` must be covered by creator's grants:

- Same or narrower `scopeType`
- `scopeEntityIds` ⊆ creator's ids for that permission+scope (or creator has school-wide / elevated)

### 6.4 Owner service account

Only if creator has `isElevated: true` **and** passes explicit `elevated: true` on create request.

### 6.5 Billing exception (future)

Platform billing integrations use a **platform-scoped** service account (separate from school staff), with only `PLATFORM_BILLING_*` permissions (to be defined). Out of scope for phase 1–3 except documenting the boundary.

---

## 7. API layer

### 7.1 API key authentication

**Header:** `Authorization: Bearer <api-key>` (or `X-Api-Key` — pick one, document in OpenAPI).

**Middleware** (extend `session-actor.ts` or sibling `service-actor.ts`):

1. If session cookie present → existing human flow
2. Else if API key → hash lookup → `staffMemberId` → must be `accountKind === 'service'`
3. Resolve grants via `resolveCachedEffectiveGrants` (same as staff)
4. `createStaffActorMetadata({ …, assuranceLevel: Service, accountKind: 'service' })`
5. Set `c.set('actor', …)` — same variable as today

**Precedence:** session wins if both present (or reject ambiguous dual auth — recommend reject).

### 7.2 New routes (hand-written)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/core/service-accounts` | Create service staff + role + API key (returns key once) |
| `GET` | `/core/service-accounts` | List (no secrets) |
| `POST` | `/core/service-accounts/{id}/rotate-key` | Rotate API key |
| `POST` | `/core/service-accounts/{id}/revoke` | Revoke |

Implement orchestration in `lib/service-accounts/` (mirror `lib/onboarding/`).

### 7.3 Deprecate system routes

| Route | Phase |
|-------|-------|
| `POST /core/system/entities/*` | Deprecate after seeding migrates |
| `POST /core/system/commands/*` | Deprecate after seeding migrates |
| `SYSTEM_ACTOR_SECRET` | Keep for bootstrap allowlist only, then remove |

Mark OpenAPI `deprecated: true` before deletion.

---

## 8. Seeding migration

### 8.1 New step in `seed:init` / `seed:all`

After school + human owner exist:

1. Authenticate as human owner (existing dev auth flow) **or** one-time system bootstrap
2. `POST /core/service-accounts` with `elevated: true`, `serviceId: 'seeding'`, owner-level role
3. Store returned API key in `.env` as `SERVICE_ACCOUNT_API_KEY` (school-scoped)
4. Subsequent seed scopes use Bearer token → `/core/commands/*`, `/core/entities/*`

### 8.2 Replace `testing/seeding/src/http/system-entity.ts`

| Before | After |
|--------|-------|
| `postSystemEntityList` → `/core/system/entities/.../list` | `postEntityList` → `/core/entities/.../list` |
| `X-System-Actor-Secret` | `Authorization: Bearer …` |
| `schoolId, systemId, reason` in every body | Actor carries `schoolId`; optional `X-Request-Id` |

### 8.3 Env vars

| Variable | Purpose |
|----------|---------|
| `SERVICE_ACCOUNT_API_KEY` | Seeding / local dev machine auth |
| `SYSTEM_ACTOR_SECRET` | Deprecated; bootstrap only until removed |

---

## 9. Core authorization changes

### 9.1 Remove system bypass

In `engine/authorize.ts`:

```ts
// REMOVE:
if (actor.kind === 'system') {
  return
}
```

System actors either:

- **Removed** for data paths, or
- **Given explicit grants** for bootstrap-only commands (narrow allowlist)

### 9.2 Policy resolvers

Remove blanket `actor.kind === 'system'` early returns in:

- `policy/resolvers/student.ts`
- `policy/resolvers/academic.ts`
- `policy/resolvers/scheduling.ts`
- `policy/resolvers/finance.ts`

Service accounts with correct grants pass the same checks as staff.

### 9.3 `SystemActorMetadata`

**Phase 4:** delete or restrict to platform bootstrap service outside school tenancy.

---

## 10. Implementation phases

### Phase 1 — Domain and permissions

- [ ] `StaffMember.accountKind`, `serviceId`, `createdBySubjectId`
- [ ] `service_api_keys` table + repository
- [ ] `SERVICE_ACCOUNT_*` permissions + definitions
- [ ] `ActorAssuranceLevel.Service`
- [ ] `createServiceStaffActorMetadata` or extend `StaffActorMetadata` with `accountKind`
- [ ] Unit tests: delegation subset, owner service account rules

### Phase 2 — API key middleware + service account routes

- [ ] API key hash verify + actor resolution in middleware
- [ ] `POST/GET /core/service-accounts` + rotate/revoke
- [ ] `lib/service-accounts/create-service-account.ts` with delegation checks
- [ ] Integration test: API key → `POST /core/entities/schools/list` (authorized)

### Phase 3 — Seeding migration

- [ ] `seed:init` creates owner service account; writes key to env example
- [ ] Refactor `@edaya/seeding` HTTP client off `/core/system/*`
- [ ] Update `testing/integration-tests` harnesses
- [ ] Document `SERVICE_ACCOUNT_API_KEY` in `docs/local-dev.md`

### Phase 4 — Remove god-mode

- [ ] Remove `system` bypass in `authorize()` and policy resolvers
- [ ] Deprecate then delete `buildSystemEntityRoutes()`, `system.routes.ts` (except bootstrap)
- [ ] Remove `SYSTEM_ACTOR_SECRET` from seeding default path
- [ ] OpenAPI cleanup

### Phase 5 — OAuth/OIDC (later)

- [ ] Client credentials grant → same actor pipeline as API key
- [ ] Third-party integration onboarding

---

## 11. Testing strategy

| Layer | Tests |
|-------|-------|
| Core | Delegation subset, assurance/accountKind gates, owner service account |
| API | API key middleware, service account CRUD, 401/403 without grants |
| Integration | Seed with service key through `/core/*`; no system secret |
| Regression | Human session flows unchanged |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| API key leak = full owner access | Rotation, short-lived keys in CI, separate non-owner service accounts for narrow integrations |
| Chicken-and-egg before first service account | Keep minimal bootstrap (`register-school` + one system command) until phase 3 lands |
| Breaking existing seed scripts | Parallel support: accept system secret **or** API key during transition |
| `Service` assurance confusion | Document orthogonal model; never rank Service with Strong/Verified |

---

## 13. Success criteria

- [ ] `@edaya/seeding` runs full `seed:all` with **only** `SERVICE_ACCOUNT_API_KEY`
- [ ] No integration test requires `POST /core/system/entities/*`
- [ ] Unauthorized API key receives 401; under-privileged service account receives 403 on protected command
- [ ] Creating service account with permission not held by creator fails with 403
- [ ] Owner service account can run seed workflows; teacher-scoped service account cannot

---

## 14. File touch map (anticipated)

```
packages/core/
  authorization/model/actor.ts
  authorization/engine/authorize.ts
  authorization/permissions/permission.ts
  authorization/permissions/permission-assurance.ts
  domains/school/staff-member.ts
  services/… (createServiceAccount workflow)

packages/adaptor-postgres/
  schema (service_api_keys)
  repositories/

apps/api/
  http/dependencies/session-actor.ts (or service-api-key.ts)
  lib/service-accounts/
  routes/service-accounts.routes.ts
  DELETE routes/system-entity.routes.ts (phase 4)
  DELETE lib/system-api/ (phase 4)

testing/seeding/
  src/http/ (migrate off system-entity.ts)
  seed:init step for owner service account
```

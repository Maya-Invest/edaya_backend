# Repo Inspection Report

> **Historical (2026-06).** Package paths in this report (`package/generated-api-client`, `apps/webapp`, `package/integration-*`) predate the current layout. Canonical map: [integrations-restructure.md](./integrations-restructure.md).

Date: 2026-06-16  
Scope: over-engineering, boundary definition/enforcement, and developer experience for the `edaya_backend` monorepo.

> **Note:** Webapp paths cited below (`apps/webapp/…`) refer to the sibling **edaya_web** repo after the frontend split.

**Closure audit:** 2026-06-22 — see [Simplification initiative closure](#simplification-initiative-closure-2026-06-22) below. Tracked work: `docs/sprints/backlog/repository-simplification-plan.md`.

## Simplification initiative closure (2026-06-22)

Phases 0–3, 5–6, and 8 of the repository simplification plan are **complete**. Phase **4** (persistence split by bounded context) and Phase **7** (ESLint boundary enforcement) are **deferred** with documented rationale. `bun repo verify` is green and idempotent.

| Finding | Status | Resolution |
|---------|--------|------------|
| 1 — Entity metadata repeated across layers | **Resolved** | `CoreEntityMap`, `CORE_ENTITY_KEYS`, keyed API decorations, parity tests (Phase 3) |
| 2 — `SchoolService` pass-through facade | **Resolved** | Workflow namespaces + typed `commands` map; mechanical delegates removed (Phase 3) |
| 3 — `SchoolRepositories` wide dependency bag | **Partial** | `WORKFLOW_REPOSITORY_KEYS` + narrowed deps for access-control; full split deferred with Phase 4 |
| 4 — Managed `count()` lists all rows | **Partial** | Shell sidebar uses authorized `count` queries (Phase 5); generic `ManagedEntityService.count` unchanged |
| 5 — Boundary enforcement too narrow | **Deferred** | Shell `check:boundaries` remains; ESLint rules planned in Phase 7 |
| 6 — API client exposes rejected saves | **Resolved** | `DirectSaveEntityResource` / compile-time guards + contract tests (Phase 1) |
| 7 — API/command schema drift surfaces | **Resolved** | Registry parity tests across core, API, client, adapter (Phase 3) |
| 8 — Webapp refresh boundary too broad | **Partial** | Route-scoped loading + targeted report-card refresh (Phase 5–6); domain `invalidate[]` still a future improvement |
| 9 — Unpaginated `list({})` fan-out | **Resolved** | Zero raw `.list({})`; intentional catalogs use `schoolWideEntityList(reason)` (Phase 5) |
| 10 — Verification scripts mutate by default | **Resolved** | `verify` / `fix` split, non-mutating `generated:check`, CI workflow (Phase 0) |
| 11 — Documentation drift (SPA vs SSR) | **Resolved** | README, `docs/reference/local-dev.md`, API client README aligned (Phase 0–1) |
| 12 — Environment file hygiene | **Resolved** | `doctor` script, `.env.staging` untracked, duplicate example removed (Phase 0) |

### Post-initiative metrics (2026-06-22)

| Metric | Baseline (audit) | Current |
|--------|------------------|---------|
| `bun repo verify` | Failing / mutating | Passes twice idempotently; used in CI |
| Package tests | 688 passed | **826 passed**, 7 integration skips |
| Webapp tests | Not typechecked | **141** runtime tests, typechecked via `tsconfig.test.json` |
| Raw `.list({})` in webapp | 65 / 65 loaders | **0** (37 documented `schoolWideEntityList` call sites) |
| `StudentTabs.svelte` | 670 lines | **112** lines + 5 tab components |
| `list-url-filters.ts` | 497 lines | **228** lines + shared codec |
| Entity registration | 5+ manual layers | Core catalog + API decoration + parity tests |
| `entity-stores.ts` | 1,006 lines | 1,006 lines (**Phase 4 deferred**) |
| `postgres-schema.ts` | 697 lines | 698 lines (**Phase 4 deferred**) |
| Tracked OpenAPI (`schema.d.ts` + `openapi.json`) | ~129k lines | ~129k lines (retained; 26 schema consumers verified) |
| Production `any` / `as any` | Not measured | api: 72, adaptor-postgres: 52, core: 32, webapp: 0, api-client: 0 |
| Deprecated internal wrappers | Several | **0** in production source (Phase 2–3 cleanup; `prototype.queries.ts` → `homework.queries.ts`, 2026-06-23) |

### Deferred follow-ups

- **Phase 4:** Split `postgres-schema.ts` and `entity-stores.ts` by bounded context without migration drift.
- **Phase 7:** ESLint `no-restricted-imports`, runtime public entry points. (`prototype.queries.ts` rename completed 2026-06-23.)
- **Product:** Domain-scoped mutation invalidation buckets (Finding 8), pagination for school-wide admin lists (Finding 9).
- **Operator:** Staging smoke (`bun repo smoke-test staging`), manual screen QA checklist (Phase 8.2).

---

The repo has a coherent architecture. The intended ports-and-adapters split is documented in `README.md`: `@edaya/core` owns business rules, `@edaya/adaptor-postgres` owns portable persistence, `package/integration-*` owns platform deployment/migration orchestration, and `apps/api` wires runtime and HTTP.

The main issue is not architectural confusion. The main issue is that the same concepts are manually repeated across multiple layers: core services, repositories, API registry, schemas, adapter stores, and generated client bindings. This creates drift risk and makes new entity or command work feel larger than it should.

The highest-return implementation path is:

1. Introduce a typed entity metadata registry as a source of truth.
2. Strengthen import boundary enforcement beyond the current shell script.
3. Move API client command-only entity restrictions from runtime failures to type-level feedback.
4. Make verification scripts non-mutating by default.
5. Narrow webapp data invalidation from full app reloads to domain-scoped refreshes.

## Verification notes

- `bun repo check boundaries` passed during inspection.
- Full generated checks were not run because the worktree already had local and generated changes.
- Existing dirty files were not modified by this inspection.

Relevant pre-existing dirty files included API schema/runtime tests, webapp generated OpenAPI artifacts, webapp env/login files, and seed scripts.

## Current strengths

- The monorepo shape is understandable: `apps/api`, `apps/webapp`, `package/domain-core`, `package/adaptor-postgres`, `package/generated-api-client`, `package/integration-*`, and `tooling/*`.
- The high-level boundary rule is documented in `README.md`.
- API runtime documentation exists in `apps/api/src/runtime/README.md`.
- The webapp has a concrete app shell/design spec and broad `DataState` usage in route pages.
- The API client is intentionally small: generated bindings plus a stable handwritten runtime.
- Local development documentation is more accurate than the root README for current SPA behavior.

## Finding 1: Entity metadata is repeated across too many layers

### Evidence

- `package/domain-core/src/services/base-school-service.ts` imports every domain type and config, declares one `ManagedEntityService` property per entity, then manually instantiates each service.
- `package/domain-core/src/ports/school-repositories.ts` declares one wide `SchoolRepositories` interface with every repository.
- `apps/api/src/lib/school-api/registry.ts` repeats entity names, public route names, display names, schemas, constructors, and `allowDirectSave`.
- `package/adaptor-postgres/src/postgres-school-repositories.ts` and `package/adaptor-postgres/src/stores/entity-stores.ts` mirror the same entity set in persistence wiring.
- `package/generated-api-client/src/generated/client-bindings.ts` derives from the API registry, but only after the API has repeated core concepts.

### Impact

- Adding a new entity requires changes in many places.
- Omissions are easy because the compiler cannot see the full intended cross-layer registry.
- Tests can only catch drift after the fact.
- The codebase feels larger than the domain model actually requires.

### Recommendation

Create a typed `coreEntityRegistry` or equivalent metadata map with one entry per entity. Each entry should include the stable service key, public API name, display name, domain constructor, core config factory, repository key, response/query schema references, and direct-save policy.

Use this registry to derive:

- `BaseSchoolService` managed entity fields or construction.
- API `coreEntities`.
- API client direct-save typing.
- Schema parity tests.
- Potentially adapter repository maps, where practical.

Keep special cases explicit through per-entity overrides rather than parallel hand-maintained lists.

### Implementation order

1. Start with a registry that only feeds API `coreEntities`, preserving behavior.
2. Add parity tests proving registry keys match `BaseSchoolService` and `SchoolRepositories`.
3. Move `BaseSchoolService` construction to registry-driven construction.
4. Only then consider adapter-side consolidation.

## Finding 2: `SchoolService` is mostly pass-through facade code

### Evidence

- `package/domain-core/src/services/domain-service.ts` constructs workflow objects, then exposes many methods that directly delegate to workflow methods.
- The facade does add value for reports/queries and for a stable public command surface, but much of it is mechanical.

### Impact

- Every workflow command is represented in at least three places: workflow implementation, `SchoolService` method, and API command registry.
- Command renames or additions create avoidable drift risk.

### Recommendation

Keep `SchoolService` if it is the public domain API, but make command registration derive from metadata instead of requiring another manual list. A command registry could include method name, public API name, schema, service-only flag, and response schema.

If `SchoolService` is not needed as a public facade, expose workflow namespaces and let the API command dispatcher call registered workflow handlers directly.

## Finding 3: `SchoolRepositories` is a wide dependency bag

### Evidence

- `package/domain-core/src/ports/school-repositories.ts` exposes every repository to every service/config that receives `SchoolRepositories`.
- Managed entity authorization/gates receive the full repository bag.

### Impact

- The package boundary is clean, but intra-core module boundaries are loose.
- Any workflow can quietly depend on unrelated repositories.
- Tests must infer module dependencies from usage rather than type contracts.

### Recommendation

Either split repository interfaces by module or define a typed repository map keyed by entity metadata. For high-risk workflows, prefer smaller constructor dependencies so the compiler documents what the workflow actually uses.

This should be gradual. Avoid a broad repository refactor until the entity registry exists.

## Finding 4: Managed count is safe but potentially expensive

### Evidence

- `ManagedEntityService.count()` currently lists matching entities, checks tenant boundaries, checks access, and returns `entities.length`.

### Impact

- Counting can become a full read of all matching rows.
- This is particularly risky because many webapp loaders call unpaginated `list({})`.

### Recommendation

Add an authorized count path to repository ports. Use repository-level counts for entities whose read access is module-level or tenant-level. Keep the full list-and-check path for entities that need row-level access filtering.

## Finding 5: Boundary enforcement is narrower than the documented architecture

### Evidence

- `tooling/repo/ci/check-boundaries.ts` (via `tooling/repo/lib/boundaries.ts`) only checks:
  - runtime importing HTTP
  - core importing integrations
  - core importing app aliases
  - packages importing integrations
- `apps/api/src/runtime/README.md` documents runtime subfolders as internal, with narrow exceptions.
- Actual imports outside `apps/api/src/runtime` include runtime internals such as `@/runtime/env/schema`, `@/runtime/types`, `@/runtime/env`, and `@/runtime/worker/auth-service`.

### Impact

- The repo has boundary rules, but many are prose-only.
- Legitimate exceptions are not encoded.
- Future drift will pass `check:boundaries`.

### Recommendation

Move boundary rules into either ESLint `no-restricted-imports` or a dependency graph tool such as dependency-cruiser. Keep the shell script only if it remains a thin wrapper.

Rules worth encoding:

- `package/domain-core` must not import apps, integrations, runtime, or adapters unless intentionally allowed.
- `package/domain-core`, `package/adaptor-postgres`, `package/generated-api-client`, and `package/adaptor-novu` must not import `package/integration-*`.
- Runtime internals may only be imported by runtime files plus a short explicit allowlist.
- API route modules should depend on `lib/school-api` and HTTP helpers, not runtime internals directly.
- Webapp routes should go through query/data modules rather than raw generated client calls, except in tests or explicitly allowed integration points.
- Generated files should not be manually edited.

## Finding 6: API client exposes operations the API rejects

### Evidence

- `package/generated-api-client/src/entity-resource.ts` exposes `save`, `batchSave`, `delete`, and `batchDelete` for all entities.
- `apps/api/src/lib/school-api/registry.ts` marks several entities as `allowDirectSave: false`, including students, enrollments, student fees, payments, assessment results, and report card results.
- `package/generated-api-client/README.md` states that the client still exposes `.save()` and the API will reject direct saves with `405`.

### Impact

- Developers discover command-only boundaries at runtime.
- The generated client knows the `allowDirectSave` flag but does not use it to improve type safety.

### Recommendation

Generate separate resource types:

- `ReadonlyEntityResource<TEntity>` with `list`, `one`, `count`, and `get`.
- `MutableEntityResource<TEntity>` extending readonly with `save`, `delete`, `batchSave`, and `batchDelete`.

Then use `allowDirectSave` from bindings to type each entity client. If delete policies differ from save policies later, split those flags explicitly.

## Finding 7: API schema and command metadata still have drift surfaces

### Evidence

- API command schemas are derived from core schemas, but command wrappers still manually omit/extend fields.
- API registry manually maps public command names to `SchoolService` method names and request schemas.
- Existing parity tests cover important examples, but not the whole command/entity surface.

### Impact

- New command work can compile while missing API schema parity.
- Drift tests are useful but incomplete.

### Recommendation

Expand registry-driven parity checks:

- Every command registry entry maps to an existing `SchoolService` command method.
- Every command has a request schema and response schema.
- Every entity registry entry maps to a `BaseSchoolService` service key.
- Every entity has query and response schema coverage.
- Direct-save false entities have a corresponding command path documented or tested.

## Finding 8: Webapp refresh boundary is too broad

### Evidence

- `apps/webapp/src/lib/auth/bootstrap-app.ts` loads shell, report cards, teaching log entries, then loads a large detail snapshot.
- `apps/webapp/src/lib/queries/detail-data.queries.ts` loads people, staff, subjects, finance, activities, homework, school life, student 360, planning, assessments, and access roles in one snapshot.
- `apps/webapp/src/lib/api/mutations/run-mutation.ts` resets and reboots the full app shell after most mutations.

### Impact

- Mutation UX will degrade as datasets grow.
- A small finance or attendance mutation can reload unrelated people, planning, roles, and report card state.
- It makes local debugging harder because many requests fire after every mutation.

### Recommendation

Introduce domain-scoped invalidation. Start with coarse buckets:

- `shell`
- `people`
- `staff`
- `finance`
- `planning`
- `assessments`
- `schoolLife`
- `reportCards`
- `teachingLog`
- `accessRoles`

Update `runMutation` to accept `invalidate: DomainDataKey[]` rather than a boolean `refresh`. Keep full bootstrap refresh as an escape hatch for cross-cutting mutations.

## Finding 9: Webapp list loaders are heavily unpaginated

### Evidence

Many webapp data loaders call generated entity lists with `{}`:

- people data loads students, enrollments, guardians, guardian links, attendance, assessments, and assessment results.
- finance data loads fees, student fees, and payments.
- planning and school-life loaders load sessions, class subjects, subjects, staff, resources, attendance, incidents, and calendar events.

### Impact

- Tenant scoping protects correctness, but large schools will pay for full-table reads.
- The broad detail snapshot amplifies the problem.

### Recommendation

Use scoped queries where the UI already knows class group, academic year, date range, or selected entity. Add pagination for admin-style lists before datasets become large.

## Finding 10: Verification scripts mutate by default

### Evidence

- Root `fullcheck` runs `lint:fix` before verification.
- `openapi:check` runs `openapi:generate` before drift checking.

### Impact

- Developers cannot safely run one command to answer "is my work clean?" without modifying files.
- Existing dirty generated artifacts make verification harder to interpret.

### Recommendation

Split scripts:

- `fix`: runs `lint:fix` and any formatter.
- `verify`: non-mutating lint, check, build, boundary check, tests.
- `generated:check`: verifies generated outputs without modifying the working tree, ideally through a temp directory or hash comparison.
- `generated:update`: intentionally regenerates OpenAPI and client artifacts.

## Finding 11: Documentation drift exists around webapp runtime behavior

### Evidence

- Root README describes `SSR / dev proxy` and says server code calls the API.
- `docs/reference/local-dev.md` correctly says the webapp is a static SPA with `ssr = false`.
- `apps/webapp/src/routes/+layout.ts` sets `ssr = false` and `prerender = true`.

### Impact

- New contributors may reason about the wrong request path.
- The API client README also has older SvelteKit/server wording in places.

### Recommendation

Update root README and API client README to match current browser SPA behavior:

- Browser client calls API via `@maya-invest/edaya-api-client`.
- Local Vite proxy forwards `/core`, `/auth`, `/doc`, and `/reference`.
- `API_URL` is the Vite proxy target.
- `PUBLIC_API_URL` is the browser-facing API origin when not same-origin.

## Finding 12: Environment file hygiene needs cleanup

### Evidence

- `.gitignore` ignores `.env`, `.env.local`, and `.env.*.local`, but not `.env.staging`.
- `tooling/seeding/.env.staging.example` says to copy to `tooling/seeding/.env.staging` and that the target is gitignored.
- `git ls-files '*.env*'` shows `tooling/seeding/.env.staging` and `tooling/seeding/.env copy.example` are tracked.

### Impact

- The repo's stated env hygiene does not match actual tracking.
- Staging env files can accidentally hold sensitive values later.
- The duplicate `copy.example` file adds confusion.

### Recommendation

- Add `tooling/seeding/.env.staging` or a broader safe pattern to `.gitignore`.
- Remove `tooling/seeding/.env.staging` from git tracking if it contains only local/staging runtime config.
- Delete or rename `tooling/seeding/.env copy.example`.
- Add a small `doctor` script that checks expected env examples and warns about tracked non-example env files.

## Suggested implementation backlog

### P0: Low-risk, high-signal cleanup

- Update README/API client docs for SPA behavior and proxy paths.
- Split `fullcheck` into non-mutating verification and explicit fix scripts.
- Fix env tracking and `.gitignore` mismatch.
- Add boundary checks for runtime internal imports with an explicit allowlist.

### P1: Developer feedback improvements

- Type API client resources based on `allowDirectSave`.
- Add registry parity tests for commands, entities, and schemas.
- Add a repo `doctor` script for env, generated drift, and common local setup issues.

### P2: Structural simplification

- Introduce typed entity metadata registry.
- Derive API `coreEntities` from registry.
- Derive `BaseSchoolService` managed entity construction from registry.
- Consider module-specific repository interfaces after registry is stable.

### P3: Webapp data scalability

- Replace boolean mutation refresh with domain-scoped invalidation.
- Split the detail snapshot into domain caches.
- Add pagination or scoped filters for high-cardinality lists.
- Add request logging or dev tooling to visualize post-mutation reload fanout.

## Non-goals for the first implementation pass

- Do not rewrite all repositories at once.
- Do not remove `SchoolService` until command registry and API dispatch have a replacement.
- Do not refactor the entire webapp data layer before adding observable invalidation buckets.
- Do not introduce a large framework-level dependency just to enforce boundaries if ESLint rules are sufficient.

## Reference files

- `README.md`
- `docs/reference/local-dev.md`
- `tooling/repo/ci/check-boundaries.ts`
- `apps/api/src/runtime/README.md`
- `package/domain-core/src/services/base-school-service.ts`
- `package/domain-core/src/services/domain-service.ts`
- `package/domain-core/src/services/managed-entity-service.ts`
- `package/domain-core/src/ports/school-repositories.ts`
- `apps/api/src/lib/school-api/registry.ts`
- `package/generated-api-client/src/entity-resource.ts`
- `package/generated-api-client/src/create-client.ts`
- `package/generated-api-client/README.md`
- `apps/webapp/src/lib/auth/bootstrap-app.ts`
- `apps/webapp/src/lib/queries/detail-data.queries.ts`
- `apps/webapp/src/lib/api/mutations/run-mutation.ts`
- `apps/webapp/src/lib/detail-data/context.svelte.ts`
- `tooling/seeding/.env.staging.example`

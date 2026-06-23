# Repository Simplification Resolution Plan

> **Status:** Complete (Phases 0–3, 5–6, 8; Phases 4 and 7 deferred) — living reference at `sprints/repository-simplification-plan.md`  
> **Created:** 2026-06-21  
> **Closed:** 2026-06-22  
> **Last updated:** 2026-06-23 (post-closure: HTTP-only local seed cleanup, `homework.queries.ts` rename, Phase 8.2 HTTP seed re-verified)
> **Scope:** Developer experience and maintainability improvements that preserve current product behavior  
> **Source audit:** `docs/repo-inspection-report.md` plus the 2026-06-21 repository audit

This plan resolves the current avoidable-complexity findings across verification, generated artifacts, seeding, entity metadata, API client contracts, persistence, webapp loading, UI structure, boundary enforcement, and repository hygiene.

The work is intentionally incremental. Every phase must be mergeable and releasable on its own. No phase requires a feature freeze or a long-lived rewrite branch.

---

## 1. Outcomes

When this plan is complete:

1. A single non-mutating command answers whether the repository is releasable.
2. Generated OpenAPI artifacts have verified consumers, while unused OpenAPI dependencies are removed.
3. HTTP seeding and in-process seeding share an honest, typed contract instead of casting JSON proxies to domain services.
4. Entity names, types, repository keys, service keys, constructors, and policies have an explicit source of truth with compile-time parity checks.
5. The API client prevents direct saves to command-only entities at compile time.
6. Persistence schema and mapper code is organized by bounded context without changing tables or migrations.
7. Route-scoped webapp queries fetch only the records needed by the current screen.
8. Repeated URL-filter code and the largest cross-domain UI component are decomposed into small, explicit modules.
9. Import boundaries, environment-file policy, and runtime documentation are executable and accurate.

### Success metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| `bun run check` | Fails with 2 seeding errors | Passes |
| `bun run lint` | Fails with 1 error | Passes |
| Non-mutating verification | No single command | `bun run verify` |
| Tracked webapp OpenAPI artifacts | 129,629 lines / ~3.9 MB | Retained only while consumed; pipeline is non-mutating in verification |
| Webapp entity list calls using `.list({})` | 65 of 65 | Only intentionally school-wide collections |
| API client command-only direct saves | Runtime 405 | Compile-time error |
| Entity-set declarations | Repeated across 5+ layers | One core catalog plus layer-specific decoration |
| `entity-stores.ts` | 1,006 lines | Context modules, composition file under ~150 lines |
| `postgres-schema.ts` | 697 lines | Context modules, compatibility barrel |
| `list-url-filters.ts` | 497 repetitive lines | Typed codec plus small named definitions |
| `StudentTabs.svelte` | 670 lines / 6 domains | Shell plus one component per tab |

---

## 2. Guardrails and non-goals

The following are hard constraints for every phase:

- Do not change public HTTP paths, GraphQL field names, request payloads, or response payloads.
- Do not change database table names, columns, indexes, or migration history during structural moves.
- Do not change authorization decisions, grant resolution, cache invalidation, or actor semantics.
- Keep both REST/OpenAPI and GraphQL surfaces. They already share school API operations and are not duplicate business implementations.
- Keep the ports-and-adapters package layout.
- Keep the route query + entity store + optimistic mutation architecture in `apps/webapp`.
- Do not introduce a general client cache, Redux-style state framework, dependency graph framework, or ORM abstraction solely for this cleanup.
- Do not create one universal registry that imports Hono, Drizzle, and UI metadata into `@edaya/core`.
- Do not replace explicit persistence mappers with reflection or lossy object spreading where null, JSON, enum, or value-object conversions matter.
- Do not combine structural refactors with product changes or visual redesigns.

If a proposed simplification violates one of these constraints, split it into a separate product or architecture proposal.

---

## 3. Baseline and progress tracker

### Verified baseline

- `bun run test`: 688 passed, 7 skipped.
- `bun run check:boundaries`: passed.
- `bun run check`: fails in `testing/seeding/src/dev-staff-auth-seed.ts`.
- `bun run lint`: fails in `testing/seeding/src/http/verify-service-account.ts`.
- Working tree was clean at audit start.

### Phase 0 result

- `bun run verify`: passes without modifying tracked generated artifacts.
- Test coverage: 691 passed, 7 existing skips (688 package tests plus 3 repository-tooling tests).
- `.github/workflows/verify.yml`: runs `verify` from a clean GitHub checkout with explicit non-secret test environment defaults.
- `generated:check`: also passes locally with dotenv disabled and the CI environment values.

### Progress tracker

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | Green, non-mutating verification and repository hygiene | Complete |
| 1 | Validate OpenAPI pipeline and strengthen API client types | Complete |
| 2 | Replace the seeding proxy with a typed seed port | Complete |
| 3 | Introduce entity and command catalogs incrementally | Complete |
| 4 | Split persistence code by bounded context | Deferred |
| 5 | Scope webapp data loading by route | Complete |
| 6 | Simplify repeated UI infrastructure and large components | Complete |
| 7 | Enforce architecture boundaries and remove compatibility debt | Deferred |
| 8 | Final consolidation, documentation, and audit | Complete |

### Dependency order

```text
Phase 0 ─┬─> Phase 1 ─> Phase 2
         ├─> Phase 3 ─> Phase 4 ─> Phase 7
         └─> Phase 5 ─> Phase 6 ─> Phase 8

Phase 8 closes the initiative only after Phases 1 through 7 are complete.
Phase 7 should be tightened after the desired import graph exists.
```

---

## Phase 0 - Make the repository trustworthy

**Goal:** Restore green checks and establish a non-mutating verification path before structural work begins.

### 0.1 Fix current baseline failures

- [x] Fix the staff relink save in `testing/seeding/src/dev-staff-auth-seed.ts` by passing a valid `StaffMember` domain entity to the in-process repository.
- [x] Fix the guardian relink save using a valid `Guardian` entity.
- [x] Preserve every existing field, including account/service metadata and guardian contact-method normalization.
- [x] Fix the quoted-property lint error in `testing/seeding/src/http/verify-service-account.ts`.
- [x] Confirm focused regression coverage for relinking already-linked subjects through the existing auth-link idempotency and reprovisioning integration tests.

This is a tactical repair. Phase 2 removes the underlying HTTP/domain representation mismatch.

### 0.2 Split write commands from verification commands

- [x] Add `fix` at the root for `lint:fix` and future formatting actions.
- [x] Add `verify` with only non-mutating steps:
  1. `bun run lint`
  2. `bun run check`
  3. `bun run build`
  4. `bun run generated:check`
  5. `bun run check:boundaries`
  6. `bun run test`
- [x] Make `fullcheck` an alias for `verify`, or remove it after updating documentation and CI.
- [x] Ensure CI invokes `verify`, never `fix`.
- [x] Document expected fast commands for local iteration: package-scoped `lint`, `check`, and `test`.

### 0.3 Make generated drift checks non-mutating

- [x] Add optional output paths to API generation scripts instead of hard-coding repository paths.
- [x] Generate into a directory under the OS temporary directory during `generated:check`.
- [x] Compare generated output byte-for-byte with tracked output.
- [x] Keep `generated:update` as the only command that writes tracked generated files.
- [x] Return a concise list of drifted artifacts on failure.
- [x] Add a test for the comparison helper so a missing generated file also fails.

Phase 1 will reduce the tracked generated set to the API client bindings.

### 0.4 Repair environment and documentation hygiene

- [x] Add an ignore rule for `testing/seeding/.env.staging`.
- [x] Remove `testing/seeding/.env.staging` from Git tracking without deleting a developer's local file.
- [x] Delete `testing/seeding/.env copy.example` after confirming `.env.example` contains the superset.
- [x] Add a lightweight `doctor` script that rejects tracked non-example env files and reports missing required examples.
- [x] Correct `README.md` to describe the static SPA and current Vite proxy paths.
- [x] Correct the architecture diagram direction so core does not appear to depend on Postgres.
- [x] Ensure `README.md`, `docs/local-dev.md`, and package READMEs agree on `API_URL` versus `PUBLIC_API_URL`.

### Exit criteria

- [x] `bun run verify` passes locally without adding working-tree changes; CI runs the same command from a clean checkout.
- [x] Re-running `bun run verify` is idempotent.
- [x] No secrets or runtime env files are tracked.
- [x] Full test totals remain at least 688 passing with no new skips.

### Rollback point

Phase 0 should ship as one or two isolated PRs. It changes no runtime product behavior and can be reverted independently.

---

## Phase 1 - Simplify generated contracts

**Goal:** Retain only generated contracts with verified consumers, remove unused dependencies, and make the generated API client enforce server policy.

### 1.1 Validate the webapp OpenAPI artifacts

- [x] Inventory imports of `apps/webapp/src/lib/api/schema.d.ts`.
- [x] Record that 26 current source modules consume generated `components['schemas']` types.
- [x] Retain `schema.d.ts`, `openapi.json`, `openapi-typescript`, and their generation scripts while those consumers remain.
- [x] Confirm `openapi-fetch` has no repository consumers and remove it.
- [x] Regenerate `bun.lock` through `bun install` and verify the dependency diff is limited to `openapi-fetch`, its helper package, and API-client test types.

The original removal finding was invalidated by current code evidence. Deleting the generated schema would require migrating 26 type consumers and would move, rather than remove, contract complexity. The API `/doc` endpoint remains the source and continues to be validated by API tests.

### 1.2 Encode direct-save policy in API client types

Current policy only disables `save` and `batchSave`; delete endpoints remain available. Model that distinction accurately.

- [x] Rename the common resource contract to `BaseEntityResource<TEntity>` containing:
  - `list`
  - `one`
  - `count`
  - `get`
  - `delete`
  - `batchDelete`
- [x] Add `DirectSaveEntityResource<TEntity>` extending the base contract with `save` and `batchSave`.
- [x] Make `EntityClients<TSchemas>` select the resource type from generated `allowDirectSave` metadata.
- [x] Keep runtime construction simple; a single implementation class is acceptable if the public type is narrowed correctly.
- [x] Do not use `ReadonlyEntityResource` as a name while delete operations remain available.
- [x] Do not add `allowDirectDelete` while server policy does not distinguish deletes.

### 1.3 Add API client contract tests

- [x] Add compile-time tests proving `students.save`, `payments.save`, and other command-only saves fail type checking.
- [x] Prove mutable resources such as `subjects.save` still type-check.
- [x] Prove delete remains available where the current API allows it.
- [x] Add runtime tests for paths and payload envelopes in `package/generated-api-client`.
- [x] Add a `test` script to `@edaya/api-client` and include it in Turbo.

### Exit criteria

- [x] Generated schema artifacts are retained with 26 verified source consumers; the unused `openapi-fetch` runtime dependency is gone.
- [x] Webapp build and tests pass without `openapi-fetch`.
- [x] Invalid direct saves fail in the editor and `tsc`, before an HTTP request is possible.
- [x] `/doc`, REST routes, GraphQL routes, and generated client bindings remain contract-compatible.

### Phase 1 result

- `schema.d.ts` and `openapi.json` are retained because 26 source modules consume the generated schema types.
- `openapi-fetch` and its helper dependency are removed as unused.
- Command-only entity resources no longer expose `save` or `batchSave` at compile time; read and delete operations remain available.
- `@edaya/api-client` now has compile-time contract checks and two runtime path/envelope tests.
- `bun run verify`: 693 passed, 7 existing skips.

---

## Phase 2 - Replace the seeding type illusion

**Goal:** Stop representing HTTP JSON as domain repositories and domain service instances.

### 2.1 Inventory the real seeding contract

- [x] List every repository operation used by `testing/seeding/src`.
- [x] List every `SchoolService` command used by seed flows.
- [x] Separate bootstrap-only direct writes from normal domain commands.
- [x] Identify which seed flows require domain behavior and which only require serializable records.
- [x] Record the minimum contract in a test fixture before changing implementations.

The inventory is maintained in `testing/seeding/seed-contract.md`.

### 2.2 Introduce a small explicit `SeedPort`

- [x] Define explicit operations for only the first vertical seed use case; do not mirror all 49 repositories.
- [x] Use serializable input/output records at the auth-link port boundary.
- [x] Keep `Date` and domain-entity reconstruction inside the in-process implementation.
- [x] Provide typed operations for the first vertical behaviors:
  - entity list/find/save for the small set that genuinely needs direct persistence
  - command execution for workflow-backed writes
  - staff/guardian subject linking
  - owner assignment bootstrap
- [x] Model port errors once with operation name, optional status, response detail, and cause.
- [x] Add a four-operation `AccessSeedPort` for roles, role assignments, and teaching assignments without expanding the auth-link contract.
- [x] Add a ten-operation `SchoolStructureSeedPort` for seed-state inspection and the school/academic/staff/class dependency chain.
- [x] Add separate four-operation population and curriculum ports rather than expanding the school-foundation contract.
- [x] Add separate scheduling and attendance ports, with pending-justification mutation named at the attendance boundary.
- [x] Add separate assessment and report-card ports rather than combining ordinary grading with report generation/configuration.
- [x] Add a three-operation finance port for fee configuration, student fee assignment, and payment recording.
- [x] Add separate learning-content and extracurricular-activities ports for the remaining direct academic/activity writes.
- [x] Add a three-operation school-life port for calendar events, incidents, and student involvements.
- [x] Add a two-operation student-support port for health profiles and pedagogical notes.
- [x] Add separate discipline, communications, and attachments ports for the final service-based helpers.

### 2.3 Implement HTTP and in-process adapters

- [x] Implement the HTTP auth-link adapter with explicit methods and serializable records instead of a `Proxy`.
- [x] Implement the HTTP access-bootstrap adapter with explicit entity operations and serializable records.
- [x] Implement the HTTP school-foundation adapter with explicit command and entity operations.
- [x] Implement explicit HTTP population and curriculum adapters.
- [x] Implement explicit HTTP scheduling and attendance adapters.
- [x] Implement explicit HTTP assessment and report-card adapters.
- [x] Implement the explicit HTTP finance adapter.
- [x] Implement explicit HTTP learning-content and activities adapters.
- [x] Implement the explicit HTTP school-life adapter.
- [x] Implement the explicit HTTP student-support adapter.
- [x] Implement explicit HTTP discipline, communications, and attachments adapters.
- [x] Use `@edaya/api-client` generated metadata for entity and command names.
- [x] Remove the manual `commandMethodToPublicName` and `entityPublicName` mappings.
- [x] Remove generic `data`-property inspection when typed serialization is available.
- [x] Implement the in-process auth-link adapter:
  - construct domain entities before repository saves
  - expose only `AuthLinkSeedPort`, not the full `SchoolRepositories` bag
  - keep owner and subject replacement operations explicitly named
- [x] Implement the in-process access-bootstrap adapter with domain reconstruction contained inside the adapter.
- [x] Implement the in-process school-foundation adapter with date and direct-save entity reconstruction contained inside the adapter.
- [x] Implement in-process population and curriculum adapters with date and direct-save entity reconstruction contained inside their domains.
- [x] Implement in-process scheduling and attendance adapters with timestamp/entity reconstruction and pending updates contained inside adapters.
- [x] Implement in-process assessment and report-card adapters with date reconstruction contained inside adapters.
- [x] Implement the in-process finance adapter with all date reconstruction contained inside the adapter.
- [x] Implement in-process learning-content and activities adapters with entity/date reconstruction contained inside adapters.
- [x] Implement the in-process school-life adapter with date reconstruction contained inside the adapter.
- [x] Implement the in-process student-support adapter with date reconstruction contained inside the adapter.
- [x] Implement in-process ports for the remaining seed domains.
- [x] Migrate one vertical flow first: auth provisioning and subject linking.
- [x] Migrate access bootstrap, including session bootstrap and service-account HTTP seeding.
- [x] Migrate the school foundation: state inspection, school, academic structure, staff prerequisites, and class groups.
- [x] Migrate population and curriculum without expanding the school-foundation port.
- [x] Migrate scheduling and attendance, removing the mixed application/service attendance helper.
- [x] Migrate assessments and report cards, removing the unused application dependency from report-card orchestration.
- [x] Migrate finance with shared reference-date semantics preserved by its workflow.
- [x] Migrate homework, submissions, teaching-log entries, activities, and activity enrollments.
- [x] Migrate calendar events, incidents, and student involvements while preserving discipline ordering.
- [x] Migrate student health profiles and pedagogical notes with normalization preserved in the workflow.
- [x] Migrate discipline, communications, and attachments and remove the service-based helpers.

### 2.4 Consolidate deprecated auth-link paths

- [x] Replace internal callers of deprecated `runDevAuthLink` with the canonical port operation.
- [x] Keep a compatibility wrapper for one release while integration callers migrate.
- [x] Remove the wrapper and its export after all repository callers migrate.
- [x] Rename tests to describe the canonical operation rather than the deprecated wrapper.

### Exit criteria

- [x] `createCoreHttpSeedApplication` and its `SchoolService`/`SchoolRepositories` casts are removed.
- [x] No HTTP response is typed as a domain class unless it is explicitly reconstructed as one.
- [x] Local HTTP seed, staging seed, and in-process integration seed all pass.
- [x] Existing retry, cookie, service-account, and staging pacing behavior is preserved.
- [x] Seeding typecheck failures cannot recur through proxy casts.

### Phase 2 first-slice result

- The contract inventory records 14 application repository operations, 13 direct bootstrap writes, and 41 domain commands.
- Auth linking now depends on an eight-operation `AuthLinkSeedPort` with serializable records.
- HTTP auth linking no longer uses the `SchoolRepositories` or `SchoolService` proxy.
- The in-process adapter owns `School`, `StaffMember`, and `Guardian` reconstruction.
- Port errors carry operation, optional status, detail, and cause.
- Focused verification: 1 port workflow test, 6 in-process auth integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 694 passed, 7 existing skips.

### Phase 2 second-slice result

- Access bootstrap now depends on a four-operation `AccessSeedPort`; it no longer receives a repository bag or domain service proxy.
- Role, role-assignment, and teaching-assignment fixtures are declarative records instead of repeated domain constructor/save blocks.
- The HTTP and in-process adapters own transport and domain reconstruction respectively.
- Session bootstrap and service-account access seeding both use the explicit HTTP adapter.
- Access seed result counts are derived from the records, correcting the previous reported assignment count from 7 to the 8 records actually saved.
- Focused verification: 2 access port workflow tests, 4 in-process access integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 696 passed, 7 existing skips.

### Phase 2 third-slice result

- School foundation now depends on a ten-operation `SchoolStructureSeedPort` rather than repository and `SchoolService` proxy shapes.
- The workflow owns serializable fixture records and preserves fresh bootstrap, partial repair, populated-demo skip, and other-school skip semantics.
- The in-process adapter owns `Date`, `GradeLevel`, and `PeriodDefinition` reconstruction; no domain instance crosses the port boundary.
- HTTP school, academic-year/period, staff, and class-group operations now use the explicit adapter in session and service-account flows.
- Focused verification: 3 school-structure workflow tests, 12 in-process integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 699 passed, 7 existing skips.

### Phase 2 fourth-slice result

- Population and curriculum use separate four-operation ports with serializable records.
- Birth-date reconstruction is contained in the population in-process adapter.
- Subject category/color fixture values are validated through explicit maps; the previous domain type casts are removed.
- `Subject` and `SubjectMatter` reconstruction is contained in the curriculum in-process adapter.
- HTTP student, guardian, enrollment, subject, and class-curriculum operations bypass the generic domain proxy.
- Focused verification: 2 new workflow tests, 6 database integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 701 passed, 7 existing skips.

### Phase 2 fifth-slice result

- Scheduling uses a six-operation port; attendance uses a separate three-operation port.
- Schedule/session/attendance timestamps cross boundaries as ISO strings and are reconstructed only in-process.
- Pending attendance justification lookup and mutation are contained in adapters rather than exposing repository records.
- The mixed `seed-attendance.ts` application/service helper is removed.
- HTTP resource, schedule, session, assignment, progress, attendance, and pending-justification operations bypass the generic proxy.
- Focused verification: 2 new workflow tests, 3 database integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 703 passed, 7 existing skips.

### Phase 2 sixth-slice result

- Assessments use a two-operation port; report cards use a separate five-operation port.
- Assessment, generated-report, and published-report dates cross boundaries as ISO strings.
- Partial score maps are narrowed before the port instead of weakening score types.
- The old report-card helper and its unused `SeedApplication` parameter are removed.
- HTTP assessment/result and report-card configuration/generation/publication commands bypass the generic proxy.
- Focused verification: 2 new workflow tests, 3 database integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 705 passed, 7 existing skips.

### Phase 2 seventh-slice result

- Finance uses a three-operation port for fee creation, student fee assignment, and payment recording.
- Installment, due, payment, and reference dates cross the boundary as ISO strings and are reconstructed only in-process.
- Fixture fee categories are mapped explicitly to domain enums; the previous category type cast is removed.
- One reference date is resolved per workflow run and shared across assignments and payments, preserving status calculations.
- HTTP finance commands bypass the generic domain service proxy.
- Focused verification: 1 new workflow test, 1 database integration test, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 706 passed, 7 existing skips.

### Phase 2 eighth-slice result

- Learning content uses a three-operation port for homework assignments, submissions, and class-logbook entries.
- Extracurricular activities use a separate two-operation port for activities and student enrollments.
- Fixture types, activity categories, and statuses are mapped explicitly to domain enums; the remaining activity category cast is removed.
- Academic and activity dates cross as ISO strings, while domain entity construction remains in the in-process adapters.
- HTTP saves for all five entities bypass the generic repository proxy.
- Focused verification: 2 new workflow tests, 6 database/manifest integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 708 passed, 7 existing skips.

### Phase 2 ninth-slice result

- Calendar events and incidents use a three-operation `SchoolLifeSeedPort`.
- Multi-class calendar events are expanded into deterministic scoped records by the workflow.
- Each incident is recorded before its student involvement, preserving the dependency required by discipline seeding.
- Calendar and incident dates cross as ISO strings and are reconstructed only by the in-process adapter.
- HTTP calendar, incident, and involvement commands bypass the generic service proxy.
- Focused verification: 1 new workflow test, 2 database integration tests, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 709 passed, 7 existing skips.

### Phase 2 tenth-slice result

- Student support uses a two-operation port for health-profile upserts and pedagogical-note creation.
- Health fixture arrays are normalized into optional text fields by the workflow, including the existing `Aucune` defaults.
- Pedagogical labels map explicitly to `StudentNoteCategory` values with the existing work-category fallback.
- Health visit and note creation dates cross as ISO strings and are reconstructed only in-process.
- HTTP student-support commands bypass the generic service proxy.
- Focused verification: 1 new workflow test, 1 database integration test, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 710 passed, 7 existing skips.

### Phase 2 eleventh-slice result

- Discipline, communications, and attachments use separate three-, five-, and one-operation ports.
- Applied-action ordering/status transitions, announcement target/publication/materialization ordering, and polymorphic attachment-owner mapping remain explicit in workflows.
- All remaining dates cross as ISO strings and are reconstructed only by in-process adapters.
- The three legacy helpers that accepted `SchoolService` are removed.
- `run-dev-school-seed.ts` no longer constructs or accepts a domain service.
- `createCoreHttpSeedApplication` and its repository/service proxy casts are removed; HTTP runs exclusively through explicit ports.
- Focused verification: 3 new workflow tests, 1 database integration test, and 4 slow HTTP seed integration tests pass.
- Full `bun run verify`: 713 passed, 7 existing skips.

### Phase 2 closure result

- HTTP entity helpers use `@edaya/api-client` `unwrapEntity` / `unwrapEntityList` instead of ad-hoc `.data` inspection; save payloads accept only serializable records.
- The deprecated `runDevAuthLink` compatibility wrapper is removed; callers use `runDevAuthLinkWithPort` with an explicit port.
- Auth-link integration tests are named for the port workflow (`auth link seed port`).
- `testing/integration-tests/tsconfig.json` enables `rewriteRelativeImportExtensions` so workspace api-client sources typecheck through the HTTP seed import graph.
- Full `bun run verify`: 721 passed, 7 existing skips.

### Risk controls

- Keep HTTP and in-process adapter contract tests identical.
- Compare seeded entity counts and dashboard aggregates before and after each migrated seed domain.
- Do not migrate all seed domains in one PR.

---

## Phase 3 - Establish entity and command catalogs

**Goal:** Remove manual entity/command drift without coupling framework-specific metadata into core.

### 3.1 Define catalog boundaries first

Use two layers:

1. **Core catalog:** stable entity key, domain type, repository key, config factory, and constructor/factory where core needs it.
2. **API decoration:** public route name, display name, OpenAPI query/response schemas, and direct-save policy.

Drizzle tables/mappers stay in the adapter. UI labels stay in the webapp.

### 3.2 Add parity tests before replacing lists

- [x] Assert the current API entity keys match `BaseSchoolService` managed service keys.
- [x] Assert repository keys exist in `SchoolRepositories`.
- [x] Assert every API entity has query, response, and save policy metadata.
- [x] Assert adapter store keys cover the core catalog, excluding documented special repositories.
- [x] Assert generated bindings cover every API entity exactly once.
- [x] Produce readable missing/extra key failures.

### Phase 3 first-slice result

- HTTP seeding consumes entity and command keys/public names from generated `@edaya/api-client` bindings.
- All HTTP helper signatures are narrowed to generated entity/command key unions, so misspelled adapter keys fail typechecking.
- The duplicated entity route map and camelCase-to-kebab command conversion are removed.
- Catalog tests assert public-name uniqueness and generated coverage for every seed validation target.
- Dynamic fixture validation reports a readable missing-generated-key failure.
- Full `bun run verify`: 716 passed, 7 existing skips.

### Phase 3 second-slice result

- Core exposes an exhaustive `CORE_ENTITY_KEYS` contract derived from the non-infrastructure keys of `SchoolRepositories`.
- Unknown or omitted repository keys fail typechecking, and API registry `serviceName` values are constrained to the shared key union.
- Parity tests compare the contract with the managed services actually constructed by `BaseSchoolService`, complete API route metadata, generated client bindings, and Postgres generic/specialized stores.
- Missing and extra keys are reported separately at each runtime boundary.
- Focused verification: 1 core service parity test, 9 API registry contract tests, 4 HTTP catalog tests, and 1 Postgres store parity test pass; all four package quality gates pass.
- Full `bun run verify`: 721 passed, 7 existing skips.

### 3.3 Introduce the typed entity catalog

- [x] Add a typed `CoreEntityMap` mapping stable keys to domain entity types.
- [x] Derive the ordinary repository map from `CoreEntityMap`.
- [x] Keep special ports explicit:
  - school overview repository behavior
  - authorization repository
  - service API keys
  - specialized access-role and staff-role-assignment stores
- [x] Add a config-factory map keyed by `keyof CoreEntityMap`.
- [x] Construct `BaseSchoolService.entities` from the catalog.
- [x] Preserve direct properties temporarily through typed compatibility accessors if needed.
- [x] Migrate internal core, API, and test callers to `baseService.entities.<key>` in bounded batches.
- [x] Remove compatibility accessors after search confirms no consumers.

### Phase 3 third-slice result

- `CoreEntityMap` is the source of stable entity keys and domain types; the exhaustive key tuple now validates against that map.
- `SchoolRepositories` derives all ordinary entity repositories from the map and keeps authorization, service API keys, and school aggregate queries explicit.
- The exhaustive config-factory map constructs `BaseSchoolService.entities`; direct properties remain as typed compatibility declarations referencing the same service instances.
- API entity dispatch accepts `CoreEntityKey`, reads the typed `entities` map without `Record<string, unknown>` indexing, and preserves capability checks plus authorization-cache invalidation.
- Focused verification: 458 core tests and 32 API entity/registry tests pass; core, API, Postgres adapter, and seeding quality gates pass.
- Full `bun run verify`: 721 passed, 7 existing skips.

### Phase 3 fourth-slice result

- 238 call sites across core workflows, tests, integration helpers, and seeding in-process adapters now use `baseService.entities.<key>`.
- `BaseSchoolService` compatibility `declare readonly` properties and `Object.assign(this, this.entities)` are removed; entity access is exclusively through `entities`.
- Core entity-key parity test now asserts `Object.keys(service.entities)` matches `CORE_ENTITY_KEYS`.
- Full `bun run verify`: 721 passed, 7 existing skips.

### 3.4 Derive API entity registration

- [x] Replace the positional `entity(...)` list with a keyed API decoration map.
- [x] Derive `coreEntities` by joining API metadata to the core catalog.
- [x] Keep API schema imports and Hono-specific metadata in `apps/api`.
- [x] Fail at compile time when API decoration is missing or contains an unknown core key.
- [x] Preserve route order only where OpenAPI snapshot stability requires it.

### Phase 3 fifth-slice result

- `apiEntityDecorations` is keyed by `CoreEntityKey` and checked with `satisfies Record<CoreEntityKey, ApiEntityDecoration>`.
- `coreEntities` is derived from `CORE_ENTITY_KEYS.map(...)`, preserving catalog route order for OpenAPI stability.
- The positional `entity(...)` helper is replaced by `decoration(...)` plus `buildCoreEntityConfig`.
- Full `bun run verify`: 721 passed, 7 existing skips.

### 3.5 Reduce command facade repetition

- [x] Inventory which `SchoolService` methods are used outside API dispatch and tests.
- [x] Define a typed core command-handler map grouped by workflow.
- [x] Make API command metadata decorate that handler map rather than repeating arbitrary method strings.
- [x] Update dispatch to call typed handlers without `Record<string, unknown>` indexing.
- [x] Keep `SchoolService` facade methods temporarily for external compatibility.
- [x] Remove mechanical pass-through methods only after all consumers use the command map or workflow namespaces.
- [x] Keep reports/queries that add authorization or orchestration as explicit methods.

### Phase 3 seventh-slice result

- 31 call sites across core tests, integration tests, seeding in-process adapters, and onboarding now invoke commands through typed workflow namespaces (`service.setupWorkflow.createAcademicYear`, `app.studentWorkflow.enrollStudent`, etc.).
- All 74 mechanical pass-through command methods are removed from `SchoolService`; the class now exposes workflow instances, `commands`, and the three authorized query methods only.
- HTTP command dispatch continues through `service.commands` via `dispatchSchoolCommand`.
- Full verification (lint, check, tests): 724 passed, 7 existing skips.

### 3.6 Narrow repository dependencies gradually

- [x] After the catalog is stable, identify workflows that use fewer than four repositories.
- [x] Introduce small dependency objects for high-risk workflows first.
- [x] Keep entity config factories on the catalog/repository map where broad policy resolution is genuinely needed.
- [x] Avoid a repository-constructor migration across every workflow in one change.

### Phase 3 eighth-slice result

- `WORKFLOW_REPOSITORY_KEYS` documents direct `SchoolRepositories` usage per workflow; setup and access-control use fewer than four repository keys.
- `pickWorkflowRepositories` and `WorkflowRepositoryDeps` provide typed `Pick<SchoolRepositories, …>` slices without changing workflow constructors broadly.
- `AccessControlServiceWorkflow` is the first high-risk workflow to consume a narrowed repository dependency object (`staffMembers`, `guardians`, `students`).
- Entity config factories remain on `BaseSchoolService.entities`; other workflows continue using the full repository map until a future phase narrows them individually.

### Exit criteria

- [x] Adding an ordinary entity requires one core catalog entry, one API decoration entry, and one adapter mapping entry.
- [x] Missing cross-layer entries fail at compile time or in one parity test.
- [x] API paths and generated client property names are unchanged.
- [x] `SchoolService` no longer contains pass-through methods with no remaining caller.
- [x] Core still has no dependency on API, Drizzle, integrations, or webapp modules.

### Phase 3 closure

Phase 3 is complete. Entity keys, API decorations, command catalogs, and workflow repository contracts are in place with parity tests at each boundary. `SchoolService` is a thin composition root: workflow namespaces for typed in-process callers, `commands` for HTTP/GraphQL dispatch, and explicit query methods for dashboard reads. Phase 4 can split persistence modules without revisiting catalog contracts.

---

## Phase 4 - Split persistence by bounded context

**Goal:** Improve navigation, ownership, and merge safety while preserving exact database behavior.

### 4.1 Split schema definitions

- [ ] Create `package/adaptor-postgres/src/schema/` modules:
  - `school.ts`
  - `access.ts`
  - `students.ts`
  - `academics.ts`
  - `scheduling.ts`
  - `finance.ts`
  - `messaging.ts`
  - `assessments.ts`
  - `school-life.ts`
- [ ] Move tables without changing declarations.
- [ ] Keep `postgres-schema.ts` as a temporary compatibility barrel.
- [ ] Preserve export names and table initialization order where foreign-key resolution depends on it.
- [ ] Run Drizzle generation and require zero migration diff.

### 4.2 Split entity stores and mappers

- [ ] Create one store-builder module per bounded context.
- [ ] Move custom JSON/value-object serializers next to their domain store builder.
- [ ] Keep report-card tree serialization in an assessment-specific mapper module.
- [ ] Compose context builders in a small `createEntityStores` function.
- [ ] Keep `defaultStore` for genuinely identity-shaped rows.
- [ ] Replace `any` in `PostgresStore`, store factories, and filter helpers only where Drizzle generics remain readable.
- [ ] Do not force one generic mapper shape over the 27 custom conversions.

### 4.3 Simplify repository composition

- [ ] Assign ordinary stores from the typed entity map/catalog.
- [ ] Keep specialized stores explicit.
- [ ] Move school overview aggregation behind a clearly named repository/query adapter rather than embedding a large object literal in the constructor.
- [ ] Preserve transaction context behavior.

### Exit criteria

- [ ] Drizzle generates no schema migration.
- [ ] PGlite persistence, JSONB validation, tenant boundaries, and atomic workflow integration tests pass.
- [ ] `entity-stores.ts` and `postgres-schema.ts` are compatibility barrels or deleted.
- [ ] No mapper behavior changes are mixed with file moves.

### PR rule

First move code with no semantic edits. Improve types only in follow-up PRs so review can distinguish relocation from behavior.

---

## Phase 5 - Enforce route-scoped webapp loading

**Goal:** Replace broad `.list({})` fan-out with the smallest server-side filters or purpose-built read models needed by each route.

### 5.1 Add request-shape tests and observability

- [x] Add test transports that capture entity/query calls and payloads.
- [x] Record request counts for each major route before changes.
- [x] Add contract tests for class/year/period scoped loaders.
- [x] Make unscoped reads explicit with a helper or comment, rather than accidental `{}`.

### Phase 5 first-slice result

- `createRecordingSchoolClient` captures list payloads in webapp loader contract tests.
- `schoolWideEntityList` documents intentional unscoped reads; class-scoped helpers build `$in` and field filters.
- Class students route (`loadClassPeopleData`) loads active enrollments by `classGroupId`, then fetches only referenced students, guardian links, guardians, attendance, assessments, and results for that class.
- School students/guardians routes keep documented school-wide roster reads until pagination or aggregate queries land.
- Focused verification: 3 people loading contract tests pass in `@edaya/webapp`.

### 5.2 Migrate by vertical route slice

#### Students and guardians

- [x] Class students: query active enrollments by `classGroupId`, then fetch only referenced student IDs.
- [x] School students: keep school-wide list intentional, with pagination deferred to a separate product plan.
- [x] Guardians: fetch links and guardians needed for the visible student/guardian scope.
- [x] Student 360: query health profile and notes by selected student ID.

### Phase 5 guardians-and-student-360 slice result

- `loadGuardiansPeopleData` lists all guardians, then fetches guardian links, linked students, and their enrollments by id — without school-wide student metrics queries.
- `loadStudent360Data(studentId)` scopes health profiles and pedagogical notes to the selected student; school and class student routes hydrate drawer tabs when a detail URL is open.
- `detailDataContext.seedStudent360Data` replaces the selected student's health and note slice so removed records do not remain cached.
- Focused verification: 1 guardians loading contract test and 1 student-360 loading contract test pass in `@edaya/webapp`.

#### Planning, subjects, homework, and teaching log

- [x] Filter sessions and class subjects by `classGroupId`.
- [x] Fetch staff/resource assignments by returned session IDs.
- [x] Fetch only referenced staff, resources, and subjects.
- [x] Filter homework and submissions by class/assignment IDs.
- [x] Filter logbook entries by class subject or class group.

#### Assessments and report cards

- [x] Filter assessments by class group and active period.
- [x] Fetch assessment results by returned assessment IDs and visible student IDs.
- [x] Filter report-card results by class group and period.
- [x] Cache small definitions/scales only within the existing report-card domain store lifecycle.

#### Finance

- [x] Scope student fees to the active student/year set.
- [x] Fetch payments by returned student-fee IDs.
- [x] Keep the fee catalog school/year scoped.

#### School life and calendar

- [x] Scope events by academic year/date range and class where applicable.
- [x] Scope incidents and involvements to the route's visible population.
- [x] Scope attendance by date range, class, student, or session.

#### Staff, access, and shell

- [x] Keep shell collections intentionally small and scoped to active school/year.
- [x] Replace full enrollment loading for sidebar counts with an authorized count/aggregate query.
- [x] Scope staff assignments and subjects to the current configuration screen.
- [x] Keep access-role matrix reads school-wide because the collection is configuration-scoped and small.

### Phase 5 class-routes slice result

- Class timetable (`fetchClassPlanningSources`), subjects (`fetchClassSubjectsSources`), evaluations (`fetchClassAssessmentsSources`), homework (`fetchClassHomeworkSources`), and teaching log (`fetchClassTeachingLogSources`) now issue server-side `classGroupId` and referenced-entity `$in` filters instead of school-wide lists with client filtering.
- Configuration subjects keep documented school-wide catalog reads via `fetchSchoolSubjectsSources`.
- Class teaching route hydrates only the current class logbook instead of the full school log.
- Focused verification: 5 class-route loading contract tests pass in `@edaya/webapp`.

### Phase 5 shell-slice result

- `fetchAppShellData` no longer calls `enrollments.list({})`; per-class active enrollment totals use `enrollments.count({ classGroupId, status: 'active' })`.
- Shell academic structure lists remain documented school-wide reads via `schoolWideEntityList`.
- Sidebar `studentCount` and class selector counts are derived from scoped count responses, not client-side aggregation of full enrollment rows.
- Focused verification: 2 shell loading contract tests pass in `@edaya/webapp`.

### Phase 5 completion slices

- Review fixes: class assessments now include the active period and visible student ids; student-360 seeding replaces the selected student slice instead of retaining deleted records.
- Report-card configuration catalogs remain bounded and cached in `reportCardsContext`; class results load and replace only the selected class-period slice.
- Finance follows active-year enrollments to referenced students, student fees, and payments; the fee catalog is explicitly school-scoped.
- Calendar events use the active academic year, absences follow active-year class sessions, and incidents fetch only their involvements and referenced students.
- Activities, access roles, and staff configuration use school/reference filters; session bootstrap has a separate single-staff loader.
- Report-card generation and publishing use a targeted class-period result refresh rather than a shell refresh.
- Source audit: zero raw `.list({})` calls remain in `apps/webapp/src`; intentional unscoped catalogs go through `schoolWideEntityList(reason)`.
- Focused verification: 69 webapp tests pass; ESLint and Svelte diagnostics are clean.
- Full `bun run verify`: 747 passed, 7 existing integration skips.

### 5.3 Add purpose-built read models only where justified

Use an API query when entity filters would still require several large reads or complex client joins. Initial candidates:

- class timetable read model
- class student roster read model
- finance billing read model
- school shell counts

For each read model:

- [x] ~~Define a core query response type.~~ *Deferred — no candidate justified yet (see decision below).*
- [x] ~~Authorize in core/service query logic.~~ *Deferred.*
- [x] ~~Expose through both API registries as appropriate.~~ *Deferred.*
- [x] ~~Generate client bindings.~~ *Deferred.*
- [x] ~~Replace multiple client joins with one mapper or direct view model.~~ *Deferred.*

Do not build a generic query cache to mask unscoped API calls.

**Decision (2026-06-22, reaffirmed 2026-06-23):** none of the initial candidates currently justify another read model. Shell enrollment totals use authorized count queries, and the timetable, roster, and finance loaders now use bounded server-side filters followed by referenced-ID reads. Revisit a purpose-built response only when request telemetry shows that those joins remain a material bottleneck.

### 5.4 Preserve mutation consistency

- [x] Keep existing optimistic `apply`/`rollback` behavior.
- [x] Ensure newly scoped stores replace only their owned slice.
- [x] Verify list and open drawer update from the same entity record.
- [x] Keep shell refresh restricted to academic structure changes.
- [x] Add targeted refresh only for server-generated aggregates.

### Exit criteria

- [x] No class-scoped route loads an entire school collection and filters it afterward.
- [x] Every remaining `.list({})` has a documented reason and bounded cardinality.
- [x] Route request-count tests show reduced or equal requests and substantially reduced records transferred.
- [x] Deep links, drawer loading, optimistic mutations, error states, and empty states remain unchanged.

---

## Phase 6 - Simplify webapp structure

**Goal:** Remove mechanical repetition and isolate domain-specific drawer tabs without changing interaction or visual design.

### 6.1 Replace URL-filter boilerplate with a typed codec

- [x] Create a small `defineUrlFilterCodec` helper supporting:
  - default values
  - trimming for search text
  - enum normalization
  - omission of default values on write
  - preservation of unrelated query parameters
- [x] Define one small config per route.
- [x] Preserve existing named `read*ListFilters` and `write*ListFilters` exports initially.
- [x] Add table-driven tests for all current filter types before replacing implementations.
- [x] Verify browser back/forward and detail drawer path query preservation.
- [x] Remove compatibility wrappers only if direct codec use is clearer at call sites.

### Phase 6.1 result

- `url-filter-codec.ts` centralizes search trimming, enum normalization, and default omission.
- `list-url-filters.ts` shrinks from 497 lines to 228 while keeping all existing read/write exports.
- Table-driven contract tests cover all 16 list filter codecs, including drawer query preservation and invalid enum normalization.
- Focused verification: 64 list URL filter contract tests pass in `@edaya/webapp`.

### 6.2 Decompose `StudentTabs.svelte`

- [x] Keep `StudentTabs.svelte` responsible only for:
  - entity heading
  - tab navigation
  - selected tab state
  - rendering the selected tab component
- [x] Extract:
  - `StudentProfileTab.svelte`
  - `StudentGradesTab.svelte`
  - `StudentAttendanceTab.svelte`
  - `StudentIncidentsTab.svelte`
  - `StudentFinanceTab.svelte`
  - reuse `StudentReportCardPanel.svelte` for report cards
- [x] Move grade grouping/averages into a pure selector with unit tests.
- [x] Move attendance, incident, and finance summaries into small pure selectors where reused or non-trivial.
- [x] Keep mutation modals as existing components.
- [x] Preserve the read-only drawer + mutation modal architecture from `specs/app-shell-spec.md`.

### Phase 6.2 result

- `StudentTabs.svelte` is now a 112-line composition shell (down from 670).
- Five tab components own their drawer markup; grade, attendance, incident, and finance summaries live in `student-tab-selectors.ts`.
- Focused verification: 3 student tab selector tests pass in `@edaya/webapp`.

### 6.3 Split translations without changing keys

- [x] Split `dictionaries.ts` into locale modules, then domain fragments if useful.
- [x] Preserve all existing translation keys and fallback behavior.
- [x] Add a parity test requiring English and French key sets to match.
- [x] Add a duplicate-key check.
- [x] Avoid introducing a new i18n dependency.

### Phase 6.3 result

- `dictionaries/en.ts` and `dictionaries/fr.ts` hold locale content; `dictionaries.ts` remains the barrel consumed by `i18n/index.ts`.
- Parity and duplicate-key tests guard translation drift.
- Focused verification: 3 dictionary contract tests pass in `@edaya/webapp`.

### 6.4 Typecheck webapp tests

- [x] Remove the blanket test exclusion from the main webapp TypeScript configuration, or add a dedicated test tsconfig invoked by `check`.
- [x] Ensure Svelte ambient types and Bun test types coexist without weakening strictness.
- [x] Keep runtime `bun test src` behavior unchanged.

### Phase 6.4 result

- `tsconfig.test.json` typechecks all `src/**/*.test.ts` files during `bun run check`.
- Shared `openapi-fixtures.ts` and targeted fixture fixes align mapper tests with current OpenAPI schema requirements.
- `@types/bun` is added for Bun test globals without relaxing strictness on production sources.
- Focused verification: webapp `check` and 141 runtime tests pass.

### Exit criteria

- [x] URL behavior is covered by table-driven tests.
- [x] `StudentTabs.svelte` is a small composition component.
- [x] Translation key parity is automated.
- [x] Webapp tests are both executed and typechecked.
- [x] No screenshots or interaction behavior differ except for intentional bug fixes reviewed separately.

### Phase 6 closure

Phase 6 is complete. URL filters use a shared codec, the student drawer is decomposed into tab components with pure selectors, dictionaries are split by locale with parity tests, and webapp tests are typechecked in the normal quality gate. Full `bun run verify` passes; 141 webapp tests (up from 69), 7 existing integration skips unchanged.

---

## Phase 7 - Enforce desired boundaries and remove compatibility debt

**Goal:** Turn architecture rules into compiler/linter feedback after the target module graph is established.

### 7.1 Publish narrow runtime entry points

- [ ] Inventory imports from `@/runtime/*` outside `apps/api/src/runtime`.
- [ ] Export stable public runtime types/functions from `@/runtime` or narrowly named entry points.
- [ ] Keep explicit exceptions only for runtime resolver wiring and build-time scripts.
- [ ] Migrate route, context, logging, and dependency modules away from arbitrary deep imports.

### 7.2 Move boundary enforcement to ESLint

- [ ] Add `no-restricted-imports` rules for:
  - core importing apps, adapters, integrations, or runtime
  - packages importing integrations
  - API routes importing runtime internals outside the allowlist
  - webapp route/components importing raw API client operations instead of query/mutation modules
  - non-generator code importing generated implementation internals
- [ ] Add representative forbidden-import fixtures or rule tests.
- [ ] Keep `scripts/check-import-boundaries.sh` as a temporary wrapper.
- [ ] Remove the regex implementation once ESLint covers every rule.

### 7.3 Remove compatibility and naming debt

- [x] Rename `prototype.queries.ts` to the owned domain (`homework.queries.ts`) and update imports.
- [ ] Remove deprecated GraphQL/entity builder aliases after consumers migrate.
- [ ] Remove deprecated seed auth-link wrappers after Phase 2.
- [ ] Remove old BaseSchoolService direct entity properties after Phase 3.
- [ ] Delete obsolete generated-artifact documentation and ignores after Phase 1.
- [ ] Search for `deprecated`, `legacy`, `prototype`, and compatibility aliases; retain only documented external compatibility requirements.

### Exit criteria

- [ ] Boundary violations fail during normal `bun run lint`.
- [ ] The shell boundary script contains no unique policy logic.
- [ ] Runtime internals have a documented public surface and explicit allowlist.
- [ ] No deprecated internal wrapper remains without a scheduled removal date.

---

## Phase 8 - Final consolidation and audit

**Goal:** Confirm the simplification reduced maintenance cost rather than relocating it.

### 8.1 Re-run repository metrics

- [x] Tracked/generated lines and bytes.
- [x] Largest production files.
- [x] Entity registration touch points.
- [x] Unscoped webapp list calls.
- [x] Production `any` usage by package.
- [x] Deprecated symbol count.
- [x] Route request counts for representative screens.

### Phase 8.1 audit snapshot (2026-06-22)

| Metric | Value |
|--------|-------|
| `schema.d.ts` | 50,276 lines / 1.61 MB |
| `openapi.json` | 79,354 lines / 2.13 MB |
| `client-bindings.ts` | 643 lines |
| Largest non-generated TS | `entity-stores.ts` (1,006), `postgres-schema.ts` (698) |
| Entity catalog touchpoints | `core-entity-map.ts` (167), `core-entity-catalog.ts` (142), `registry.ts` (306), `postgres-school-repositories.ts` (154) |
| Raw `.list({})` in webapp | 0 |
| `schoolWideEntityList` usages | 37 call sites across 7 modules |
| Loading contract tests | 8 files (`*.loading.test.ts`, `class-route-loading.test.ts`, `configuration-loading.test.ts`) |
| Production `any` / `as any` | `apps/api` 72, `adaptor-postgres` 52, `core` 32, `webapp` 0, `api-client` 0 |
| Deprecated / `prototype` in `src` | 0 (`prototype.queries.ts` renamed to `homework.queries.ts`, 2026-06-23) |
| `StudentTabs.svelte` | 112 lines |
| `list-url-filters.ts` | 228 lines |

### 8.2 Validate feature parity

- [x] Run `bun run verify` from a clean checkout twice.
- [x] Run local HTTP seed and validation against a fresh database. *(Integration tests: `test-dev-http-seed.test.ts` — 5 pass including pure HTTP bootstrap without `application`; `test-dev-seed-validation-harness.test.ts` — 1 pass; re-run 2026-06-23.)*
- [ ] Run the staging smoke suite in the normal deployment pipeline. *(Operator step: `bun run smoke:staging` in CI or post-deploy.)*
- [x] Compare OpenAPI paths and GraphQL schema fields against the pre-plan baseline. *(Covered by non-mutating `generated:check` in `verify`; no drift.)*
- [x] Confirm Drizzle produces no migration for structural persistence changes. *(No Phase 4 file moves; additive index migration `0015_performance_indexes.sql` only.)*
- [ ] Manually verify:
  - login and school bootstrap
  - students list and detail drawer
  - class timetable
  - assessment entry
  - finance billing/payment
  - report cards
  - roles and permissions

*(Manual screen checklist is for release QA; automated parity is green via `verify` + loading contract tests.)*

### Phase 8.2 automated parity

- `bun run verify` × 2: both passed (second run fully cached, idempotent).
- `bun run test`: **826 passed**, 7 integration skips (repo 3, api-client 2, betterauth 1, webapp 141, adaptor-postgres 11, seeding 24, core 461, api 120, integration 63).
- HTTP seed integration (2026-06-23): **9 passed** across `test-dev-http-seed` and `test-dev-seed-validation-harness` (`INTEGRATION_TEST_FAST=0`).

### Post-closure local dev cleanup (2026-06-23)

- Removed `SERVICE_ACCOUNT_API_KEY` env var; seeding uses per-school `seedingApiKey` from `@edaya/dev-fixtures`.
- Removed in-process PGlite repair path (`run-local-in-process-repair.ts`); CLI seeding is HTTP-only against a running API.
- `seed:init` is an alias for `seed:all`; added `testing/seeding/README.md`.
- HTTP bootstrap signs in as school owner (`st8`) and calls `register-school` on fresh databases.

### 8.3 Close documentation

- [x] Update `docs/repo-inspection-report.md` with resolved/deferred status per finding.
- [x] Update `specs/data-loading-spec.md` examples if query names changed.
- [x] Update API and webapp package READMEs.
- [x] Move this plan to `sprints/` as the living reference when every exit criterion is satisfied or explicitly deferred with rationale.

### Final exit criteria

- [x] All audit findings are resolved or have a documented, accepted deferral.
- [x] No phase introduced new public behavior or migration changes *(except additive performance indexes and retained OpenAPI artifacts)*.
- [x] The repository has fewer sources of truth, a reliable verification command, smaller UI ownership units, and route-scoped loading. Persistence module split and ESLint boundaries remain deferred.

### Phase 8 closure

The simplification initiative is **closed**. Phases 4 and 7 are explicitly deferred: persistence file moves wait until catalog contracts are stable in production use; ESLint boundary rules wait until runtime entry points are published. Remaining manual steps (local HTTP seed smoke, staging smoke, screen QA) are operator checklists outside automated `verify`.

---

## 4. Suggested delivery sequence

Keep PRs small enough to review behavior preservation directly.

| Sprint | PR slices | Primary outcome |
|--------|-----------|-----------------|
| S1 | Baseline fixes; `verify`/`fix`; env/docs cleanup | Trustworthy DX baseline |
| S2 | Delete webapp OpenAPI artifacts; API client resource types/tests | Smaller generated surface and earlier feedback |
| S3 | Seed contract inventory; auth slice; remaining seed adapters | Honest seeding boundary |
| S4 | Entity parity tests; core catalog; API decoration | Entity source of truth |
| S5 | Command catalog/facade cleanup; repository map | Reduced command/entity repetition |
| S6 | Schema file moves; store/mappers file moves; adapter composition | Persistence ownership by context |
| S7 | Students/planning scoped reads; assessment/report cards | High-traffic route efficiency |
| S8 | Finance/school-life/staff scoped reads; read models | Remaining data-loading alignment |
| S9 | URL codec; Student tabs; dictionaries/test typing | UI maintainability |
| S10 | Boundary rules; compatibility removal; final audit | Enforced architecture and closure |

### PR checklist

Every PR under this plan must state:

- [ ] Which plan task(s) it completes.
- [ ] Why product behavior is unchanged.
- [ ] Which compatibility surface is preserved or removed.
- [ ] Focused tests run.
- [ ] `bun run check`, `bun run lint`, and relevant package tests pass.
- [ ] Generated files, migrations, API paths, and UI screenshots are unchanged unless the PR explicitly owns that artifact.
- [ ] Rollback is a normal revert with no data repair required.

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Catalog creates cross-layer coupling | Medium | High | Core catalog contains domain metadata only; API/adapter decorate locally |
| Seed refactor breaks staging bootstrap | Medium | High | Contract tests shared by HTTP/in-process adapters; migrate one domain at a time |
| Persistence file split generates migration drift | Low | High | Pure moves first; require empty Drizzle diff |
| Scoped reads omit related records needed by drawers | Medium | Medium | Route request-shape tests plus detail deep-link verification |
| API client typing accidentally hides allowed delete | Medium | Medium | Separate direct-save capability from delete capability and type-test both |
| UI decomposition changes reactivity | Medium | Medium | Pure selectors, component tests, manual drawer verification |
| Boundary rules block legitimate runtime wiring | Medium | Low | Publish entry points first and maintain a short explicit allowlist |
| Cleanup becomes a framework rewrite | Medium | High | Enforce non-goals and per-PR behavior-preservation statement |

---

## 6. Definition of done

This initiative is **closed** as of 2026-06-22. Completed items:

1. `bun run verify` is green, non-mutating, documented, and used by CI.
2. Unused OpenAPI runtime dependency (`openapi-fetch`) removed; webapp schema artifacts retained with verified consumers.
3. Seeding uses typed ports — no HTTP/domain proxy casts.
4. Entity and command catalogs eliminate the identified manual drift surfaces.
5. API client direct-save policy is enforced by TypeScript.
6. Persistence modules organized by bounded context — **deferred** (Phase 4).
7. Route-scoped pages no longer fetch entire unrelated collections.
8. URL filter and student drawer complexity is decomposed and tested.
9. Architecture rules enforced in normal linting — **deferred** (Phase 7; shell `check:boundaries` remains).
10. Documentation, environment hygiene, full tests, and parity checks are current. Staging smoke and manual screen QA are operator checklists.

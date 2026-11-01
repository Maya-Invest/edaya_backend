# RC implementation evidence — 9–10 September 2026

> Historical; partner OAuth later cancelled (2026-09-15). First-party identity JWTs remain.

Working-tree evidence on top of backend baseline `98b7a136`; these changes are not committed or deployed. All integration runs use synthetic fixtures and disposable local databases. The launch audit records historical baseline failures separately.

## Latest completed slice — school-scoped repository reads and writes (10 September)

Managed entity services now bind the actor's trusted school separately from caller filters using a core repository capability. The PostgreSQL implementation adds independent SQL predicates to ID lookup, multi-ID lookup, list, findOne, count, delete and batch delete. Indirect ownership uses correlated EXISTS queries; filtering occurs before ordering, pagination and row construction. All 55 managed entity stores have a tested SQL ownership path. Unknown tables without ownership configuration fail closed when bound.

Scoped saves check both proposed ownership and the existing conflicting row in one INSERT/ON CONFLICT statement. A foreign-ID collision cannot become an overwrite after an earlier application precheck. Scoped batch saves join the active transaction, or open one when called directly, so a later rejected row rolls back earlier rows. Duplicate batch IDs are rejected before any write, preserving the previous bulk-statement rejection instead of allowing successive updates to bypass a single preflight. Managed write preflight still checks all existing requested records and preserves mixed-school rejection before mutation. School ownership does not replace permission checks, business gates or actor-specific access checks.

School notification templates retain their merged defaults and now normalize nested schoolId aliases while using the shared query implementation. Invitation writes preserve existing token hashes. The school overdue-fee and published-report-card counts now execute scoped SQL counts rather than loading students and all matching domain records into memory.

Final verification passed:

| Check | Result |
| --- | --- |
| Full backend verification | Hygiene, lint/types, builds and unit tests passed; API 298 pass, 0 fail |
| Domain-service tests | 524 pass, 0 fail; 1,354 assertions |
| PostgreSQL adapter tests | 98 pass, 0 fail |
| Service/runtime integration | 13 pass, 0 fail; 104 assertions |
| Auth/HTTP integration | 39 pass, 0 fail; 374 assertions, including five new scoped-repository tests |
| HTTP seed/doctor/validation | 11 pass, 0 fail; 82 assertions |
| Native PostgreSQL integration | 22 pass, 0 fail; 125 assertions; disposable cluster stopped successfully |
| Working-tree whitespace | Passed |

Native tests cover independent-connection ID collisions, foreign proposed ownership, guarded deletes, mixed-batch rollback and duplicate-ID rejection. The full HTTP run verifies all 55 repository ownership paths and the final lookup/write contracts. Normal local task caching was used; affected packages were rechecked. No web/mobile code or public schema changed in this slice, so their preceding verification was not rerun.

Final local logs: `/tmp/edaya-scope-final-verify.log`, `/tmp/edaya-scope-final-integration.log`, `/tmp/edaya-scope-final-seed.log`, and `/tmp/edaya-scope-final-native.log`. Results are recorded here because those logs are temporary.

Compatibility corrections: foreign-ID reads now return no record (HTTP 404) rather than loading a foreign row and throwing afterward. The role test asserts that no record is returned; explicit foreign-school filters and mixed-school writes still reject. Legacy integration helpers now deny unavailable records in the same manner as production command helpers. Scoped repository binding is lazy, preserving existing partial test fixtures while every used production PostgreSQL repository is bound before its first operation.

Remaining WP2 work: actor-specific teacher/guardian/student SQL predicates, SQL counts for non-elevated actors, secondary relationship consistency and concurrency across related writers, and a complete review of privileged raw repository/manual-route/job/aggregate paths. Generic managed operations are scoped; raw repositories used by internal workflows are still privileged. Optional capability fallback remains for existing non-PostgreSQL test adapters. Scoped batch saves currently execute row statements inside one transaction; API batches remain capped at 100, and deployed batch latency still needs qualification. Public partner endpoints, maintenance qualification and the overall RC remain unfinished.

## Completed slice — explicit public mutations (10 September)

All 55 API entities now declare six operation flags: create, update, delete and their batch equivalents. REST only mounts permitted mutations; GraphQL uses the same policy. Generic upsert requires both create and update. The exported contract omits 42 forbidden generic mutation endpoints. Forbidden generic writes return 404; named business commands remain available. TypeScript clients omit forbidden methods from their public types and reject them before transport dispatch; Dart clients enforce the generated flags before dispatch. Both generators reject missing/incomplete operation metadata.

Command-owned entities retain their named workflows. Class-subject saving remains command-owned; deletion is exposed for unused custom allocations only. The domain guard rejects inherited allocations and existing assessments, schedules, lesson sessions, staff/teacher assignments or curriculum links. Batch deletion checks every entity before deleting any. The real HTTP regression verifies inherited/used/scheduled denial, preservation of a mixed batch, and successful deletion of an unused custom allocation.

The web billing drawer retains cancellation/adjustment and no longer offers hard deletion. Class cleanup rejects enrollment history (including inactive enrollments) and inherited curriculum before destructive requests. It removes class curriculum links without deleting shared subject-matter records. Three web regression tests cover these cases.

Final validation for this slice:

| Check | Result |
| --- | --- |
| Backend full verification | Passed: hygiene, lint/types, builds and unit tests; API 298 pass, 0 fail |
| Service/runtime integration | 13 pass, 0 fail; 104 assertions |
| Auth/HTTP integration | 34 pass, 0 fail; 182 assertions, including final class-subject deletion regression |
| HTTP seed/doctor/validation integration | 11 pass, 0 fail; 82 assertions |
| Native PostgreSQL integration | 18 pass, 0 fail; 113 assertions; disposable server stopped successfully |
| Web full verification | Passed; webapp 761 pass, 0 fail, 2,162 assertions; Svelte diagnostics: zero errors/warnings |
| Mobile full verification | Generated bindings drift, analysis and all workspace tests passed |
| OpenAPI/client generation | Passed; generated TypeScript and Dart policies match backend export |
| Working-tree whitespace checks | Passed in all three repositories |

The final runs passed after correcting the new GraphQL test to use the existing singular batch field names and restarting integration tests against the final scheduled-subject guard. An earlier run had two authentication timeouts; both passed on subsequent full runs without changing authentication code. Full verification uses the repositories' normal local task cache; changed packages were rechecked. This is working-tree evidence, not matching committed release revisions.

Local logs: `/tmp/edaya-operations-backend-verify.log`, `/tmp/edaya-operations-integration.log`, `/tmp/edaya-operations-seed.log`, `/tmp/edaya-operations-native.log`, `/tmp/edaya-operations-web-verify.log`, and `/tmp/edaya-mobile-operations-verify.log`. These are temporary logs; the results and limitations are recorded here.

Scope limits: this is explicit transport exposure and consumer alignment, not completion of all WP2 work. Indirect/actor SQL scopes, scoped writes, the remaining command-ownership review, and concurrency-safe deletion across related writers are still required. Fee-catalog CRUD retains its existing domain guards; assessed student fees and payments remain command-owned. Class cleanup remains a sequence of client requests and is not yet an atomic backend command. External partner routes/consent UI and full release qualification remain pending.

## Previous slice — 9 September

## Implemented in this continuation

- Persisted guardian `hasAccess` and enforced it in guardian actor/portal resolution; additive school migration `0007_guardian_access.sql`. Existing records default to the previous enabled behavior because disabled values were never persisted. Operators must review any previously intended disabled guardians before rollout.
- Added the pinned provider schema and normalized delegation tables, transaction boundary, live guardian selection checks, operator registry and real OAuth integration tests. No public partner route has been enabled.
- Added first-party connected-app listing/revocation, ownership enforcement and generated OpenAPI contracts.
- Hardened the internal OAuth admission/consent/identity boundary. Verified signed minimal identity, issuer/audience rejection, PKCE, code replay, refresh replay, exact-origin consent, denial without a grant, absolute expiry, and cross-instance revocation. Ordinary logout preserves partner identity/refresh; security logout-all revokes them.
- Migrated HTTP fixtures and seed transport to Bearer; preserved the original token during temporary account provisioning; removed automatic write retries. Production and Worker quotas remain enforced.
- Corrected the report-card section repository property to `reportCardDefinitionId` while retaining the existing SQL `definition_id` column.

## Local checks

| Check | Result |
| --- | --- |
| Backend service/runtime integration | 13 pass, 0 fail |
| Backend auth/HTTP integration | 33 pass, 0 fail |
| Full HTTP seed/doctor/validation integration | 11 pass, 0 fail |
| Native PostgreSQL finance, tenant, notification and OAuth integration | 18 pass, 0 fail; 113 assertions |
| Focused first-party/connected-app API tests | 6 pass, 0 fail; 69 assertions |
| Seed transport tests | 6 pass, 0 fail; 16 assertions |
| OpenAPI export and client generation | Passed |
| Backend full verification | Passed: hygiene, quality, builds and unit tests; API 297 pass, 0 fail |

Native tests create their own PostgreSQL cluster and stop/remove it afterward. They do not use the project's database URL. The service and HTTP runs include the new live guardian-delegation checks. The native OAuth tests use two independent auth connections with a real provider; the school authorization port in those protocol tests is synthetic. A shared-auth/school database end-to-end OAuth test remains required before public mounting.

Prior web and mobile verification passed in the preceding implementation batch. They were not rerun for this backend batch; the new connected-app client UI and cross-repository generated contract qualification remain outstanding.

## Qualification still required

The implementation plan remains in progress. Required work includes actor-specific SQL filtering/counts, secondary relationship consistency and privileged-path/command-ownership review, general command idempotency/audit, notification tenant keys and migration-only schema, all fourteen restricted partner read DTOs, hosted consent and client management UI, production topology/cache checks, maintenance/restore/retention tools, and staging migration/failure-recovery/soak evidence. Local passing tests do not qualify the backend as an RC.

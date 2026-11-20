# Shared authorization fixture handoff

Owner: Codex. `createAuthorizationScenario()` is exported by `@edaya/fixtures` from `tooling/fixtures/src/shared/authorization-scenario.ts`. It returns fresh domain records, stable IDs and verified-actor-shaped test inputs. These actors are test data, never runtime authentication credentials. The factory has no persistence or provider side effects and does not install itself into existing environments.

| Scenario | Baseline student visibility |
|---|---|
| School A owner | Three school A children; no school B child |
| Scoped staff | Two explicit student-detail targets; no unrelated or foreign child |
| Assigned subject teacher | Two currently enrolled children in the assigned class |
| Unassigned teacher | Empty list/count; no child by known ID |
| Primary guardian | Two siblings; no unrelated or foreign child |
| Second guardian | First sibling only; no inferred access to the other sibling |
| Unrelated guardian | Their own unrelated child only |
| Disabled guardian | Authorization denied despite a persisted link |
| Foreign guardian | Their school B child only |
| Student profile | Own record only, despite sharing the school owner's login |

The owner, assigned teacher, primary guardian and first student share one synthetic subject. The second guardian has an independent subject and relationship. The scoped staff grant uses the canonical `QUERY_STUDENT_DETAIL_READ` student grain; it does not change the school grain of `STUDENT_READ` or invent a class-scoped directory permission.

`tooling/integration-tests/src/services/shared-authorization-scenario.integration.test.ts` persists the graph in a fresh disposable PGlite database and exercises the real service policies and SQL repositories. It checks list/single/count/pagination parity for all allowed profiles, unauthorized family writes, disabled access, unlinking while preserving the co-guardian, teaching removal and grant expiry using existing service instances. Revocation mutations themselves run through the owner's managed entity policies and transactions. Database arrangement is internal test setup; it is not a mutation seed or public bypass. Existing attachment/profile mutation seeds use admitted HTTP/in-process workflows. Minimal school bootstrap now uses admitted school/staff/guardian commands in one selected-school transaction. Auth-link owner assignment uses the internal, fixed-system-identity `initializeFixtureSchoolOwner` capability and cannot transfer ownership. No direct mutation repository bypass remains in those adapters; this factory itself adds no mutation seed.

The suite passes three tests with 77 assertions and passes again in the private-delivery 44-test integration run and the final seed-admission 46-test integration run, including the readonly-contact input typing correction. Exact gate outcomes are recorded in [implementation evidence](00-implementation.md#private-delivery-and-shared-fixture-checkpoint).

Plan 01 adds pairing credentials and intended-recipient cases to this graph. Plan 02 adds private photo purposes and approved/pending versions. Plan 03 adds independent accounts/charges/allocations without replacing the identity or school graph. Plan 04 adds source publication, artifact audiences and revoked downloads. Plan 05 uses the two guardians and siblings for per-student response uniqueness and aggregate privacy. Plan 06 runs the resulting coordinated fixtures against its explicitly selected environment with synthetic recipients. No feature's future lifecycle is represented as already implemented.

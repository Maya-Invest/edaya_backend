# Backend remediation and marks approval

Implementation baseline: `6cf9b7d65df440e351cf209d5717ae3895b6d1cc`.
Source audit: `../../../audits/edaya-backend-2026-09-22/REPORT.md` in the parent workspace.

## Accepted decisions

- Address B01–B16 and O1–O7 with coordinated backend/web/mobile contracts.
- Marks: whole evaluation Draft → Submitted → Approved; submission freezes marks/configuration/roster. Separate staff reviewer, no self-approval across identities. Return with a reason only before dependent report publication.
- Complete effective-date roster; scored/absent/exempt are separate from homework compliance. Absence/exemption do not contribute score or weight. Families see approved marks only.
- Report publication requires all applicable sheets approved; preserve section comments, two-decimal precision, source revisions, and period-end placement. Carry transferred marks by curriculum subject identity.
- One explicit school currency; complete-input command receipts; installation-specific push.
- Fresh database is an operational prerequisite managed separately. No remote reset, Identity deletion, storage deletion, or deployment is part of local implementation.

## Milestones and evidence

- [x] M1: production authentication, historical fixtures, verification hygiene (B07/B08/B15/B16/O7).
- [x] M2: marks approval, concurrency, teacher/staff/family interfaces (B09/O4).
- [x] M3: report context, comments, precision, placement, publication replay (B01/B02/B03/B12/O2/O4).
- [x] M4: currency, replay, common aging and finance queries (B04/B05/B06/B10/O2/O4).
- [x] M5: independent document runtime and installation push (B11/B13).
- [x] M6: scoped projections, narrowed workflows, typed mappings and measured batches (O1–O6).
- [ ] M7: generated clients, release fingerprint and local app verification complete; coordinated deployment and live acceptance pending (B14).

Implementation is in the working tree across backend, `edaya_frontend`, and `edaya_mobile`. Checked milestones have implementation and local automated evidence. M7 remains open for coordinated deployment and live acceptance; the program is not release-approved yet. Current contracts and rollout prerequisites are documented in [marks approval and release](../reference/marks-approval-and-release.md). The [deployment acceptance checklist](backend-release-acceptance.md) records the remaining environment journeys.

Pinned release: `28b4b1c33a65c439a60a7416e1a00bfb9a87acb63777c6ae53b6d9db02494272`. All three local contract comparisons pass. This is a content-addressed working-tree release, not a committed or deployed revision.

## Finding traceability

Paths below are relative to the backend unless marked otherwise. Regression tests assert the desired behavior, replacing the original audit characterizations.

| Finding | Implementation evidence | Acceptance evidence |
|---|---|---|
| B01 | `capabilities/academics/report-comments.ts`; stable nested comment preservation during generation/publication | `tests/services/workflows/marks-review.test.ts`; native `report-card-document.test.ts` |
| B02 | Migration 0031 decimal report fields; report calculation retains two decimals | Marks journey asserts 15.5 through persisted/publication results; native report/document tests |
| B03 | Publication replays stored result ID and authorizes the actual result | Marks journey uses a different proposed ID; native concurrent publication test |
| B04 | Finance correction commands use explicit request identity and complete payload hashing | Finance workflow and native finance concurrency tests |
| B05 | Catalog edits accept new request IDs independently of mutable field values | Finance workflow replay regression tests; regenerated clients/web mutations |
| B06 | Migration 0032 school finance currency; shared currency validation, financial gates, explicit statement currency | Finance workflow/ledger tests; fresh school seeds configure currency |
| B07 | Production `http/dependencies/session-actor.ts` propagates selected academic year | `production-session-actor.integration.test.ts` |
| B08 | Verified-email requirement at HTTP and platform provisioning boundaries | Platform provisioning and production authentication tests |
| B09 | Approval schema, shared marks gates/hooks, revisioned commands, scoped review policy, effective-date roster | Marks review tests cover lifecycle, no self-review, batch rollback, curriculum freeze, score/compliance preservation and history retention under ordinary/batch deletion; native profile journey and races |
| B10 | Shared installment-aging SQL and domain calculation; one reference date | Native finance/reset/concurrency; dashboard benchmark validates partial installment amounts |
| B11 | Background document work owns its Worker runtime and closes it in `finally` | `apps/api/tests/lib/test-schedule-background-task.test.ts`; durable native document tests |
| B12 | Effective enrollment at period end; transfer matching by underlying subject identity | Report-card workflow/aggregation regressions and native report tests |
| B13 | Migration 0033 installation identity and independent delivery outcomes | Notification gateway, tenant isolation and native outbox tests; mobile persistent installation ID |
| B14 | Regenerated OpenAPI/TS/Dart; refreshed web dependency; release manifest/check | Generated TS/Dart and release manifest; consumer tests cover 51/501 pagination, scoped requests, teacher timetable, report comments, decimal/no-score display and explicit currency |
| B15 | Integration harness uses production actor dependency with external verification substitution | Production authentication integration tests |
| B16 | Historical migration fixtures independent of future columns; seeding types and current startup table assertions repaired | Historical migration tests; historical migration regressions, native installation and 8 fresh-seed integration checks |

Service paths in this table are under `package/domain-service/src`; service tests are under `package/domain-service/tests`; native tests are under `tooling/integration-tests/src/native`.

## Structure and performance traceability

| Opportunity | Change | Evidence / remaining gate |
|---|---|---|
| O1 | Scoped SQL dashboard/app-shell/finance projection ports; tenant, resource, year/date filtering before aggregation | Native dashboard benchmarks at 30/300/3,000 students; 15 queries → 1; 3,000-student fixture 186.00 ms → 102.12 ms; plans and limitations recorded in `docs/performance/` |
| O2 | Period/roster SQL candidate projection and bounded report mark/subject loads; scoped batched finance reconciliation | Report regression tests; native finance tests. Assessments, marks, enrollment history and aggregation sources are loaded once per report context |
| O3 | Document assembly split by document operation; scheduling materialization, family feedback aggregation and finance reconciliation receive named dependencies | Original workflow escape check retained; added operation check rejects broad service/full repository types with regression coverage |
| O4 | Shared gates for marks/configuration/currency; named lifecycle commands and receipt handling | Generic saves, deletes, batches, curriculum sync, named commands and native races exercised |
| O5 | Transaction-local batch policy facts, bounded SQL proposed-row authorization and bulk persistence, shared validation snapshot | Mixed-school denial, invalid-row rollback, duplicate marks and frozen-sheet tests |
| O6 | Typed SQL store/row/table boundaries; public repository types hide private mapper types; template defaults constructed in service composition | Type checks and template parity tests |
| O7 | Corrected repository/testing docs, drift diagnostics name affected files, current feature/release documentation | Repo doctor, boundaries, naming and contract checks |

## Verification ledger

- Native PostgreSQL final run: **60 passed, 0 failed** (`/tmp/edaya-native-final2.log`), including the teacher-profile → independent reviewer → guardian → publication journey and same-identity owner/staff self-review denial. The three opt-in dashboard benchmarks are skipped in the ordinary suite and passed in their separate final projection run (`/tmp/edaya-bench5.log`); plans and measurements are stored as evidence files in `docs/performance/`.
- Web `bun run verify`: **passed**, 929 webapp tests, quality and production builds (`/tmp/edaya-web-verifyfinal2.log`).
- Mobile `melos run verify`: **passed**, all six packages report no analyzer issues; generated-client comparison, unit/widget tests, teacher-scoped timetable query, outbox sequencing, report decimal/no-score/comment and currency regressions pass (`/tmp/edaya-mobile-verifyfinal2.log`). Physical-device/provider acceptance is not implied.
- Backend `bun repo verify --full`: **passed** (`/tmp/edaya-fullverify10.log`), including 756 service unit tests, 286 API unit tests, 195 PostgreSQL adapter tests, 18 service integration tests and 33 authentication/HTTP integration tests. Repository hygiene, generated OpenAPI comparison, architecture checks, lint, types and builds pass.
- Route integration fixtures now configure their own finance currency and explicitly construct the curriculum/teacher records needed by the lightweight school fixture. Full dev-seed assertions remain in the separate seed suite; no timeout was increased and no behavioral assertion was removed.
- Fresh native seed integration: **8 passed, 0 failed**, covering in-process seed contracts, HTTP validation and HTTP doctor (`/tmp/edaya-seed-serial.log`). Fixtures include explicit currency and Draft/Submitted/Approved sheets with separate editor/reviewer subjects.
- An overlapping seed run exceeded its existing 180-second setup limit. The isolated complete rerun passed with unchanged timeouts (378.93 seconds for all eight checks). Final acceptance commands run sequentially; the failed overlapping run is retained at `/tmp/edaya-seed-final.log`.
- A family visibility test timed out when run concurrently with the full PGlite suite. All seven portal tests passed in isolation with the original timeout. Full verification now limits package concurrency to two, matching the root verification script; no timeout was increased.
- **All local gates pass.** Cross-repository contract comparisons agree on the pinned release and `git diff --check` is clean. The code has not been committed, deployed, or used to reset a remote database. Coordinated rollout and deployed cross-app/provider/device acceptance remain open in [the release acceptance checklist](backend-release-acceptance.md).
- The machine-readable [verification evidence](backend-remediation-verification.json) records the commands, test counts, release ID and log digests. Temporary log paths are local to this workspace session; regenerate evidence by rerunning the listed commands.

The initial projection measurement is retained at `docs/performance/backend-remediation-initial-projection.json`; final measurements and execution plans are at `docs/performance/backend-remediation-benchmarks.json`. Raw timings are local measurements, not a production SLA.


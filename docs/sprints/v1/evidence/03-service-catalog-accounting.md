# Plan 03 — Service catalog accounting cutover evidence

Owner: Codex. Recorded 2026-09-15. Working trees remain dirty until a coordinated commit; HEAD revisions below are the last recorded SHAs plus this cutover.

## Target identity

Disposable finance reset is admitted only for the native-runner loopback cluster (`127.0.0.1`). The runner in `tooling/integration-tests/src/native/run.ts` creates a temporary PostgreSQL data directory, binds loopback, and passes `EDAYA_NATIVE_TEST_URL`. It never selects a project `DATABASE_URL`.

The finance-only CLI is `tooling/db-migrate/scripts/reset-finance-target.ts`. It requires `--url=` or `EDAYA_NATIVE_TEST_URL` plus `--school-id=`. It refuses empty URLs, PGlite, remote hosts, and does not default to `DATABASE_URL`, `STAGING_DATABASE_URL`, or `PRODUCTION_DATABASE_URL`. A matching guard lives in `@edaya/adaptor-postgres` (`assertFinanceResetTarget` / `resetDisposableFinanceRecords`) and rejects reusing `DATABASE_URL` even when the host is loopback. `tooling/db-migrate/scripts/reset-finance.ts` is the same loopback policy via `EDAYA_FINANCE_RESET_URL`.

No staging, production, identity, or `.data` school database was selected for this cutover.

## Preservation digest

Before and after finance reset the operation hashes:

- **Identity** — ordered row ids for schools, students, guardians, guardian links, academic years/periods, staff, class enrollments, non-payment attachments, command receipts, audit, and outbox.
- **Content** — `md5(row_to_json(...))` aggregates of those same rows.

Counts alone are not used. Payment-owned attachments and pending payment upload intents (`attachment->>'ownerKind' = 'payment'`) are excluded from the preservation set and are deleted with catalog services, enrollments, charges, year accounts, payments, allocations, and account entries. Command journal rows are kept so old finance receipts cannot be cleared to permit stale replay; new fixture ids (`enr-60`, `pay-120`, …) do not reuse retired fee ids (`f1`, `b1`).

Native coverage: `tooling/integration-tests/src/native/finance-reset.test.ts` and the preservation case in `finance-concurrency.test.ts`.

## Old-client `FINANCE_MODEL_REPLACED`

Retired commands still exist on the HTTP surface so existing clients fail clearly:

- `createFee` / `create-fee`
- `assignFeeToStudent` / `assign-fee-to-student`
- `adjustStudentFee` / `adjust-student-fee`
- `cancelStudentFee` / `cancel-student-fee`
- `cancelPayment` / `cancel-payment`

`FinanceServiceWorkflow` throws `BusinessRuleViolationError('FINANCE_MODEL_REPLACED', ...)`. Integration atomic-workflow coverage expects that code from `cancelPayment()`. Admitted writes are `createCatalogService`, `enrollStudentInService`, `recordPayment` (`account_only` | `fifo` | `targeted`), `reverseAllocation`, `reversePayment`, `refundAvailableBalance`, plus charge waive/cancel.

## Versions / clients

| Component | Revision | Client notes |
|---|---|---|
| Backend | `5c79bea62653e0794986009fc3f3f9d6aa7fd19a` plus dirty Plan 03 working tree | Migration `0023_service_catalog_accounting`; COMMAND_ONLY catalog/enrollments/charges/accounts/payments |
| Identity | `f4a2db0d257d6f0e982b57a55058ac716f64f3f9` | Unchanged for this finance cutover |
| Frontend | `6033230a953132566933b7c3877aa921bd5db911` plus dirty working tree | Staff Fees / Billing / Payments plus `/finance/reconciliation`; Track E marked `done` |
| Mobile | `08a17ad2700ef9d62733c7a4a601a9ad5af467bc` plus dirty working tree | Guardian `/fees` uses `getStudentFinanceSummary`; Dart bindings regenerated |
| Generated TypeScript client | package `0.0.0` workspace source | `catalogServices`, `createCatalogService`, `enrollStudentInService`, named finance queries, retired fee commands |
| Generated Dart client | `packages/edaya_api_client` workspace source | `createCatalogService`, `getStudentFinanceSummary`, matching command public names |

Staff IA keeps Fees / Billing / Payments labels. Guardian keeps `navFees` / `/fees`. Teachers have no finance UI.

## 60 000 / 40 000 / 120 000 scenario

Money is integer minor units. New ids, not replayed fee ids:

1. Catalog `cat-tuition-60` / `ci-cat-tuition-60` at 60 000; `cat-transport-40` / `ci-cat-transport-40` at 40 000.
2. Enrollments `enr-60` / `ci-enr-60` materialize charges with the same ids (`oneTimeChargeId`).
3. Receipt `pay-120` / `ci-pay-120` for 120 000 with `allocation.mode = fifo` → settlements 60 000 + 40 000, available 20 000, outstanding 0.
4. Reverse the 60 000 allocation → debt 60 000, available 80 000.
5. Distinct disbursement refund 20 000 (`refund-s1-20` / `ci-refund-s1-20`) → available 60 000.

Service tests in `package/domain-service/tests/capabilities/student-accounting.test.ts` and native `finance-concurrency.test.ts` assert the FIFO and reversal arithmetic. Demo/demo-ci fixtures plus `seedDevFinance` replay the same commands.

Other fixture coverage: deposit-only (`pay-deposit-s29`), unpaid (s7/s8/s30), partial (s2/s22), paid (s4/s5), waived (s9), cancelled (s10), installments (tuition catalogs), multiple allocations (s6 five receipts), reversed receipts (`pay-reversed-s29`), missing due date (`cat-undated-lab`), unallocated USD (`pay-s28-usd`), two years/currencies (demo `2025` EUR/USD vs demo-ci `2025-ci` XOF/EUR), and an unpaid sports charge due in the dashboard upcoming window (`svc-s7-sports` / `ci-svc-s11-sports` via `seedUpcomingDate(2)`).

## Verification ledger (2026-09-15)

Logs under `/tmp/edaya-v1-plan03/`.

| Command | Outcome |
|---|---|
| Backend `bun run verify` | EXIT 0. Quality, build, and unit tests. Representative counts: core 294, service 691, authorization 98, postgres 182, api 275, fixtures 94, seeding 71, plus remaining packages. |
| Backend `bun run test:integration` | EXIT 0. API 18 pass / HTTP 29 pass (0 fail). Includes finance rollback and `FINANCE_MODEL_REPLACED`. |
| Backend `bun run test:integration:native` | EXIT 0. **40 pass / 0 fail** on a disposable loopback cluster, including competing allocations, distinct-account payments, reversal vs allocation, refund vs allocation, money+audit+outbox rollback, 60k/40k/120k, and finance-only preservation. Report-card native timeouts were raised to 30s so renderer cases are not starved. |
| Backend `bun run test:integration:seed` | Finance dashboard KPIs including upcoming `fee_due` pass. **Plan 02 residual:** 3 failures, all profile photos (`profile-photos: expected >= 59, got 8` on in-process seed; HTTP validate/doctor `create-profile-photo-upload` 409). Not a finance-model defect; do not lower the photo target. |
| Frontend `bun run verify` | EXIT 0. Webapp 801 pass, webadmin 2, web-repo 3. |
| Mobile `melos run verify` | EXIT 0 (Command Line Tools + `/tmp/edaya-xcrun-shim`). integration_tests 6, api_client 11, auth 14, shared 32, guardian 25, teacher 42. |

Plans 01 and 02 remain on-going. Plan 03 was sequenced on photos migration `0022` rather than waiting for those plans to close.

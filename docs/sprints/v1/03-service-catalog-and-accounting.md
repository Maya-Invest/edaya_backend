# Plan 03 — Service catalog and student accounting

| Field | Value |
|---|---|
| Status | planned |
| Created / updated | 2026-09-13 |
| Target | Existing backend, staff webapp, guardian app, finance imports/fixtures and generated clients |
| Owner | Assign when implementation starts |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 02 — Photos and branding](02-student-photos-and-branding.md), complete with evidence |
| Next | [Plan 04 — Official documents](04-official-documents.md) |

## Outcome and approved scope

Replace `Fee → StudentFee → Payment` with an account-based catalog, obligation and accounting model in one releasable backend/client cutover. Staff can bill, receive money, allocate available funds and correct mistakes; guardians see the same financial state.

This plan supersedes the older [catalog plan](../service-catalog-plan.md)'s one-payment/one-allocation constraint and deferred client cutover, and the older RC instruction to freeze the fee model. Payments fund accounts; one payment can support several allocations, and existing account funds can settle charges without a new payment. This adoption does not import the backend rewrite's architecture.

V1 includes one-time services, staff-managed enrollment, installments, receipts/deposits, targeted/FIFO allocation, adjustments/waivers/cancellation, reversals, refunds, statements, aging and reconciliation. Subscriptions, credit wallets, guardian self-enrollment, activity charging, online gateways and automated year-end rollover remain deferred.

## Entry prerequisites and source anchors

- [ ] Verify Plans 00–02 are `done`, especially native transaction/replay/audit/outbox and current family-scope enforcement.
- [ ] Inventory all fee/payment consumers and finance-owned dependencies before designing the reset: domain, schema, workflows, API/GraphQL exposure, client queries, imports, dashboard counts, attachments, fixtures and notifications.
- [ ] Confirm the selected finance data is disposable; record a target-scoped reset plan preserving non-finance records.

Start with the [current finance workflow](../../../package/domain-service/src/services/workflows/finance.ts), [finance schema](../../../package/adaptor-postgres/src/schema/finances.ts), [older design and migration inventory](../service-catalog-plan.md), [guardian fee feature](../../../../edaya_mobile/apps/guardian/lib/features/fees), and [frontend finance gap](../../../../edaya_frontend/docs/reference/ui-api-gap-matrix.md).

## Domain and interface contract

| Type | Responsibility |
|---|---|
| `CatalogService` | School/year offering, one-time billing terms, currency, price and active lifecycle |
| `StudentServiceEnrollment` | Staff-managed student/service relationship and immutable accepted terms snapshot |
| `StudentCharge` | Obligation, installment schedule, adjustment/waiver effects, active settlement and cancellation |
| `StudentYearAccount` | Available money for one school/student/year/currency, projected from immutable entries |
| `Payment` | External receipt/disbursement facts, amount, method/reference, effective date and correction links |
| `Allocation` | Immutable settlement from one account to one charge, with linked reversal facts |
| `StudentAccountEntry` | Append-only credits/debits with stable source, causation, effective/recorded time and resulting balance |

Named commands: create/update/activate/archive catalog service; enroll/cancel service enrollment; materialize/adjust/waive/cancel charge; record payment; allocate account balance; reverse allocation; reverse payment; refund available balance. Use existing command registration and conventions; do not expose generic balance, ledger or allocation writes.

Named reads: student finance summary, account statement, open/due charges, payment/settlement history, school aging, reconciliation and current-related-family overview. Catalog administration, receipt recording, allocation, reversal/refund and reconciliation use separately delegable actions. Entries and allocations are purpose-specific projections, not unrestricted public entity lists.

Mandatory financial rules:

- Money is integer minor units with explicit currency and correct precision. School/student/year/currency endpoints must agree.
- One account exists per school/student/year in its admitted currency; catalog/enrollment terms do not change historical charges after editing a service.
- Available funds never become negative; active allocations never exceed the adjusted charge obligation. Serialize affected accounts/charges in a consistent order.
- FIFO orders dated unpaid charges by due date, creation time and ID; charges without a due date follow dated charges deterministically.
- Installment schedules preserve accepted dates/amounts. Settlement is attributed oldest-due-first within the charge; reversals restore that attribution. Aging sums actual overdue installment remainders.
- Reject adjustments/waivers that reduce a charge below active settlement until explicit allocation reversal makes the transition valid. Reject cancellation of a charge with active allocations.
- Corrections append linked reversals. Payment reversal requires sufficient current funds or explicitly selected allocation reversals in the same command; do not infer allocation ownership from payment causation.
- Unallocating funds is not a cash refund. A refund produces its own durable disbursement/history and cannot exceed available funds.
- Idempotency, duplicate external-reference protection and business source uniqueness protect different failure modes; implement all that apply.

## Ordered implementation checklist

### 03.1 — Model, policies and persistence

- [ ] Add the seven domain types, stable financial errors, lifecycle rules, same-school endpoint checks and immutable accounting effects.
- [ ] Define one-time charge materialization identity and active-enrollment uniqueness to prevent duplicate obligations on replay.
- [ ] Add Postgres schema/repositories, uniqueness/relationship constraints and consistent account/charge locking under existing transaction ports.
- [ ] Declare the new actions/resource scopes and restrict generic mutations of money, settlement and command-owned lifecycle state.
- [ ] Bind audit/outbox/command receipts to the same financial transaction; mutation failure cannot leave a partial account entry.

### 03.2 — Commands and reconciliation

- [ ] Implement catalog lifecycle and staff-managed individual/bounded batch enrollment with accepted terms snapshots.
- [ ] Materialize one-time charges/installments idempotently; implement adjustments, waivers and cancellation with explicit reasons and settlement guards.
- [ ] Record external receipts/deposits as account credits; support deposit-only, explicit targets and deterministic multi-charge FIFO allocation.
- [ ] Allocate existing balance without creating synthetic cash receipts. Return a typed allocation preview/result for staff confirmation and history.
- [ ] Implement allocation reversal, receipt reversal and available-balance refund, retaining source/correction links and immutable entries.
- [ ] Enforce scoped external-reference uniqueness when a reference is supplied; preserve legitimate unreferenced cash receipts rather than inventing a global duplicate rule.
- [ ] Provide read-only reconciliation of entries versus account projection and active settlement versus charge projection, with actionable differences and no automatic historical repair.

### 03.3 — Queries, clients, imports and artifacts

- [ ] Implement summaries/statements/aging with access filters before totals, pagination and aggregation.
- [ ] Staff: catalog and enrollment management, charges, receipt/deposit entry, allocation preview, adjustments, cancellation, reversals/refunds and reconciliation.
- [ ] Guardian: clearly separate available money, outstanding debt and currently overdue amounts; show charges, schedules and permitted receipt/settlement history.
- [ ] Update dashboard KPIs, student finance drawers, payment attachment owner resolution, imports and generated TypeScript/Dart contracts.
- [ ] Remove `Fee`/`StudentFee` entity/API types from active consumers and write paths. Existing human-facing “fees” vocabulary need not force unrelated navigation changes.
- [ ] Update the frontend's deferred finance tracker to this v1 slice and replace stale API/fixture expectations. Do not mark the feature shipped before the coordinated clients pass.
- [ ] Expose immutable receipt and charge/statement source projections for Plan 04; finance PDFs are implemented there.

### 03.4 — Disposable finance cutover

- [ ] Produce a reset inventory including dependent demo finance artifacts and external-reference identities; prove identities, schools, students, guardians, relationships and academic records are excluded.
- [ ] Implement target-validated disposable reset/reseed tooling through existing repository safety conventions; no default remote or production fallback.
- [ ] Preserve applied migration history; create the new current schema through an explicit subsequent evolution, not by silently rewriting deployed migrations.
- [ ] Rewrite finance fixtures and import mappings for the account model; verify deterministic reruns do not duplicate economic events.
- [ ] Remove the old model from the active schema/API after dependencies are handled. No dual-read accounting shim and no partial release with old payments and new charges.
- [ ] Record matching backend/web/mobile/client versions and old-client failure/update behavior. Verify unsupported old financial mutations fail clearly.
- [ ] Rehearse cutover on disposable data, check non-finance preservation and reconcile all seeded accounts before handoff.

## Fixtures and acceptance tests

Required scenario in minor units: charges 60,000 and 40,000; receipt 120,000; allocations 60,000 and 40,000; available funds 20,000 and debt zero. Reversing the first allocation restores 60,000 debt and raises available funds to 80,000. A later cash refund is a distinct debit/disbursement.

- [ ] Fixtures: deposit-only, unpaid/partial/paid/waived/cancelled charges, installments, multiple allocations, reversed receipts, refunds, missing due date, unallocated money and multiple years/currencies.
- [ ] Unit/service tests: snapshots, materialization uniqueness, FIFO ordering, installment attribution/aging, adjustment guards, currency consistency and typed failures.
- [ ] Native races: competing allocations, distinct simultaneous payments, changed/same replay keys, receipt reversal versus allocation, refund versus allocation and rollback of money/audit/outbox together.
- [ ] Reconciliation: entry sum equals available balance and net active settlement equals each charge projection after every correction sequence.
- [ ] Access: same-school unrelated and cross-school IDs, wrong year/currency, revoked guardian linkage and separate financial actions.
- [ ] Consumer/API tests: coordinated generated contracts, staff/guardian totals, allocation preview, duplicate imports, old mutation rejection and payment attachment privacy.
- [ ] Cutover tests: reset touches only the declared disposable finance set and preserves all non-finance fixtures.

## Completion evidence and exit gate

Evidence: not collected; implementation has not started. Apply [Plan 00 verification requirements](00-common-requirements.md#fixtures-and-verification), including native concurrency, generated contracts, seed integration and web/mobile evidence. Record before/after reset inventories, exact versions and reconciliation output.

- [ ] Staff can bill, receive, allocate and correct/refund money through real client/API paths.
- [ ] Account entries, balances, settlement and aging reconcile exactly; all concurrency cases pass.
- [ ] Guardian summaries agree with staff for permitted children; unrelated access is denied.
- [ ] Active contracts/clients/imports use one accounting model and non-finance records survive cutover.
- [ ] Update this plan and its index row to `done` after all required evidence passes.

## Handoff to Plan 04

Provide the verified receipt/disbursement facts, charge and installment projections, account statement source, correction links, stable source versions and audience policies. [Plan 04](04-official-documents.md) builds billing documents exclusively on these contracts, without reviving `StudentFee` or treating deposits as proof of charge settlement.

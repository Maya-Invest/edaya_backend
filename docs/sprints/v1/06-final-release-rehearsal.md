# Plan 06 — Final release rehearsal

| Field | Value |
|---|---|
| Status | planned |
| Created / updated | 2026-09-13 |
| Target | Exact coordinated existing-backend, identity, web, generated-client and mobile release candidate |
| Owner | Assign a release coordinator when rehearsal starts; feature owners resolve their defects |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 05 — Family feedback surveys](05-family-feedback-surveys.md), complete with evidence |
| Additional prerequisites | Plans 00–04 complete; all individual gates and unrelated required launch capabilities have evidence |
| Next | Release-readiness handoff for the recorded candidate |

## Outcome and boundaries

Prove the five features operate together under the final versions, current authorization and realistic recovery conditions. Produce a reviewable release evidence report and operational handoff identifying the exact candidate ready for v1.

This is a separate seventh plan. Passing unit tests or completing [Plan 05](05-family-feedback-surveys.md) does not complete the rehearsal. All five features must be enabled in the candidate. Use an isolated disposable rehearsal environment, synthetic data and controlled notification recipients; do not send invitations or surveys to real families as test traffic.

Feature defects discovered here return to their owning plan for correction and evidence updates. The rehearsal does not implement a parallel version of a feature or treat missing required behavior as an acceptable test omission. Production rollout and app-store publication are separate from declaring the recorded candidate ready.

## Entry gate and evidence inputs

- [ ] Verify [Plan 00](00-common-requirements.md), [Plan 01](01-guardian-pairing-and-invitations.md), [Plan 02](02-student-photos-and-branding.md), [Plan 03](03-service-catalog-and-accounting.md), [Plan 04](04-official-documents.md) and [Plan 05](05-family-feedback-surveys.md) are `done` with non-placeholder evidence.
- [ ] Confirm all unrelated required launch capabilities recorded by Plan 00 have their owning implementation evidence; an incomplete baseline is an entry blocker, not a rehearsal pass.
- [ ] Gather migrations, client compatibility requirements, feature fixtures, native concurrency results, template samples, link configuration, provider smoke evidence and operational notes.
- [ ] Assign feature owners for failures and a release coordinator for candidate/evidence tracking.
- [ ] Confirm target environment identity, reset/restore boundaries and the permitted synthetic notification recipients before applying rehearsal data/configuration.

## Candidate and evidence interfaces

No new business API is planned here. Exercise the actual public commands, generated clients, private downloads and deployed mobile/web journeys delivered by the previous plans.

The release evidence report records:

| Field | Required evidence |
|---|---|
| Candidate identity | Backend, identity and frontend revisions; generated TypeScript/Dart versions; mobile version/build/signing environment; artifact digests where available |
| Deployment identity | Environment, application deployment IDs, applied migration state, non-secret configuration fingerprint and enabled features |
| Fixtures/recipients | Reproducible synthetic scenario IDs and controlled delivery destinations without storing credentials or private response content |
| Verification | Exact commands, results, test timestamps, native database version, real device/OS/build coverage and renderer/provider observations |
| Business reconciliation | Account/charge/entry agreement, issuance identity/number history and safe survey denominator/suppression results |
| Visual/client evidence | Approved portrait views, actual rendered document samples, invitation/app navigation and permitted teacher/guardian results |
| Defects | Severity, affected gate, owner, fix revision and retest evidence; no silent waiver for missing required behavior |
| Operations | Migration/deployment order, minimum supported clients, monitoring/support owners, recovery instructions and exercised restoration result |

Keep credentials, signed download URLs, raw survey responses, private image bytes and secrets out of evidence logs. Use dedicated authorized synthetic artifacts for visual QA rather than telemetry copies of private payloads.

## Ordered rehearsal checklist

### 06.1 — Freeze and deploy the exact candidate

- [ ] Record exact revisions/builds of every participating component and verify generated artifacts match the server contracts.
- [ ] Build with the repository's required frozen dependency/verification workflow; deploy matching artifacts to the identified rehearsal environment.
- [ ] Apply recorded migrations and non-secret configuration in the documented order, preserving identity/backend integration and the selected in-process renderer/notification adapters.
- [ ] Verify running deployment versions, migration state, feature enablement, native-link association files and actual client signing identities against the report.
- [ ] Seed the controlled two-school scenarios through admitted tools/commands; verify unrelated non-finance records survive the disposable finance cutover.

### 06.2 — Run complete staff, guardian and teacher journeys

| Journey | Required observable result |
|---|---|
| Family onboarding | Staff issue separate codes for two guardians and multiple children; a new identity completes signup/verification and real mobile-link redemption; the correct children/school contexts appear |
| Portrait workflow | Guardian submits, staff reject with reason, guardian resubmits, staff approve; published consumers retain old portrait until approval and then update correctly |
| Finance | Staff enroll services, record deposit/payment, allocate across charges, use prior balance and perform a reversal/refund; staff and guardian balances/charges agree |
| Documents | Generate and download academic, identity, administrative, finance and operational pack examples; approved portraits/branding and immutable source facts are correct |
| Feedback | Guardians complete one slot per student/assignment; management closes, moderates and publishes; teachers receive safe aggregates/themes only |
| Cross-feature notifications | Invitation, review, document-status and survey links reach the correct authenticated resource and reauthorize at open time |

- [ ] Execute through real staff web, guardian mobile/browser acceptance, and teacher mobile interfaces instead of replacing complete journeys with direct database manipulation.
- [ ] Include returning users, zero-child users, unbound guardians, siblings, multiple guardians, multiple schools and subjects with multiple profiles.
- [ ] Run every document group, including radiation only after actual qualifying withdrawal and a deposit-only receipt that does not claim charge settlement.
- [ ] Capture actual rendered samples and check accents, long names, large class/transaction lists, fonts, pagination, branding and mobile readability.
- [ ] Run real Android/iOS cold/warm starts, verification interruption, account switch, missing-app/browser fallback and legacy invitation acceptance.

### 06.3 — Verify authorization across feature boundaries

- [ ] Repeat sensitive requests as unrelated same-school guardians, foreign-school users, unassigned teachers, limited staff and dual-profile subjects.
- [ ] Revoke/disable a guardian relationship after pairing, photo upload/submission, document issuance and survey opening. Subsequent server access and mutations must cease consistently.
- [ ] Open old notification links, pending intents and cached client screens after revocation. Clear inaccessible state on refresh/session change; caches cannot grant new server access.
- [ ] Attempt direct API/private-file access and mixed batches, not just hidden UI buttons. Counts, totals and lists must not reveal inaccessible rows.
- [ ] Verify a teacher with staff privileges cannot obtain respondents, raw answers or comments for their evaluated campaign.
- [ ] Verify small/cohort-complementary results stay suppressed in management and teacher views, including exported/published representations.
- [ ] Verify public branding never exposes stamps/signatures and generated download audiences cannot be widened through attachment IDs or template names.

### 06.4 — Rehearse failure, concurrency and recovery

- [ ] Lose responses after successful pairing and receipt/payment commits; retry through clients and prove no duplicate relationship, payment or settlement.
- [ ] Interrupt uploads and image processing; old published portraits remain intact and abandoned content is cleaned safely.
- [ ] Interrupt rendering before/after object storage and before issuance registration; retry preserves issuance identity/number and cleans orphaned artifacts.
- [ ] Repeat lifecycle jobs, expire leases and partially fail notification channels; recovery completes only unfinished work without corrupting domain state.
- [ ] Restart mobile applications during login/verification/acceptance; preserve the correct pending intent and require confirmation for the active account.
- [ ] Exercise expired/revoked links, unsupported old financial requests, provider/renderer outages and unavailable private downloads with clear client states.
- [ ] Repeat the native financial race suite against the candidate; reconcile after concurrent allocation, reversal and refund cases.
- [ ] Close/cancel surveys while submissions/reminders are in flight; enforce the server cutoff and prevent duplicate response slots or late reminders.

### 06.5 — Exercise release operations and support

- [ ] Run read-only finance reconciliation after the entire scenario and retain exact zero-difference output or resolved discrepancy evidence.
- [ ] Inspect safe operational metrics: credential failure/replay conflicts, oldest pending photo, accounting discrepancy counts, document queue/failures and survey delivery/completion/suppression behavior.
- [ ] Audit logs, provider diagnostics and crash reports for accidental token, signed-link, raw survey or private-payload disclosure.
- [ ] Exercise restoration of the disposable rehearsal environment and the documented matching application/data recovery procedure. Restored data must pass integrity and reconciliation checks.
- [ ] Record when rollback requires restoring compatible data/builds and when a corrective forward deployment is necessary; never assume old finance clients can run against the new schema.
- [ ] Validate staff support instructions for lost/revoked pairing codes, wrong accounts, rejected portraits, mistaken financial entries, failed/corrected documents and survey moderation/confidentiality.
- [ ] Record deployment order, minimum supported client versions, actual link/signing configuration, monitoring owners and recovery contacts by operational role.

### 06.6 — Close defects and produce the release evidence report

- [ ] Record each defect against the affected feature/gate and assign its owning plan/engineer. Keep unverified cases visible.
- [ ] After a fix, update candidate identity and rerun the affected automated checks plus every dependent journey. Revalidate the complete core chain against the final coordinated candidate.
- [ ] Run required backend, identity, web, generated-client, mobile and native PostgreSQL checks against the final recorded revisions; include real-device/renderer/provider evidence separately.
- [ ] Produce the release evidence report with scenario results, reconciliation, actual document samples, device coverage, corrections and tested operational procedures.
- [ ] Update any predecessor evidence affected by fixes; a reopened predecessor must regain its exit gate before closing this plan.

## Synthetic fixture and test matrix

Use two schools and explicit identifiers for owner/scoped staff, assigned/unassigned teachers, two guardians, siblings, an unrelated child, an unbound guardian, a disabled/revoked guardian and dual-profile identities. Include enough additional synthetic guardian subjects to exercise survey threshold cases below, at and above ten.

| Verification layer | Required coverage |
|---|---|
| Automated candidate checks | Architecture/type/contract/unit/integration checks required by each changed repository |
| Native PostgreSQL | Transaction, idempotency, single-use redemption, job claims and financial race evidence |
| Public API | End-to-end command/query/file authorization and deterministic recovery |
| Staff browser | Real configuration, review, billing, issuance, moderation and error flows |
| Guardian/teacher devices | Real native links, auth interruption, private images/downloads, submission and published-results views |
| Document output | All template groups with visual and source-fact assertions |
| Operations | Exact deployments, controlled deliveries, restoration, reconciliation and support walkthrough |

Do not count stub PDFs, emulator-only native-link checks, mocked provider sends or tests against an earlier revision as evidence for the corresponding real candidate behavior.

## Final exit gate

Evidence: not collected; rehearsal has not started.

- [ ] Plans 00–05 and additional required launch prerequisites have complete, current individual evidence.
- [ ] All five features are enabled and their complete school/family/teacher journeys pass.
- [ ] Cross-feature authorization, revocation, concurrency and recovery checks pass.
- [ ] Accounting reconciles exactly after normal and failure/recovery journeys.
- [ ] Real PDFs and real-device invitation/pairing links pass for the supported outputs/platforms.
- [ ] Required automated verification passes against the exact final candidate.
- [ ] No unresolved defect permits incorrect access, duplicate economic effects, lost committed data or misleading official documents; no unresolved P0/P1 issue affects a launch capability.
- [ ] The release report and operational handoff identify exact versions, environments, limitations, owners and exercised recovery procedures.
- [ ] Update this plan and its Plan 00 index row to `done` only after all gates pass.

## Final handoff

Deliver the versioned release evidence report, coordinated deployment/client compatibility instructions, support/recovery procedures, actual validation artifacts and release-readiness conclusion. Completion of Plan 05 means feature implementation is finished. Completion of this plan establishes readiness for the exact recorded v1 candidate; it does not assert that production deployment or store publication has occurred.

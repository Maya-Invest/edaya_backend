# Submitted marks, corrections, and coordinated release

This document describes the remediation contracts. The verification status and finding-by-finding evidence are in [the implementation tracker](../plans/backend-remediation.md). It does not certify a deployed environment.

## Marks sheets

An evaluation follows **Draft → Submitted**. Teachers freely edit Draft marks. Submission requires a numeric score, absence, or exemption for every student enrolled at the scheduled date (homework: due date), freezes that roster and grading configuration, and makes marks official and visible to families immediately. Absence and exemption contribute neither score nor weight; blank marks are incomplete, never zero. Activity completion remains independent.

Submitted sheets cannot return to Draft. Teachers and staff with mark-edit authority may propose selected scores, designations, and mark comments in one pending batch per evaluation. Each request stores immutable before/after values, source revisions, author, and reason. Staff with class-scoped `GRADE_VALIDATE` approve or reject the whole batch; rejection needs a reason. The author may withdraw. The author cannot review their own request across profiles, including school owners. The original submitter may review someone else's correction. `GRADE_UNLOCK` never overrides submission or published-report locks.

`submitAssessmentMarks` takes `requestId`, `assessmentId`, and `expectedRevision`. `requestAssessmentMarksCorrection` adds a reason and 1–500 `{ resultId, proposed: { score, designation, notes } }` entries. Score and notes use explicit null for absence/exemption and comment clearing. Approve/reject/withdraw correction commands take `requestId`, `correctionId`, and `expectedVersion`; rejection additionally takes a reason. Distinct logical commands use distinct IDs; replay validates complete input and current authorization. Review detail exposes individual published-mark locks and correction history; the paginated staff queue lists correction requests.

Pending requests never change official marks. Approval applies the entire batch atomically, increments only changed result revisions and the sheet revision, invalidates affected draft calculations, and notifies only affected families. Creation, rejection, and withdrawal leave official revisions unchanged. Family filtering occurs before pagination and counting. Notification identity and delayed-delivery checks use individual result revisions.

Published reports record exact source mark IDs and revisions, including absences, exemptions, transfers, and multi-period sources. Those marks become permanently immutable for everyone. Other students' marks in the same evaluation remain correctable. Draft reports expose missing submissions and pending corrections; publication blocks only when a pending request affects that student's source marks. Submission, correction decisions, and publication share the academic transaction lock.

## Offline edits

Each logical marks or comment edit receives a new request ID; retries retain the original ID and payload. Marks use `expectedRevision`; report comments use `expectedVersion`. Stale and frozen writes remain visible conflicts and require reconciliation. They must not be silently discarded or automatically rebased onto another revision. Queued report-comment commands reserve successive versions for the same report; subsequent comments queue behind those commands, and a conflict blocks further edits until reconciled. Teachers flush pending marks before submission. Submission and correction requests/decisions require an online response and never enter the mutation outbox.

## Reports

Reports retain two-decimal precision through persistence and document generation. No-score results remain distinct from zero. Subject and group sections remain present without an average so their comments survive an all-absent or all-exempt sheet; documents and apps display an em dash for no score and retain two decimals for numeric results. Placement is the enrollment effective at period end; missing or overlapping placements fail explicitly. Submitted transferred marks match curriculum subject IDs and use destination report weights.

Regeneration preserves comments using definition and section identity, including nested groups. Removing or repurposing a commented section raises a conflict until the comment is cleared or reconciled. Published snapshots are immutable. Publication is serialized by student and period and replays the journaled report ID under current authorization.

## Finance and installations

A school must configure its finance currency before financial operations. Every financial write must agree with it. Currency cannot change after financial records exist; inconsistent persisted data raises an error. Catalog edits, activation, archival, and charge corrections take explicit request IDs. A changed payload under the same ID raises `COMMAND_REPLAY_CONFLICT`; a second logical charge adjustment still violates the existing one-adjustment rule. Aging uses remaining overdue installments and a single reference date.

Push registration and logout identify `appId` and `installationId`, with provider and school/user identity validated by the server. Token rotation updates one installation. Delivery outcomes and invalid-token removal are tracked independently per installation. A successful device does not suppress another device's retry.

## Verification and release

Backend contract consistency is checked against its implementation. Backend compatibility is checked separately against the PR target or the last successful deployment contract using pinned oasdiff and behavioral regression tests. No shared release manifest or sibling source update is required.

Generate tracked backend definitions with `bun run repo generate openapi`. Web and mobile explicitly acquire one backend destination commit before generating their clients. They use that commit for their complete validation run and transfer checksummed inputs and artifacts to release jobs. See [independent release setup](ci-setup.md).

Release gates are backend `bun run repo ci qualify staging`, native PostgreSQL tests, seed integration, web `bun run verify`, mobile `melos run verify`, and the affected interactive journeys. The native runner creates and destroys its own loopback PostgreSQL cluster and never reads a project `DATABASE_URL`. Historical migration fixtures remain versioned independently of the current schema.

The separately managed reset must retire old sessions, cached school data, and pending mobile mutations. Do not choose a remote reset target or delete Identity/storage data through this implementation. Release each repository independently after its required gates, then verify submission and corrections, report publication/rendering, finance reconciliation, files/photos, family feedback, and multiple-device delivery before reopening.

Teacher aggregate endpoint proposals, SMS delivery, payment-provider integrations, subscriptions, pairing codes, and correction/reissue of published reports remain deferred.

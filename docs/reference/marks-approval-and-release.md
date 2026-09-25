# Marks approval and coordinated release

This document describes the remediation contracts. The verification status and finding-by-finding evidence are in [the implementation tracker](../plans/backend-remediation.md). It does not certify a deployed environment.

## Marks sheets

Approval belongs to an entire evaluation. Draft sheets accept marks; submission freezes the effective-date roster, marks, and grading configuration. A row must contain a numeric score, an explicit absence, or an exemption. An absent or exempt row contributes neither points nor weight. A blank row is incomplete and never becomes zero. Homework deadline compliance is a separate field and changing it preserves marks.

Submission requires a complete roster. Staff review uses class-scoped `GRADE_VALIDATE`; returning an approved sheet uses `GRADE_UNLOCK`. A reviewer must have a different identity subject from the submitter and the editors of the current marks, including when one login owns multiple profiles. Editor provenance is tracked per current mark; deleting a mark removes that provenance, while compliance-only edits do not change it. School ownership does not bypass this rule. A return requires a reason and is prohibited once a published report depends on the sheet. Activity completion remains separate from submission. An evaluation with transition history cannot be deleted, including after return to Draft and removal of its marks; ordinary and batch deletion share that retention guard.

`submitAssessmentMarks`, `approveAssessmentMarks`, and `returnAssessmentMarks` take `requestId`, `assessmentId`, and `expectedRevision`. Return additionally takes `reason`. Mark edits use that same evaluation revision. `recordAssessmentResults` performs an atomic batch of 1–500 rows with one command receipt and increments the sheet revision for every written row. Review detail and the staff review queue expose completeness, revision, state, and allowed actions.

Family queries filter unapproved marks before pagination and counting. Approval triggers family notifications; draft saves do not. Draft reports record pending approval requirements. Publication requires every applicable sheet to be approved and records the exact source IDs and revisions.

## Offline edits

Each logical marks or comment edit receives a new request ID; retries retain the original ID and payload. Marks use `expectedRevision`; report comments use `expectedVersion`. Stale and frozen writes remain visible conflicts and require reconciliation. They must not be silently discarded or automatically rebased onto another revision. Queued report-comment commands reserve successive versions for the same report; subsequent comments queue behind those commands, and a conflict blocks further edits until reconciled. Teachers flush pending marks before submission. Submission, approval, and return require an online response and never enter the mutation outbox.

## Reports

Reports retain two-decimal precision through persistence and document generation. No-score results remain distinct from zero. Subject and group sections remain present without an average so their comments survive an all-absent or all-exempt sheet; documents and apps display an em dash for no score and retain two decimals for numeric results. Placement is the enrollment effective at period end; missing or overlapping placements fail explicitly. Approved transferred marks match curriculum subject IDs and use destination report weights.

Regeneration preserves comments using definition and section identity, including nested groups. Removing or repurposing a commented section raises a conflict until the comment is cleared or reconciled. Published snapshots are immutable. Publication is serialized by student and period and replays the journaled report ID under current authorization.

## Finance and installations

A school must configure its finance currency before financial operations. Every financial write must agree with it. Currency cannot change after financial records exist; inconsistent persisted data raises an error. Catalog edits, activation, archival, and charge corrections take explicit request IDs. A changed payload under the same ID raises `COMMAND_REPLAY_CONFLICT`; a second logical charge adjustment still violates the existing one-adjustment rule. Aging uses remaining overdue installments and a single reference date.

Push registration and logout identify `appId` and `installationId`, with provider and school/user identity validated by the server. Token rotation updates one installation. Delivery outcomes and invalid-token removal are tracked independently per installation. A successful device does not suppress another device's retry.

## Verification and release

The root `release-contract.json` in backend, web, and mobile records one canonical OpenAPI fingerprint, generated-artifact hashes, and a content-addressed backend source revision. A content hash identifies the uncommitted implementation precisely; it is not presented as a Git commit. Commit the verified source and matching manifests together when preparing the release.

Regenerate with `bun repo openapi export` and `bun repo openapi generate` in the backend, refresh the web's local API-client dependency, then regenerate Dart using `EDAYA_OPENAPI_SPEC` pointing at that backend fixture. Run `python3 scripts/release-contract.py --write` in the backend only after those artifacts agree. Each repository's verification checks its local artifacts and compares sibling manifests when available. Repin after backend source changes; do not edit fingerprint values by hand.

Release gates are backend `bun repo verify --full`, native PostgreSQL tests, seed integration, web `bun run verify`, mobile `melos run verify`, and the affected interactive journeys. The native runner creates and destroys its own loopback PostgreSQL cluster and never reads a project `DATABASE_URL`. Historical migration fixtures remain versioned independently of the current schema.

The separately managed reset must retire old sessions, cached school data, and pending mobile mutations. Do not choose a remote reset target or delete Identity/storage data through this implementation. Deploy backend and clients together, then verify approval, report publication/rendering, finance reconciliation, files/photos, family feedback, and multiple-device delivery before reopening.

Teacher aggregate endpoint proposals, SMS delivery, payment-provider integrations, subscriptions, pairing codes, and correction/reissue of published reports remain deferred.

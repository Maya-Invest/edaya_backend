# Plan 02 — Student photos and school branding

| Field | Value |
|---|---|
| Status | planned |
| Created / updated | 2026-09-13 |
| Target | Existing backend, staff webapp and guardian mobile app; published-photo consumers in all clients |
| Owner | Assign when implementation starts |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 01 — Pairing and invitations](01-guardian-pairing-and-invitations.md), complete with evidence |
| Next | [Plan 03 — Catalog and accounting](03-service-catalog-and-accounting.md) |

## Outcome and boundaries

Guardians propose student portraits and staff approve or reject them. The current published portrait remains visible until a replacement is approved. School branding and restricted issuance assets become available to the later document pack.

Reuse shared private uploads/downloads and notifications. Keep upload readiness separate from review state. Do not make all guardian attachments configurable, turn the student header into the review surface, or introduce a generic approval engine.

## Entry prerequisites and source anchors

- [ ] Verify Plans 00 and 01 are `done`, including private-file purpose restrictions and current relationship enforcement.
- [ ] Inspect every existing student portrait write and read consumer before adding moderation, including profile commands, roster/switcher projections, seeds and document payloads.
- [ ] Confirm the existing staff camera publication path and reusable guardian camera/gallery behavior.

Start with [staff photo upload](../../../../edaya_frontend/apps/webapp/src/lib/api/profile-photo-upload.ts), [photo mutations](../../../../edaya_frontend/apps/webapp/src/lib/api/mutations/profile-photo.mutations.ts), [student workflows](../../../package/domain-service/src/services/workflows/student.ts), [attachment model](../../../package/domain-core/src/domain/school/attachment.ts), and [school model](../../../package/domain-core/src/domain/school/school.ts).

## Model and public interfaces

`StudentPhotoSubmission` references the student, completed private attachment, submitter, review lifecycle/version, reviewer, review time and rejection reason. Attachment upload status remains `pending_upload/ready/failed`; review status is `pending/approved/rejected/superseded/withdrawn`. Failed uploads do not create reviewable pending submissions.

Store the approved portrait by durable attachment reference; retain `photoUrl` as a compatible private-content read projection. Never persist an expiring signed URL as the authoritative portrait. Existing published portraits remain readable until successfully replaced.

| Capability | Input / caller | Required result |
|---|---|---|
| `submitStudentPhoto` | Current linked guardian; student, completed upload and request identity | One pending submission; atomically supersede the prior pending submission |
| `withdrawStudentPhotoSubmission` | Current authorized submitter; submission/version | Withdraw pending submission without altering published portrait |
| `reviewStudentPhoto` | Authorized staff; submission/version, approve/reject, reason for rejection | Terminal review plus atomic publication on approval |
| `publishStudentPhoto` | Authorized staff; student and validated attachment | Direct publication with explicit pending-work supersession and audit |
| Photo review/status queries | Staff scope or submitter/current child relationship | Safe metadata and purpose-authorized preview; no generic unpublished photo exposure |
| School branding/settings operations | School configuration/issuance-asset authority | Versioned logos/crest and restricted stamp/signature references |

Use narrow submission/review/publication actions. Pending bytes are available to the submitter and authorized reviewers only. Other linked guardians may see a minimal pending indicator; teachers and ordinary family readers see the published portrait only.

## Ordered implementation checklist

### 02.1 — Submission lifecycle and policies

- [ ] Add submission domain, command-owned persistence, lifecycle/version constraints and a single-pending-per-student concurrency rule.
- [ ] Validate the student, current guardian relationship, upload owner/purpose and actual upload completion before accepting a submission.
- [ ] Implement submit/withdraw/review with Plan 00 idempotency, atomic audit/outbox and stable conflicts. Multiple guardians cannot create competing active pending rows.
- [ ] Require rejection reasons and expected versions; stale reviews cannot publish superseded submissions.
- [ ] Implement direct staff publication as a named command that supersedes pending work and preserves audit. Route existing student photo writes through the publication policy.
- [ ] Prevent generic student updates, attachment registration or client-selected status/purpose from bypassing review.

### 02.2 — Image processing, privacy and cleanup

- [ ] Validate actual decoded bytes against supported image types, configured byte/dimension/pixel limits and complete-upload metadata.
- [ ] Normalize orientation, strip EXIF/location metadata, and generate a bounded portrait derivative compatible with the renderer's image formats.
- [ ] Preserve correct behavior on invalid/unsupported formats and processing failure; never replace the published portrait with a failed upload.
- [ ] Apply purpose-scoped authorization to metadata lists, pending preview and private content endpoints. A known attachment ID or storage key is insufficient.
- [ ] Make cleanup reference-aware: never delete an active published portrait, a pending review asset or a retained issued-document dependency.
- [ ] Use a documented initial cleanup schedule of 24 hours for abandoned unsubmitted uploads and 30 days after rejection/withdrawal/supersession for unreferenced proposal bytes. Retain minimal review audit independently; do not purge referenced publication assets under those rules.

### 02.3 — Guardian and staff experience

- [ ] Guardian child profile: camera/gallery, permission-denied/gallery fallback, crop/rotate/preview, upload progress, submit, pending, withdraw, rejection reason and resubmit.
- [ ] Recover slow uploads and lost submission responses using the original logical request identity; do not manufacture a second proposal after an uncertain response.
- [ ] Staff dashboard: scoped review queue with pending count, age and student identity; list/count constraints must agree.
- [ ] Student Profile tab: current/proposed portrait card with large preview and review actions. Use focused approval/rejection modals under existing UI conventions.
- [ ] Refresh student/portrait state after review and direct publication. Keep the existing published image in headers, lists and switchers until the new publication commits.
- [ ] Send approval/rejection notifications only after commit to permitted recipients, with a safe navigation intent and no private image URL.

### 02.4 — School branding and issuance assets

- [ ] Extend school settings with logo/crest attachment references, issuing details and signatory metadata, maintaining asset versions for future source snapshots.
- [ ] Model school asset ownership explicitly so upload and content access are school-scoped; do not use an unrestricted generic attachment owner as an authorization shortcut.
- [ ] Public logo/crest publication requires explicit allowlisting. Stamps and signature images always use restricted issuance-asset access.
- [ ] Expose an authorized bounded-byte/version projection for the document payload assembler. A stamp/signature bitmap must not be described as cryptographic PDF signing.
- [ ] Update generated clients, fixtures and all published-photo consumers, including teacher roster and guardian switcher behavior.

## Fixtures and tests

- [ ] Fixtures: existing published portrait, no portrait, pending, approved, rejected-with-reason, superseded and withdrawn submissions; public branding and restricted stamp/signature assets.
- [ ] Validation tests: oversized/invalid/mislabeled files, decoded pixel limits, orientation and metadata removal, failed processing and abandoned-upload cleanup.
- [ ] Native persistence tests: two guardian submissions, two reviewers, staff publication versus approval, stale versions and rollback between review/publication/audit/outbox effects.
- [ ] Access tests: unlinked guardian, disabled access, revoked relation after upload, another submitter, unrelated staff, teacher preview and foreign-school attachment substitution.
- [ ] Public bypass tests: generic student/photo patch, generic attachment list/fetch/finalize, forged readiness/purpose and guessed storage identity.
- [ ] Client tests: camera permission denial, slow/retried upload, rejection/resubmission and existing image retained while pending.
- [ ] Integration assertions: roster, switcher and document asset projection never contain pending or rejected bytes/URLs; stamp/signature content never appears in public branding.

## Completion evidence and exit gate

Evidence: not collected; implementation has not started. Apply [Plan 00's verification requirements](00-common-requirements.md#fixtures-and-verification), with recorded processing samples, API/consumer versions, concurrency commands, private-file negative cases and cleanup evidence.

- [ ] Guardian submission, withdrawal and rejection recovery work in the app; staff queue and review work in the webapp.
- [ ] Exactly one pending submission per student and correct stale-review behavior are proven.
- [ ] Unpublished assets remain within review scope, and current relationship revocation is enforced.
- [ ] Approved portrait and school asset projections are available to the document plan without public private-asset URLs.
- [ ] Update this plan and its Plan 00 index row to `done` only after required evidence passes.

## Handoff to Plan 03 and Plan 04

Provide the current client/contracts baseline to [Plan 03](03-service-catalog-and-accounting.md). Record the approved portrait/branding reference and byte-loading contract for [Plan 04](04-official-documents.md), including protected issuance assets, source versions and cleanup reference rules. Document generation itself is not implemented here.

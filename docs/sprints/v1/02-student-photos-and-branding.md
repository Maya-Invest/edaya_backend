# Plan 02 — Student photos and school branding

| Field | Value |
|---|---|
| Status | on-going |
| Created / updated | 2026-09-13 / 2026-09-15 |
| Target | Existing backend, staff webapp and guardian mobile app; published-photo consumers in all clients |
| Owner | Assign when implementation starts |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 01 — Pairing and invitations](01-guardian-pairing-and-invitations.md) is on-going; pairing codes must not block this portrait slice |
| Next | [Plan 03 — Catalog and accounting](03-service-catalog-and-accounting.md) |

## Outcome and boundaries

Guardians propose student portraits and staff approve or reject them. The current published portrait remains visible until a replacement is approved. School branding and restricted issuance assets become available to the later document pack.

Reuse shared private uploads/downloads and notifications. Keep upload readiness separate from review state. Do not make all guardian attachments configurable, turn the student header into the review surface, or introduce a generic approval engine.

This slice (02.1–02.3) moderates **student** portraits only. Guardian and staff self-photos publish immediately. Server decode/EXIF/derivative work and all-image abuse moderation stay deferred. **02.4 branding is not in this slice.**

## Entry prerequisites and source anchors

- [x] Verify Plan 00 is `done` (private-file purpose hooks, command journal, cleanup). Plan 01 remains on-going and is not a blocker for student portraits.
- [x] Inspect existing student portrait write and read consumers (profile commands, roster/switcher, seeds, document payloads) before adding moderation.
- [x] Confirm the existing staff camera publication path and reusable guardian camera/gallery behavior.

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

- [x] Add submission domain, command-owned persistence, lifecycle/version constraints and a single-pending-per-student concurrency rule.
- [x] Validate the student, current guardian relationship, upload owner/purpose and actual upload completion before accepting a submission.
- [x] Implement submit/withdraw/review with Plan 00 idempotency, atomic audit/outbox and stable conflicts. Multiple guardians cannot create competing active pending rows.
- [x] Require rejection reasons and expected versions; stale reviews cannot publish superseded submissions.
- [x] Implement direct staff publication as a named command that supersedes pending work and preserves audit. Route existing student photo writes through the publication policy.
- [x] Prevent generic student updates, attachment registration or client-selected status/purpose from bypassing review.

### 02.2 — Image processing, privacy and cleanup

- [ ] Validate actual decoded bytes against supported image types, configured byte/dimension/pixel limits and complete-upload metadata. **This slice:** JPEG signature + `PROFILE_PHOTO_MAX_BYTES` (default 1 MiB) at intent and complete. Decoded dimension/pixel limits remain deferred.
- [ ] Normalize orientation, strip EXIF/location metadata, and generate a bounded portrait derivative compatible with the renderer's image formats. **Deferred** with server decode; clients crop/rotate/re-encode JPEG under the byte cap.
- [x] Preserve correct behavior on invalid/unsupported formats and processing failure; never replace the published portrait with a failed upload.
- [x] Apply purpose-scoped authorization to metadata lists, pending preview and private content endpoints. A known attachment ID or storage key is insufficient.
- [x] Make cleanup reference-aware: never delete an active published portrait, a pending review asset or a retained issued-document dependency.
- [x] Use a documented initial cleanup schedule of 24 hours for abandoned unsubmitted uploads and 30 days after rejection/withdrawal/supersession for unreferenced proposal bytes. Retain minimal review audit independently; do not purge referenced publication assets under those rules.

### 02.3 — Guardian and staff experience

- [x] Guardian child profile: camera/gallery, permission-denied/gallery fallback, crop/rotate/preview, upload progress, submit, pending, withdraw, rejection reason and resubmit.
- [x] Recover slow uploads and lost submission responses using the original logical request identity; do not manufacture a second proposal after an uncertain response.
- [x] Staff dashboard: scoped review queue with pending count, age and student identity; list/count constraints must agree.
- [x] Student Profile tab: current/proposed portrait card with large preview and review actions. Use focused approval/rejection modals under existing UI conventions.
- [x] Refresh student/portrait state after review and direct publication. Keep the existing published image in headers, lists and switchers until the new publication commits.
- [x] Send approval/rejection notifications only after commit to permitted recipients, with a safe navigation intent and no private image URL.

### 02.4 — School branding and issuance assets

- [ ] Extend school settings with logo/crest attachment references, issuing details and signatory metadata, maintaining asset versions for future source snapshots.
- [ ] Model school asset ownership explicitly so upload and content access are school-scoped; do not use an unrestricted generic attachment owner as an authorization shortcut.
- [ ] Public logo/crest publication requires explicit allowlisting. Stamps and signature images always use restricted issuance-asset access.
- [ ] Expose an authorized bounded-byte/version projection for the document payload assembler. A stamp/signature bitmap must not be described as cryptographic PDF signing.
- [ ] Update generated clients, fixtures and all published-photo consumers, including teacher roster and guardian switcher behavior.

## Fixtures and tests

- [x] Fixtures: existing published portrait, no portrait, pending, approved, rejected-with-reason, superseded and withdrawn submissions. Guardian/staff: published or none only.
- [ ] Public branding and restricted stamp/signature assets.
- [x] Validation tests: oversized/invalid/mislabeled JPEG admission and abandoned-upload cleanup.
- [ ] Decoded pixel limits, orientation and metadata removal.
- [x] Native persistence tests: two guardian submissions, staff publication versus approval, stale versions. Audit rows remain after proposal-byte cleanup.
- [x] Access tests: unlinked guardian, disabled access, co-guardian pending indicator without proposed bytes, teacher published-only preview.
- [x] Public bypass tests: generic student `photoUrl` patch, generic attachment registration of a portrait purpose.
- [x] Client tests: crop/export under 1 MiB, pending child portrait keeps the published image, guardian/staff self-photo publishes immediately, FCM student-photo intent to `/child-profile`.
- [ ] Integration assertions: document asset projection and stamp/signature public-branding isolation (Plan 04 / 02.4).

## Completion evidence and exit gate

Student-review slice (02.1–02.3) recorded 2026-09-15. Server EXIF/derivative, decoded dimension/pixel limits, and 02.4 branding remain open. Plan 02 stays `on-going`.

| Check | Result |
|---|---|
| Backend `bun run verify` | passed (2026-09-15) |
| Backend `bun run test:integration` | passed (2026-09-15) |
| Backend `bun run test:integration:native` | passed (2026-09-15) |
| Backend `bun run test:integration:seed` | in-process seed contract passed; HTTP live-identity doctor/validate tests failed because `localhost:9900` identity was not running in this session |
| Frontend `bun run verify` | passed (2026-09-15) |
| Mobile `melos run verify` | passed (2026-09-15) |
| `package/domain-service/tests/capabilities/student-photos.test.ts` | 11 passing, including lifecycle, access, bypass, JPEG cap, immediate guardian/staff publish, 24h/30d cleanup |
| Migration | `0022_student_photos.sql` (submissions, `students.photo_attachment_id`, notification template columns) |
| Clients | OpenAPI regenerated; webapp crop/export + Profile review; guardian `/child-profile` + immediate account photo |
| Browser / emulator | Not exercised in this pass (no local webapp or device session). Automated queue, mutation, and child-profile unit coverage stands in. |

- [x] Guardian submission, withdrawal and rejection recovery are implemented in the guardian app; staff queue and Profile-tab review are implemented in the webapp. Interactive browser/emulator confirmation is still outstanding.
- [x] Exactly one pending submission per student and correct stale-review behavior are proven in service tests.
- [x] Unpublished assets remain within review scope, and current relationship revocation is enforced.
- [ ] Approved portrait projection is available to Plan 04 via `loadPublishedStudentPortrait` + `photoAttachmentId`. School branding/issuance assets are not.
- [ ] Update this plan and its Plan 00 index row to `done` only after required evidence passes. **Do not mark done until 02.4 exists or the sprint is split.**

## Handoff to Plan 03 and Plan 04

Provide the current client/contracts baseline to [Plan 03](03-service-catalog-and-accounting.md).

For [Plan 04](04-official-documents.md): load a published student portrait with `loadPublishedStudentPortrait` (bytes via `loadAttachmentAsset` on `students.photoAttachmentId`). Guardian/staff photos are not document-pack inputs. Branding, stamps and signatures are still absent. Cleanup never deletes an active published student portrait or a pending review asset; unreferenced student proposals use 24h (abandoned unsubmitted) and 30d (reject/withdraw/supersede/replaced) object windows. Document generation itself is not implemented here.

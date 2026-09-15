# Plan 02 — Student photos and school branding

| Field | Value |
|---|---|
| Status | done |
| Created / updated | 2026-09-13 / 2026-09-15 |
| Target | Existing backend, staff webapp and guardian mobile app; published-photo consumers in all clients |
| Owner | Codex |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 01 — Pairing and invitations](01-guardian-pairing-and-invitations.md) is on-going; pairing codes must not block this portrait slice |
| Next | [Plan 03 — Catalog and accounting](03-service-catalog-and-accounting.md) |

## Outcome and boundaries

Guardians propose student portraits and staff approve or reject them. The current published portrait remains visible until a replacement is approved. School branding and restricted issuance assets are available to the document pack.

Reuse shared private uploads/downloads and notifications. Keep upload readiness separate from review state. Do not make all guardian attachments configurable, turn the student header into the review surface, or introduce a generic approval engine.

02.1–02.3 moderate **student** portraits only. Guardian and staff self-photos publish immediately. 02.4 adds issuing identity plus logo/crest/stamp/signature slots with an explicit public allowlist for logo and crest. Server decode/EXIF/derivative work and all-image abuse moderation stay deferred and do not block this plan.

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

- [x] Extend school settings with logo/crest attachment references, issuing details and signatory metadata, maintaining asset versions for future source snapshots.
- [x] Model school asset ownership explicitly so upload and content access are school-scoped; do not use an unrestricted generic attachment owner as an authorization shortcut.
- [x] Public logo/crest publication requires explicit allowlisting. Stamps and signature images always use restricted issuance-asset access.
- [x] Expose an authorized bounded-byte/version projection for the document payload assembler. A stamp/signature bitmap must not be described as cryptographic PDF signing.
- [x] Update generated clients, fixtures and all published-photo consumers, including teacher roster and guardian switcher behavior.

## Fixtures and tests

- [x] Fixtures: existing published portrait, no portrait, pending, approved, rejected-with-reason, superseded and withdrawn submissions. Guardian/staff: published or none only.
- [x] Public branding and restricted stamp/signature assets.
- [x] Validation tests: oversized/invalid/mislabeled JPEG admission and abandoned-upload cleanup.
- [ ] Decoded pixel limits, orientation and metadata removal. **Deferred** with 02.2 EXIF/server decode.
- [x] Native persistence tests: two guardian submissions, staff publication versus approval, stale versions. Audit rows remain after proposal-byte cleanup.
- [x] Access tests: unlinked guardian, disabled access, co-guardian pending indicator without proposed bytes, teacher published-only preview.
- [x] Public bypass tests: generic student `photoUrl` patch, generic attachment registration of a portrait purpose.
- [x] Client tests: crop/export under 1 MiB, pending child portrait keeps the published image, guardian/staff self-photo publishes immediately, FCM student-photo intent to `/child-profile`.
- [x] Integration assertions: document asset projection and stamp/signature public-branding isolation (Plan 04 / 02.4).

## Completion evidence and exit gate

Student-review slice (02.1–02.3) recorded 2026-09-15. Branding slice (02.4) recorded 2026-09-15. Server EXIF/derivative and decoded dimension/pixel limits remain deferred and do not block `done`. See [02-student-photos-and-branding.md](evidence/02-student-photos-and-branding.md).

| Check | Result |
|---|---|
| Backend `bun run verify` | passed for 02.1–02.3 (2026-09-15); 02.4 added focused unit coverage below |
| Backend `bun run test:integration` | passed (2026-09-15) |
| Backend `bun run test:integration:native` | passed (2026-09-15) |
| Backend `bun run test:integration:seed` | in-process seed contract passed; HTTP live-identity doctor/validate tests failed because `localhost:9900` identity was not running in this session |
| Frontend `bun run verify` | passed for 02.1–02.3 (2026-09-15); 02.4 settings identity/asset mapping tests pass |
| Mobile `melos run verify` | passed (2026-09-15); Dart client regenerated with `clearSchoolIssuanceAsset` |
| `package/domain-service/tests/capabilities/student-photos.test.ts` | 11 passing, including lifecycle, access, bypass, JPEG cap, immediate guardian/staff publish, 24h/30d cleanup |
| `package/domain-service/tests/capabilities/issuance-assets.test.ts` | 6 passing: issuing identity, upload/replace/clear, public allowlist isolation, snapshot retain, command-owned slots, 30-day unreferenced reserve |
| Migration | `0022_student_photos.sql`; `0024_official_documents.sql` (issuance slots); `0025_school_branding.sql` (`public_branding_purposes` + reference-aware `private_file_object_is_referenced`) |
| Clients | OpenAPI regenerated with `publicBrandingPurposes` and `clearSchoolIssuanceAsset`; staff settings edit/preview/replace/clear; SchoolSelector logo chrome |
| Browser / emulator | Portrait interactive confirmation still outstanding. Branded schooling-certificate HTML/PDF/PNG compiled from official templates + demo fixtures |

- [x] Guardian submission, withdrawal and rejection recovery are implemented in the guardian app; staff queue and Profile-tab review are implemented in the webapp. Interactive browser/emulator confirmation is still outstanding.
- [x] Exactly one pending submission per student and correct stale-review behavior are proven in service tests.
- [x] Unpublished assets remain within review scope, and current relationship revocation is enforced.
- [x] Approved portrait projection is available to Plan 04 via `loadPublishedStudentPortrait` + `photoAttachmentId`. School branding/issuance assets hydrate as bounded data URIs; stamps are not cryptographic signatures.
- [x] This plan and its Plan 00 index row are `done`. 02.2 EXIF / decoded pixel limits stay deferred.

## Handoff to Plan 03 and Plan 04

Provide the current client/contracts baseline to [Plan 03](03-service-catalog-and-accounting.md).

For [Plan 04](04-official-documents.md): load a published student portrait with `loadPublishedStudentPortrait` (bytes via `loadAttachmentAsset` on `students.photoAttachmentId`). Guardian/staff photos are not document-pack inputs. Issuing identity, allowlisted logo/crest, and restricted stamp/signature snapshots are available through `loadSchoolIssuanceAssets` / `hydrateDocumentPayload`. Cleanup never deletes an active published student portrait, a pending review asset, a current school issuance slot, or bytes still referenced by an issued-document snapshot. Unreferenced student proposals use 24h (abandoned unsubmitted) and 30d (reject/withdraw/supersede/replaced) object windows; unreferenced replaced branding uses the 30-day issuance-asset reserve.

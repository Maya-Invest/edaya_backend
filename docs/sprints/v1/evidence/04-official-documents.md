# Plan 04 — Official documents evidence

Owner: Codex. Recorded 2026-09-15. Working trees remain dirty until a coordinated commit; HEAD revisions below are the last recorded SHAs plus this issuance cutover.

Plans 00 and 03 are `done`. Plans 01 and 02 remain `on-going`. This pack is sequenced on photos migration `0022` and `loadPublishedStudentPortrait`, same as Plan 03. School issuance-asset fields (logo/crest/stamp/signature + `issuanceAssetVersion`) ship here so documents do not wait for 02.4.

## Architecture delivered

- Typed catalog in `@edaya/service` (`capabilities/documents/catalog.ts`): 18 templates, locales `fr`/`en`, PDF only, audience + issue permissions, optional/blocking asset slots.
- `DocumentAccessPolicy`: staff issue, family download of current Ready family templates, teachers only assigned-class operational PDFs. Families keep in-app logbook text; `logbook.v1` is not in the family catalog.
- Command-owned `document_issuances` + `document_number_series` (migration `0024_official_documents`). Numbers lock `document-number:${schoolId}:${kind}:${yearId}`.
- Lifecycle `requested → rendering → ready | failed`; `superseded` / `voided` / `preview`. Family lists use `isFamilyCurrent` (= Ready).
- Durable work `document.render` / `document.preview` via command outbox + post-commit nudge + cron `dispatchDocumentRender`. System actor `document-render` re-assembles with the same period/subject/teacher/staff-field filters stored on the snapshot (`assembleInputFromIssuance`).
- Renderer stays in-process `@edaya/adaptor-docs`. Payloads are byte-only data URIs. Overlay signatures do not HTTP-fetch URLs.
- `CLASS_LOGBOOK_READ` is a real read action on class subjects, sessions, matters and subjects so the system actor can re-check logbook source without inventing empty content.

`publishReportCardResult` enqueues issuance instead of `waitUntil` bulletin cache. `renderClassLogbook` aliases `requestDocumentIssuance` with `logbook.v1`. Downloads use `grantDocumentDownload` (short-lived URL); artifact IDs are not enough. Staff copy: already downloaded files cannot be remotely recalled.

## Template / version inventory

| Group | Key | Version | Numbering | Family | Teacher |
|---|---|---|---|---|---|
| A | `report-card.v1` | 1.2.0 | bulletin | yes | no |
| A | `logbook.v1` | 1.0.0 | — | no | yes |
| B | `schooling-certificate.v1` | 1.0.0 | schooling-certificate | yes | no |
| B | `enrollment-record.v1` | 1.0.0 | enrollment-record | yes | no |
| B | `student-id-card.v1` | 1.0.0 | — | yes (portrait blocking) | no |
| C | `invoice.v1` | 1.0.0 | invoice | yes | no |
| C | `receipt.v1` | 1.0.0 | receipt | yes | no |
| C | `settlement-quittance.v1` | 1.0.0 | settlement-quittance | yes | no |
| C | `account-statement.v1` | 1.0.0 | — | yes | no |
| C | `payment-reminder.v1` | 1.0.0 | payment-reminder | yes | no |
| D | `withdrawal-certificate.v1` | 1.0.0 | withdrawal-certificate | yes | no |
| D | `annual-transcript.v1` | 1.0.0 | annual-transcript | yes | no |
| D | `convocation.v1` | 1.0.0 | convocation | yes | no |
| E | `class-timetable.v1` | 1.0.0 | — | no | yes |
| E | `teacher-timetable.v1` | 1.0.0 | — | no | yes |
| E | `class-roster.v1` | 1.0.0 | — | no | yes |
| E | `attendance-sheet.v1` | 1.0.0 | — | no | yes |
| E | `incident-report.v1` | 1.0.0 | — | no | no (staff) |

Source IDs: report-card/transcript → result id; logbook → classGroupId (+ optional classSubjectId / academicPeriodId); certificates / fiche / radiation → enrollment id; ID card / convocation → student id; invoice / statement / reminder → `sya:${schoolId}:${studentId}:${yearId}:${currency}`; receipt / quittance → payment id; class timetable / roster → classGroupId; attendance → `${classGroupId}:${YYYY-MM-DD}`; incident → incident id.

Finance documents use Plan 03 charges/accounts/payments only. Receipts prove money received; settlement quittances identify settled obligations; account-only deposits do not claim all charges are paid. Convocation staff fields persist on the issuance snapshot.

## Clients

Staff webapp: student Documents tab (generate / retry / void / download), class students, report-card list batch, billing/payment contextual PDFs, teaching logbook export, timetable export, attendance sheet. Drawer stays read-only; mutations use `runMutation`. QA matrix includes `/school/students/[id]/documents` and class student documents.

Guardian: `/documents` by child/year plus contextual academic/finance downloads. Teacher: assigned-class logbook, timetable, roster, attendance sheet only.

Generated TypeScript (`@maya-invest/edaya-api-client`) and Dart (`packages/edaya_api_client`) include `requestDocumentIssuance`, `requestDocumentIssuanceBatch`, `grantDocumentDownload`, `listDocumentIssuances`, `listDocumentTemplates`. HTTP list bodies remain JSON arrays; GraphQL `listDocumentTemplates` has no empty input object.

Demo/demo-ci fixtures seed a ready bulletin, receipt, schooling certificate and a failed certificate for UI states. HTTP seed cannot persist Failed without a public command; in-process `saveFailedIssuance` covers that demo row.

## PDF engines (deployed limitation)

`resolvePdfRenderer` (`package/adaptor-docs/src/resolve.ts`):

| Runtime | Binding | Kind | Official Ready? |
|---|---|---|---|
| Worker | `BROWSER.quickAction` | `browser` | yes |
| Worker / local | `GOTENBERG_URL` | `gotenberg` | yes |
| Local | neither | `stub` | local only; logs that Gotenberg is unset |
| Worker | neither | unconfigured | renderer omitted; jobs fail `DOCUMENT_RENDER_UNAVAILABLE` — stub is never deployed success |

This machine: Docker daemon not running, Gotenberg `127.0.0.1:3000` unreachable, `pdftotext`/`pdftoppm` absent. Visual QA therefore used Handlebars HTML compile of all 18 templates (accents, long names, 24 extra transaction rows) under `/tmp/edaya-v1-plan04/html-samples/` plus the adaptor-docs stub PDF path. Plan 06 must inspect real Browser Run / Gotenberg pages for pagination, headers/footers, branding and portrait placement. Stamp bitmaps are not cryptographic signatures.

## Native coverage

`tooling/integration-tests/src/native/official-documents.test.ts` and logbook case in `report-card-document.test.ts`:

- concurrent numbering
- duplicate request identity + correction new number
- family Ready-only; guessed IDs denied
- mixed-audience batch omits unauthorized items
- renderer/storage outage → failed; retry after recovery → ready
- enrollment close while queued cannot become downloadable
- revoked guardian + guessed artifact
- crash after `putObject` before bind → failed, not downloadable
- unrelated teacher cannot issue family or unassigned-class documents
- logbook render releases the pool during external calls (`CLASS_LOGBOOK_READ` + snapshot `academicPeriodId`)

## Verification ledger (2026-09-15)

Logs under `/tmp/edaya-v1-plan04/`.

| Command | Outcome |
|---|---|
| Backend `bun run verify` | EXIT 0. Quality, build, unit. Representative: core 294, service 699, authorization 98, postgres 184, api 272, adaptor-docs 21, fixtures 96, seeding 72. After the logbook reassemble/`CLASS_LOGBOOK_READ` fix, package tests re-ran: core 294, service 699, adaptor-docs 21, authorization 98. |
| Backend `bun run test:integration` | EXIT 0. API 18 pass / HTTP 29 pass. |
| Backend `bun run test:integration:native` | EXIT 0. **50 pass / 0 fail** on a disposable loopback cluster. |
| Backend `bun run test:integration:seed` | Document issuances are not in the failure list. **Plan 02 residual:** 3 failures, all profile photos (`profile-photos: expected >= 59, got 8`; HTTP validate/doctor `create-profile-photo-upload` 409). Do not lower the photo target. |
| Frontend `bun run verify` | EXIT 0. Webapp 806 pass, webadmin 2, web-repo 3. |
| Mobile `melos run verify` | EXIT 0 (Command Line Tools + `/tmp/edaya-xcrun-shim`). integration_tests 6, api_client 12, auth 14, shared 34, guardian 25, teacher 42. |

## Versions / clients

| Component | Revision | Client notes |
|---|---|---|
| Backend | `0a52da3dcbf3aa9222a73562cdd84a8f063bec08` plus dirty Plan 04 working tree | Migration `0024_official_documents`; COMMAND_ONLY issuance; durable `document.render` |
| Identity | `27545d7c33ff81be8feb3cb4d53dbc5e3ac6eb79` | Unchanged for this documents cutover |
| Frontend | `67e1f09992b7b77e57ac51a080332ed1a7525a07` plus dirty working tree | Student/class Documents tab; contextual Generate; `documents.downloadRecall` |
| Mobile | `322f1f8d0fb510686761f3f1f1a2317b2b073cee` plus dirty working tree | Guardian `/documents`; teacher operational PDFs; Dart bindings regenerated |
| Generated TypeScript client | package `0.0.0` workspace source | Named document commands/queries |
| Generated Dart client | `packages/edaya_api_client` workspace source | Same public names; list queries unwrap JSON arrays |

Plans 01 and 02 remain on-going. Successful document generation is not overall release readiness; that stays Plan 06.

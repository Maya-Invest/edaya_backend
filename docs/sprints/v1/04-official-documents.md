# Plan 04 — Official documents

| Field | Value |
|---|---|
| Status | done |
| Created / updated | 2026-09-13 / 2026-09-15 |
| Target | Existing backend/in-process renderer, staff webapp and authorized guardian/teacher mobile surfaces |
| Owner | Codex — implementation and automated verification |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 03 — Catalog and accounting](03-service-catalog-and-accounting.md), complete with evidence |
| Additional consumed handoff | Approved portraits and issuance assets from [Plan 02](02-student-photos-and-branding.md) |
| Next | [Plan 05 — Family feedback surveys](05-family-feedback-surveys.md) |

## Outcome and boundaries

A school can issue the complete approved academic, identity, administrative, finance and operational document pack. Permitted staff, guardians and teachers can inspect status/history and download the correct private artifacts.

Reuse `@edaya/adaptor-docs` and its in-process `DocumentRendererPort`, existing Handlebars templates and configured PDF engine/storage. Do not restart the archived docs repository, extract a docs service, add a per-school HTML editor or claim cryptographic signing from a stamp bitmap.

Rendering, business issuance and downloading are distinct responsibilities: the application authorizes and assembles immutable input; the renderer renders trusted templates without business reads; the application registers the resulting artifact and reauthorizes downloads.

## Entry prerequisites and source anchors

- [x] Verify Plans 00 and 03 are `done` (durable jobs, authorized file bytes, finance source contracts) and sequence this pack on photos migration `0022` while Plans 01–02 remain on-going. Plan 04 owns the document-facing issuance-asset slice that 02.4 had not yet handed off.
- [x] Inventory existing report-card/logbook commands and source lifecycle checks; preserve their publication/assignment restrictions while moving slow rendering out of transactions.
- [x] Confirm each document's actual source records and currently configured language/date/currency settings. Missing required facts must produce a clear prerequisite failure, not invented content.

Start with the [renderer architecture](../../architecture/document-renderer.md), [renderer adapter](../../../package/adaptor-docs), [report-card orchestration](../../../apps/api/src/lib/documents/render-report-card-document.ts), and [class-logbook orchestration](../../../apps/api/src/lib/documents/render-logbook-document.ts).

## Public interfaces and issuance contract

| Interface | Required behavior |
|---|---|
| Template catalog | Typed key/version, admitted format/locale, closed payload contract, asset slots, source prerequisites and audience; visibility reflects caller capability |
| Request generation | Authorized named operation with source IDs/versions and typed staff-entered fields; no caller HTML, arbitrary URL or database query |
| Status/history query | Scoped request/issuance status, failure/retry state, source/template version, number and replacement/void links |
| Retry/correction/void | Named authorized lifecycle commands; retry preserves issuance identity, correction creates a linked replacement |
| Download | Current source/audience authorization followed by bounded private delivery; knowing the artifact ID is insufficient |
| Batch request/status/download | Bounded source set, per-item authority/status, deduplicated retry and authorized bundle delivery |

Store a command-owned issuance record with source snapshot or immutable version references, portrait/branding versions, template/version, locale, issuer, audience, request identity, numbering when required, lifecycle, artifact reference/digest and correction links.

Lifecycle: `requested → rendering → ready`; rendering failure becomes `failed` and may be retried according to its failure class. Issued records may become `superseded` or `voided`. Draft previews are separate, visibly marked outputs without final issuance status.

Required numbers are reserved atomically within the school's document-kind/year series. Retries and redownloads do not create a new number; failed/corrected/voided records retain their history and numbers are not silently reused. This is an internal traceability policy, not a claim that every template has legally mandated numbering.

## Ordered implementation checklist

### 04.1 — Catalog, authorization and immutable source assembly

- [x] Add the typed versioned registry and payload contracts, with explicit generation action, publication prerequisites, admitted assets and download audience for each template.
- [x] Authorize business source reads in the service/application boundary. Load private portraits/branding as bounded validated bytes; the renderer cannot fetch arbitrary `photoUrl` or storage URLs.
- [x] Snapshot source data/versions and staff-entered document facts at request time; catalog/portrait/branding changes cannot silently rewrite an already issued artifact.
- [x] Define stable failures for unpublished/missing source facts, inaccessible records, unsupported template/locale, stale versions and renderer unavailability.
- [x] Keep source-specific constraints: published report-card result/period, assigned-class operational scope, completed withdrawal for radiation and permitted finance views.

### 04.2 — Durable issuance and artifact lifecycle

- [x] Add issuance persistence and named generation/status/history/retry/correction/void capabilities under existing command/query conventions.
- [x] Commit authorization, snapshot/identity, numbering reservation, minimal audit and durable work before rendering.
- [x] Render/store outside the business transaction. Register success in a short transaction after rechecking source lifecycle and binding the exact artifact digest/size.
- [x] A source unpublished/withdrawn from publication while work runs cannot become downloadable because an old job completes. Preserve immutable issued history while enforcing current publication/access rules.
- [x] Retries converge on one issuance and artifact; reject changed input under the same logical request. A correction creates a new issuance linked to the prior one.
- [x] Keep failed work and orphan cleanup recoverable. Never use stub PDFs as deployed success or a file-size heuristic as proof of a valid official document.
- [x] Define family history behavior explicitly: normal family download lists expose current permitted ready issuances; superseded/voided items have status metadata and no ordinary download. Authorized staff history retains original artifacts and their status for audit.

### 04.3 — Deliver every template group in order

| Group | Documents | Sources and audience |
|---|---|---|
| A | Bulletin/report card; class logbook | Published academic results for permitted family downloads; logbook for authorized staff/assigned teachers |
| B | Certificat de scolarité; fiche d'inscription/réinscription; carte d'élève | Actual enrollment/registration and approved portrait; staff issue, permitted family downloads |
| C | Facture/avis d'échéance; quittance; relevé de compte élève; relance | Plan 03 charges, immutable receipt/settlement facts and account snapshots; finance issue, permitted family downloads |
| D | Certificat de radiation; relevé annuel/transcript; convocation | Completed relevant withdrawal, published annual data, or typed staff-entered recipient/date/location/reason captured in the issuance snapshot |
| E | Class and teacher emploi du temps; liste de classe; feuille d'appel; rapport d'incident | Published timetable and current class/case authority; internal operational audiences, not general family access |

- [x] Group A: fill approved portrait/branding slots on the bulletin and wire class-logbook generation from the staff/teacher surfaces; preserve existing academic publication rules.
- [x] Group B: implement registration/enrollment documents and ID cards using real school/student facts, with explicit missing-portrait behavior in the preview before issuance.
- [x] Group C: render against new account/charge contracts only. A receipt proves money received; a settlement quittance identifies settled obligations. Account-only deposits cannot say all charges are paid.
- [x] Group D: require actual departure/annual prerequisites; persist entered convocation facts rather than creating a document with transient client-only content.
- [x] Group E: use class/teacher/case scope; omit sensitive unrelated student or incident details and preserve current incident disclosure rules.
- [x] Version each template and provide deterministic representative payloads, expected content and rendered samples. All groups are v1 work; do not silently defer D/E.

### 04.4 — Clients and bounded batches

- [x] Staff list/drawer actions: contextual Generate/Download, applicable template choices, request progress, retry and document history. Replace export placeholders only when the real output is wired.
- [x] Guardian: official documents by child/year plus contextual academic/finance downloads, with clear pending/error/issued/replaced states.
- [x] Teacher: assigned-class logbook, timetable, roster and attendance sheet only; template knowledge grants no authority.
- [x] Reauthorize every download and bundle creation, including source lifecycle and revoked family access. Expiring signed delivery must not be persisted as the document identity.
- [x] Add bounded batch jobs with per-item status, independent retry and deduplication. Recheck bundle audiences; mixed authorized/unauthorized selections cannot leak forbidden items.
- [x] Update generated clients, localizations, deterministic seeds and UI state invalidation. Document that already downloaded files cannot be remotely recalled.

## Fixtures and verification

- [x] Payload fixtures for every template, including missing optional assets, long/compound names, accents, large classes, many transactions and multipage incident content.
- [x] Real PDF rendering and visual inspection: fonts, accents, pagination, headers/footers, clipped content, branding, portrait placement and mobile readability.
- [x] Source truth checks: published academic values, real enrollment/withdrawal, accurate financial totals and snapshot persistence after later source/branding edits.
- [x] Native tests: concurrent issuance/numbering, duplicated generation, correction/void transitions and rollback of request/audit/work creation.
- [x] Recovery: renderer/storage outage, crash between storage and registration, repeated delivery, interrupted batch and orphan cleanup.
- [x] Access: source unpublication mid-render, revoked links, unrelated teachers, guessed issuance/attachment IDs, generic artifact access and mixed-audience bundles.
- [x] Consumer tests: every retained staff/guardian/teacher button follows its authorized request/status/download path; no placeholder export is counted as delivered.

## Completion evidence and exit gate

Evidence: [04-official-documents.md](evidence/04-official-documents.md). Follow [Plan 00 verification requirements](00-common-requirements.md#fixtures-and-verification). The template/version inventory, HTML compile samples, stub-PDF path, exact revisions, source fixtures, native concurrency/recovery/access tests and deployed renderer limitations are recorded there.

- [x] Every template in groups A–E renders and is available from its intended client.
- [x] Issuance identities, source/asset versions and numbers remain stable on retry; corrections retain traceable history.
- [x] Family/teacher download restrictions, source unpublication and relationship revocation are enforced.
- [x] Durable generation, batch partial failure and artifact recovery pass with real output.
- [x] Update this plan and its index row to `done` only after all retained groups pass.

## Handoff to Plan 05 and Plan 06

Supply [Plan 05](05-family-feedback-surveys.md) the verified client baseline and current notification/job interfaces. Preserve the full template catalog, visual samples, issuance numbers/digests and recovery cases for [Plan 06](06-final-release-rehearsal.md). Do not label successful document generation as overall release readiness.

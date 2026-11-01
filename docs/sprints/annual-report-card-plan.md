# Annual report card implementation

Status: implemented and verified locally  
Updated: 2026-10-04  
Scope: backend, staff webapp, generated web/mobile contracts, guardian document downloads

## Approved presentation

`annual-report-card.v1` is a separate official academic document titled **Bulletin annuel / Annual report card**. Existing annual transcript documents and issuance history remain available.

The template consistently uses A4 landscape and the ordinary report card's 8 pt table text. It preserves the crest/ministry header, school identity, colors, student information and optional portrait. Its columns are subject, chronological period averages, annual average, coefficient, annual total, annual rank, appreciation and teacher. Annual groups, shaded subtotals and overall totals remain visible.

Annual attendance, average/rank and class-result cards follow the table, together with a compact period-average recap and a period-weight note. Council appreciation, homeroom teacher, principal stamp/signature and footer remain together. Continuation pages repeat compact student/class/year identification and table headings. Longer reports use multiple pages without reducing the table font.

## Completed implementation

- [x] Register the new document type, template catalog, assembly, renderer and generated web/mobile contracts.
- [x] Anchor issuance to the explicitly selected published annual `report_cards` aggregate, its configured source periods and weights.
- [x] Match canonical subjects across changed class-subject records and recursively nested sections; preserve zero and show unavailable values as an em dash.
- [x] Read period and annual grades from their published results. Compute annual weighted totals in the application using the ordinary report-card rules. Annual teacher names use annual class assignments.
- [x] Record opaque academic fingerprints for the annual result and each contributor. Require published, current results and periods; reject missing, ambiguous, nested synthesis or overlapping sources and incompatible school-year/grading contexts.
- [x] Revalidate contributors during issuance, rendering, artifact binding and private download. Reject stale calculations and pending academic changes. Changed sources require regeneration, review and republication before replacement.
- [x] Reuse private rendering, retries, linked replacements and document history. Reviewed annual council feedback keeps the previous PDF available until its replacement renders successfully.
- [x] Add the annual action to both student Report card and Documents views, with explicit target, definition, source periods, weights, readiness, grade review, normal publication and issuance using the actual result ID.
- [x] Reuse the guardian child/year Documents list and private download grant, including current family-access checks.
- [x] Add dedicated academic sample fixtures and replace the annual transcript sample's financial rows with academic period averages.

Source provenance fits the existing aggregation and issuance snapshot JSON fields; no database migration is required for this feature. Delivery uses existing document downloads. Email distribution and class batch issuance are outside this change.

## Verification

The [PDF evidence](v1/evidence/annual-report-card/README.md) contains French and English two-semester, three-trimester and long-subject multipage reports, plus their source payloads. All 21 pages were visually reviewed. Extracted PDF grades, annual totals, coefficients, landscape dimensions and repeated student/year identification were checked against the fixtures. Ordinary and annual branded examples were compared for their header, student block, table treatment, summaries and council/signature presentation.

Targeted backend payload, aggregation, ordinary-report, correction and annual workflow tests pass. Real-browser annual rendering verifies staff issuance, private storage, the guardian Documents list and download, followed by rejection after family access is revoked. Other tests cover source changes, unpublished/pending contributors, changes during rendering, retries, regeneration/republication and replacements.

The renderer suite, backend repository checks, web type checks/build/unit tests, mobile `melos run verify`, and cross-repository release-contract checks pass. Existing unrelated workspace work is preserved. These are local verification results; the feature has not been deployed.

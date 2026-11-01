# Annual report card verification evidence

Verified locally on 2026-10-04. These fictional academic fixtures are generated through the production template and browser PDF renderer.

| Case | French PDF | English PDF | Period weights | Pages FR / EN |
|---|---|---|---|---|
| Three trimesters | [French](trimesters-fr.pdf) | [English](trimesters-en.pdf) | 1, 1, 1 | 2 / 2 |
| Two semesters, zero and unavailable grades | [French](semesters-fr.pdf) | [English](semesters-en.pdf) | 1, 3 | 2 / 2 |
| Forty long subject names, zero and unavailable grades | [French](multipage-fr.pdf) | [English](multipage-en.pdf) | 1, 2, 3 | 7 / 6 |

Each PDF has a matching `.json` payload. [The generator](../../../../../package/adaptor-docs/scripts/write-annual-report-card-evidence.ts) contains the source grade matrices and uses weighted available averages, rounds annual grades to two decimals, and calculates annual subject totals from the annual coefficient. Subtotal totals use the rounded group average and coefficient; overall totals sum subject totals without counting groups twice. Annual ranks/class statistics use the sample cohort distribution from the dedicated academic fixture.

All 21 annual pages were rendered to images and reviewed: no clipped subject names, overlapping content or split council/signature blocks. The table stays at the ordinary report card's 8 pt font, uses A4 landscape, and repeats its headings and student/class/year identification. PDF text extraction also checked every displayed period/annual grade, coefficient and total against its payload, including zero and em-dash cells.

Compare [ordinary report card](../branded-samples/report-card.v1.pdf) with [branded annual report card](../branded-samples/annual-report-card.v1.pdf). Both use the same visual treatment for branding, student details, tables, summary cards and council/signature areas. The annual report expands the table across landscape pages. The [corrected annual transcript](../branded-samples/annual-transcript.v1.pdf) now contains academic period averages.

## Automated verification

- Backend: 37 targeted tests across annual payload, aggregation, annual workflow, ordinary payload, teacher corrections and annual presentation. The annual workflow covers contributor validity, render-time changes, immutable snapshots, retries, regeneration/republication, replacements, council feedback and revoked guardian access.
- Real PDF workflow: `ANNUAL_REPORT_CARD_REAL_PDF=1 bun test package/domain-service/tests/services/workflows/annual-report-card.test.ts -t 'published weighted annual grades'` verifies annual issuance and guardian listing/download with actual browser-produced PDF bytes.
- Renderer: all 30 tests pass, including browser rendering, schemas, ordinary templates and forced annual landscape.
- Web: Svelte/TypeScript checks, production build and unit suite pass; annual readiness checks cover bounded queries and selected-period validity.
- Mobile: `dart run melos run verify` passes analysis, tests, generated API, contract, brand and script checks.
- Backend/web repository checks and backend/web/mobile release contracts pass after regeneration of generated clients.

Reproduce the six samples from the backend root with `bun package/adaptor-docs/scripts/write-annual-report-card-evidence.ts`. Rendering needs the configured local Chrome/Chromium PDF renderer. Existing download delivery is used; no email distribution is added.

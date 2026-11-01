# School intake implementation validation

Validated on 2026-10-20. Scope and field accounting are recorded in the [implementation tracker](../sprints/school-data-model-plan.md) and [coverage matrix](staff-field-coverage.md).

> Historical validation record: the manual onboarding discipline mappings described below have been superseded by [versioned onboarding datasets](../../tooling/fixtures/README.md#versioned-onboarding-dataset). Current provisioning initializes dataset-owned disciplines and categories; existing-school migration remains outside onboarding. The dated results below do not qualify subsequent changes.

## Candidate and client identity

Web and mobile clients were formally generated from the same clean, immutable local backend snapshot:

- Backend candidate: `b507abacdc47ed5f1e5fdd6face8af78ee199020`.
- OpenAPI fingerprint: `c7430069108a7aaffd99ffadf6e23aa0f54ac50cdfc240a60c124cd18b29b258`.
- Candidate location: `/private/tmp/edaya-school-intake-candidate-20261020`.
- Both consumers' `.generated/client.json` record that commit and fingerprint.

The candidate contains the backend application, migration, fixtures and tests. Its source matched the live backend working tree before this final documentation update. It was created solely for clean client acquisition; the application repositories were not committed or deployed by this task.

## Automated results

| Gate | Result |
| --- | --- |
| Backend `bun run repo ci qualify staging` | Pass: verification, integration, released-client compatibility and Worker dry-run packaging |
| Core / service / Postgres adapter / API | 328 / 915 / 220 / 396 tests pass; zero failures |
| Populated additive migration and intake workflow regressions | Pass |
| Historical typed-grants migration with current repository | 15 tests pass |
| Standalone native Postgres integration | 70 tests pass, zero failures |
| Standalone HTTP seed integration | 10 tests pass, zero failures |
| HTTP integration in final qualification | 60 tests pass, zero failures |
| Released-client compatibility | 12 tests pass, zero failures |
| Frontend `bun run verify` after final source changes | Pass: lint, Svelte/TypeScript checks, specifications, tests and builds |
| Mobile `melos run verify` | Pass |
| Mobile `repo ci integration` against final candidate | API, guardian and teacher pass |
| Patch whitespace checks | Pass |

Regression coverage includes same-school references, duplicate catalogue codes and declarations, inactive references, guarded deletion, scoped option reads, portal denial, annual uniqueness/concurrent upserts, year independence, transfers, omitted/null/false/zero semantics, compound names and extra contacts, all attendance review anchors, selected authorized CSV keys, lazy batched sensitive reads, stale response isolation and browser preference isolation.

The final qualifier exited zero and recorded `verification: true`, `integration: true` and `compatibility: true` in `.ci-evidence/qualification.json`. It qualified the backend working tree at repository HEAD `d4068deb97d2a7dc4850587f71f013b1bffc5a15`; the clean client-acquisition snapshot above contains the same application, schema and test source. Qualification is local evidence, not a deployment or a committed release.

The legacy typed-grants migration test now applies subsequent schema migrations before exercising the current repository. Assertions about the historical grant conversion remain unchanged. Synthetic onboarding and curriculum fixtures provide explicit reviewed discipline mappings rather than deriving mappings from names.

## Browser evidence

Used an isolated local Identity/School API and a disposable seeded database, with no production data. The local fixture and browser tab were stopped after validation.

| Scenario | Observed result |
| --- | --- |
| Academic discipline catalogue | Created an explicit synthetic entry; edited its name; code remained disabled in edit mode |
| Columns selector | Search, grouped options, mandatory identity, hide/reset and aligned row/header changes passed |
| Browser persistence | Selected student columns restored after reload |
| Narrow viewport | Table content scrolls horizontally within its container; identity/actions remain usable |
| Annual student profile | Saved false then true; detail and selected list column retained the value and refreshed |
| Person profile | First open succeeded; compound canonical names, surrounding original-name spaces and `000077` national matricule survived save/reload/reopen |
| All-matching CSV | Download parsed successfully: 30 data rows, eight selected headers, uniform row width; saved matricule and annual status retained |
| Filtered CSV | Name filter produced one data row with the same eight selected headers |

The first CSV attempt timed out while a verification build triggered Vite page reloads. After reloading the settled local app, both full and filtered downloads passed. No export workaround or test-only application logic was introduced.

Screenshots and metadata are in the frontend `docs/reference/design-review/` gallery:

- `current/academic-disciplines-desktop-fr.png`
- `current/student-annual-columns-desktop-fr.png`
- `current/student-intake-profile-desktop-fr.png`
- `current/table-columns-desktop-fr.png`
- `current/table-columns-phone-fr.png`

The two table preview captures use the real shared component with fictional values on `/__design`. The other captures show the production routes backed by the disposable fixture. Browser checks cover these scenarios; they are not a claim that every matrix row was manually exercised.

## Supported boundaries

- Migration `0046_school_intake_profiles.sql` is additive and was exercised only against test databases. Deployment and live migration remain release work.
- Production catalogues start empty. Legacy subjects display Not configured until reviewed; template onboarding requires explicit discipline mappings.
- Assessment attachments expose the model's name/size metadata. The existing model does not contain attachment bytes or download URLs.
- Attendance exposes available latest review/correction metadata. The current model does not provide an append-only review history.
- Teacher signatures, restricted feedback, credentials, platform administration and deferred resource booking retain the exclusions and ownership rules in the coverage matrix.
- Source correction, workbook preparation and actual ingestion remain outside this implementation.

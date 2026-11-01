# School intake model and staff UI implementation

Updated 2026-10-20 against the approved implementation scope. This tracker supersedes the earlier free-text placement/discipline proposal.

## Delivered in the working tree

- Additive person fields: student national matricule; original supplied names for students, guardians and teachers; guardian occupation. Canonical name components remain separate.
- School-wide academic-discipline and placement-status catalogues with immutable, school-unique codes, active state and guarded deletion. Discipline options are shared by subjects and teacher declarations; no inferred mappings or teaching permissions.
- Student and teacher annual profiles with school/person/year uniqueness, scoped reads, atomic upsert/removal, explicit null clearing, false/zero retention and parent deletion safeguards. Profiles survive transfers and do not copy into another year.
- New subjects require an active discipline. Unmapped legacy subjects allow unrelated edits and display Not configured. Existing inactive references remain readable.
- Column-driven shared tables with fixed ordering, mandatory identity/actions, searchable column checklist, defaults/reset, horizontal scrolling, hidden-sort indication and versioned browser preferences isolated by user/school/list.
- Expanded people-list identity, annual, contact, relationship, assignment, availability, access and authorized health fields. Optional data is batched by loaded IDs; sensitive groups require selection and read authority. People CSVs follow selected authorized columns and matching filters.
- Shared person fields and guardian contact/relationship editors. Additional contacts, relationship rights/restrictions, arbitrary health text and graduated students survive unrelated edits.
- Health emergency/last-visit controls; note title/visibility; enrollment history and existing completion/progression commands; assignment responsibility/effective dates/end state; permission validity controls retaining access previews.
- Subject identity/options and existing class offerings; recurring/one-off schedules and all supported weekdays; attendance justification review across daily, lesson, activity and assessment occurrences, including review/correction metadata.
- Fee descriptions and billing terms/installments, financial reasons/reversal references, assessment attachment information and completion action, report publication history, school scheduling settings, and incident participant/sanction information.
- Explicit synthetic catalogues in demonstration/integration fixtures. These do not seed or infer production-school configuration.

## Evidence and qualification

The [field-coverage matrix](../reference/staff-field-coverage.md) accounts for 1,459 field paths across 66 core entities and eight specialized communication, feedback and correction models. It records source evidence, editor/workflow or read-only display, permissions and deliberate exclusions. This is a source audit; individual browser scenarios are recorded separately in the [validation report](../reference/school-intake-validation.md).

Backend full qualification passed verification, HTTP/seed/native integration, released-client compatibility and Worker dry-run packaging. Unit suites include 915 service, 220 Postgres adapter, 328 core and 396 API tests, all passing. HTTP integration passed 60 tests, seed integration passed 10, native integration passed 70 and released-client compatibility passed 12.

Web verification passed after the final source changes. Mobile verification and API/guardian/teacher integration passed with generated clients from the same clean backend candidate, `b507abacdc47ed5f1e5fdd6face8af78ee199020`. The validation report records candidate identity, commands, results and supported model boundaries.

Browser checks against disposable seeded data verified catalogue editing, immutable codes, column search/hiding/reset/persistence, aligned headers/cells, phone horizontal scrolling, canonical compound-name and original-name preservation, leading-zero matricules, annual false/true persistence and live list refresh. CSV downloads contained all 30 matching rows and exactly the eight selected columns; applying a name filter produced one matching row with the same columns.

No production data was imported, no live database migration was applied and no deployment was performed. Existing subjects require reviewed catalogue mappings. Source correction and import preparation remain separate.

## Stable import handoff destinations

| Prepared fact | Destination |
| --- | --- |
| School / national matricules | `Student.matricule` / `Student.nationalMatricule` |
| Original name | Person `sourceFullName`, alongside canonical first/last names |
| Parent/correspondent occupation | `Guardian.occupation` |
| Placement / repeating | `StudentAcademicYearProfile.placementStatusId` / nullable `isRepeating` |
| Discipline catalogue | `AcademicDiscipline` under Other configurations |
| Subject discipline | `Subject.disciplineId` |
| Teacher discipline/hours | `TeacherAcademicYearProfile.disciplineIds`, `declaredHours`, `hoursPeriod`, `hoursPeriodLabel` |

Annual profiles use named upsert/removal commands. Catalogue IDs must be resolved from reviewed school configuration; source codes and subject names do not create mappings automatically. Source correction, workbook preparation, provenance, identity matching and the actual import pipeline remain separate work.

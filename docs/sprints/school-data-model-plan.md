# School intake: application model implementation plan

Status: **planned — implementation not started**

Date: 2026-10-19

Scope: backend domain, persistence, authorization and API; staff webapp; generated web/mobile contracts and regression checks.

Basis: [Cousteau ingestion gap report](../../../audits/school-ingestion-2026-10-19/REPORT.md), findings G04–G07, G09 and G12; conditional curriculum findings G13/G14.

## Outcome and scope

Make the application able to create, retain, display and edit the currently unsupported school facts before extending the import process. Completion means these facts work through the normal application and API, including reloads, unrelated edits, class transfers and academic-year changes. A database migration alone is insufficient.

The confirmed work is: a second student identifier, annual student placement/repeating information, guardian occupation, and annual teacher disciplines/declared hours. Preserve original supplied names as an additive field; changing the required first/last-name contract remains conditional.

This phase does not prepare import files, correct school data, build import batches/crosswalks/retries, import records, or add native `.xls` support. The accidental duplicate file is excluded. Birthplace, nationality, guardian relationships, multiple contact methods and optional subjects already have domain destinations; carrying them through imports belongs to the next phase.

The design below is the proposed implementation baseline. School explanations of AFF/NAFF/CS and the teacher hour period can arrive later because the model can retain an uninterpreted code and an unspecified period. Full ingestion still depends on the separate source and import work.

## 1. Model decisions

### Existing person profiles

| Entity | Addition | Contract and behavior |
| --- | --- | --- |
| `Student` | `nationalMatricule?: string` | Separate from the existing school `matricule`. Store as text; trim surrounding whitespace, preserve punctuation, internal spaces and leading zeros. No national-format assumption, numeric conversion, automatic identity merge, or uniqueness constraint in this release. |
| `Guardian` | `occupation?: string` | Optional free text on the person. A shared guardian has one current occupation across their student links. Preserve entered text; interpreting source placeholders such as RAS/NEANT belongs to import preparation. |
| `Student`, `Guardian`, `Teacher` | `sourceFullName?: string` | Optional original supplied name, preserving order, spelling and internal spacing. Retain it independently of corrected first/last names. Existing canonical name components, display names and account identities continue to work. |

Use the existing optional-field convention: nullable database column; accept explicit `null` to clear through a mutation; optional/undefined in parsed domain data. An omitted mutation property must preserve the saved value. Reject whitespace-only supplied text; forms send `null` when clearing an optional text field. `sourceFullName` must retain the supplied string, including surrounding whitespace if present, while validating that it contains a non-whitespace character.

A dedicated national field is sufficient for the single additional identifier in this submission. Multiple identifier schemes, verification states, issuer registries and authoritative deduplication are outside this baseline. The new value is school-record information, not proof of verified identity. Original cell values and normalization history will remain in the future ingestion provenance store; this field does not replace that store.

### New `StudentAcademicYearProfile`

One record per school, student and academic year, independently of class enrollment.

| Field | Type / rule |
| --- | --- |
| `id`, `schoolId`, `studentId`, `academicYearId` | Required IDs. The person and year must belong to the same school. Person/year identity is immutable after creation. |
| `placementStatusCode` | Optional text. Accept AFF, NAFF, CS and other nonblank school codes without inventing their meanings. Preserve the code; no funding, billing or entitlement effects. |
| `isRepeating` | Optional boolean: true, false or unknown. Unknown must not default to false. |
| `createdAt`, `updatedAt` | Server-managed timestamps; creation timestamp retained on updates. |

Create a database unique constraint on `(schoolId, studentId, academicYearId)`. Add indexes for school/year listing and person/year lookup, coordinated with the existing performance-index definitions.

The profile may exist before enrollment. A transfer between classes in the same year continues to reference the same facts. Opening a new academic year creates no profile automatically and copies no previous placement/repeating value. Corrections explicitly target their year, including an earlier year under the normal authorized write path.

`Student.status` remains the lifecycle status. Enrollment status and `progressionDecision=retained` retain their existing meanings. Setting `isRepeating=true` must not create a prior enrollment, close an enrollment, record a council decision or promote a student.

### New `TeacherAcademicYearProfile`

One record per school, teacher and academic year. This describes what the school declares, independently of actual class assignments.

| Field | Type / rule |
| --- | --- |
| `id`, `schoolId`, `teacherId`, `academicYearId` | Required IDs with same-school validation and immutable person/year identity. |
| `disciplines` | Array of nonblank text labels, stored as JSONB. Trim surrounding whitespace and remove exact duplicate labels. An empty array means no declaration recorded. Do not automatically split combined labels or turn them into grade/year `Subject` IDs. |
| `declaredHours` | Optional finite, nonnegative number; fractional hours supported. Database numeric column with explicit adapter conversion. Missing is unknown; explicit zero remains zero. |
| `hoursPeriod` | `unspecified`, `week`, `month`, `term`, `academic_year` or `other`; defaults to `unspecified`. |
| `hoursPeriodLabel` | Required nonblank text only when period is `other`; reject a conflicting label for the other enum values. |
| `createdAt`, `updatedAt` | Server-managed timestamps. |

Create a database unique constraint on `(schoolId, teacherId, academicYearId)` and matching school/year and person/year lookup indexes. Register cross-field validation in both create and update commands after merging the saved record and patch.

Hours are the teacher's declared total for that period across the listed disciplines, not a separate value per discipline. A numeric value with `hoursPeriod=unspecified` is valid. The application must not label it weekly, use it as timetable capacity, or aggregate it with values with a different period. The two source dashes can become unknown hours in the later import phase.

Neither disciplines nor hours create `TeacherAssignment` records, confer access to classes, change payroll, or modify the timetable. `Teacher.subjectId` remains the account identity link. Year rollover does not copy this profile automatically.

## 2. Backend behavior and contracts

### Persistence and domain wiring

- [ ] Add the scalar fields to schemas, data/input types, getters, constructors and copy/update paths. In particular, extend the explicit `Student.copyWith` field list and both directions of the custom guardian Postgres mapper.
- [ ] Add both annual domain entities, repository ports and stores; register them in core entity maps/exports, authorization repositories, service entity/workflow catalogs, Postgres schema exports and repository assembly.
- [ ] Generate additive migrations: nullable person columns, two empty annual tables, annual uniqueness constraints and query indexes. Keep existing person IDs, school matricules, account links and enrollments unchanged. Do not infer annual facts or original names during backfill.
- [ ] Enforce same-school references in entity configuration and adapter scope resolution. Extend student, teacher and academic-year deletion guards to account for annual profiles. Preserve profiles on ordinary person deactivation and year changes; do not add cascading data loss.
- [ ] Route annual writes and related parent deletion checks through the appropriate transaction/lock group. The unique constraint must prevent duplicate annual rows even under concurrent create attempts.

### Commands and reads

- [ ] Extend student registration/profile update, guardian registration/contact-profile update, and staff teacher create/edit paths to accept the new person fields. Keep teacher and guardian self-service field allowlists explicit; adding a schema property must not silently grant a new write capability.
- [ ] Add `upsertStudentAcademicYearProfile` and `upsertTeacherAcademicYearProfile` commands. Resolve by school/person/year inside the transaction; generate the ID on first creation and return the existing ID on later updates. Callers must not need a newly generated row ID for each retry.
- [ ] Use patch semantics: omitted preserves; `null` clears nullable scalars; `false` and `0` are saved; an explicit empty disciplines array clears the declaration. Reject changes to a saved row's person/year association. Validate the complete resulting record, not just the patch.
- [ ] Publish typed annual get/list reads with person and academic-year filters. Apply authorized scope before pagination/counts. Return absence as absence, without an invented all-false profile.
- [ ] Keep generic public save/create/delete disabled for annual entities; expose named commands and normal authorized read operations. Clearing individual facts uses upsert. Add `removeStudentAcademicYearProfile` and `removeTeacherAcademicYearProfile` commands with the same scoped management authority, allowing an erroneous annual record to be removed without deleting its person, enrollment or assignments. Parent/year deletion still returns a clear conflict while a profile exists.
- [ ] Update API schemas, operation registry, public operation catalog, command handlers, client bindings and tracked OpenAPI through the repository's generation workflow. Document new errors for mismatched school/year, invalid hours and dependent-profile deletion.

The annual natural key and atomic upsert make these records reusable by the future importer. They do not claim to solve import identity matching or batch replay.

### Authorization

Use existing permission actions and their current resource scopes, without introducing role-name checks:

| Surface | Proposed access |
| --- | --- |
| New scalar person fields | Same scoped staff read/write authority as the parent profile. Existing authorized parent-entity readers receive the additive fields; no separate portal UI is introduced. Preserve existing portal write allowlists. |
| Student annual profile | Staff `STUDENT_READ` for reads and `STUDENT_MANAGE` for writes, scoped through the referenced student and target academic year. |
| Teacher annual profile | Staff teacher-management policy: existing `STAFF_READ` / `ACCESS_CONTROL_READ` read rules and `ACCESS_CONTROL_MANAGE` writes, with the same teacher-resource scope rules. |
| Teacher/guardian/student portal actors | No new annual-profile access in the initial release. Existing assignments, family links and current portal reads continue to function. |

Authorize every affected reference inside the command transaction. A school ID alone must not override a narrower student/class scope. New disciplines and placement codes are data, not authorization facts. Add explicit cross-school, restricted-staff and portal tests for both list and direct-ID access.

## 3. Staff application changes

Use the existing list → URL-backed detail drawer → edit modal patterns. Add sections to current profiles; no new top-level navigation is required.

| Screen | Read and edit behavior |
| --- | --- |
| Student profile | Show school and national matricules with distinct labels. Add original supplied name as secondary profile information. Extend create/edit payloads and local mappings so values survive unrelated changes. |
| Student annual information | In the profile drawer, show the explicitly selected academic year, placement code, and repeating value: Yes / No / Not provided. Edit in a dedicated annual-information modal using the annual command. Empty state offers creation only when authorized. |
| Guardian detail | Show occupation and original supplied name. Extend create/edit modals, registration, mutations, optimistic state and selectors. Editing occupation must not recreate contact methods, change family-link rights or trigger an account invitation. |
| Teacher profile | Show original supplied name and a selected-year teaching declaration: disciplines, declared hours and period. Use a multiple-label input and separate hours/period controls. Display unknown hours and unspecified period explicitly. |

- [ ] Include school, person ID and academic-year ID in annual query/cache keys. Changing the selected year must clear stale data and load the correct profile. Capture the target year when opening an edit modal; switching context must not submit values to a different year.
- [ ] Offer removal of annual information through the existing confirmed-delete modal pattern, displaying the person and year. Correcting a record created for the wrong year requires an explicit target-year save and removal of the erroneous record; never silently change its association.
- [ ] Use route-owned queries and existing mutation/version refresh patterns. Refresh both the drawer and any affected list summaries after save; show validation and permission errors through the standard components.
- [ ] Add French/English labels consistent with existing localization. Render code values as supplied until their meanings are confirmed; do not label AFF as a funding entitlement or a dash as zero hours.
- [ ] Propagate fields through handwritten DTO/view-model mappings and existing profile exports that explicitly select fields. Do not introduce new export products or change official report-card content in this phase. Verify canonical names and identifiers in existing documents remain correct.
- [ ] Update the applicable normative UI specs alongside implementation when these sections become part of the shipped contract. Keep this plan in `docs/sprints`; do not link it from normative specs.

## 4. Implementation sequence and delivery gates

Each slice includes backend persistence, API, staff UI and tests for its fields. Foundation work alone does not satisfy a slice's acceptance gate.

| Order | Work package | Exit gate |
| --- | --- | --- |
| 1 | Person fields: national matricule, guardian occupation, original supplied names; additive migration and complete write/read mappings. | Create, edit, clear and reload each field; an unrelated contact, photo or status edit preserves it. Both matricules remain distinct. |
| 2 | Student annual entity, atomic command, scoped reads, profile UI and deletion safeguards. | Independent values survive across two years and a within-year class transfer; repeating true does not manufacture a progression decision. |
| 3 | Teacher annual entity, atomic command, scoped reads, declaration UI and deletion safeguards. | Multiple disciplines and fractional hours survive round-trip; unknown hours, zero and unspecified period remain distinct; assignments and permissions are unchanged. |
| 4 | Cross-repository qualification and release preparation. | Web/mobile clients derive from one backend candidate; migration, authorization and relevant staff/portal journeys pass. |
| 5 | Handoff to import improvements. | Publish the stable destination-field/command contract and unresolved source decisions. Start template/parser/runner changes as the separate import phase. |

Implementation should preserve the existing unrelated frontend working-tree changes. The original assessment used backend HEAD `ff97499269650ea6104d09963ed91ee9a121909c` and frontend HEAD `5b80ef4b7313461691b5f562d39442e9f29dc913` plus frontend working-tree changes. Recheck touched call sites at execution time.

### Main implementation locations

Paths below are relative to their repository roots; new entity/workflow files are proposed additions beside the existing files.

| Repository / layer | Main locations |
| --- | --- |
| Backend domain | `package/domain-core/src/domain/students/{student,guardian}.ts`; `domain/school/teacher.ts`; new student/teacher academic-year profile files; `registry/core-entity-map.ts`; `ports/repositories/school-repositories.ts`. |
| Backend policies and services | `package/domain-authorization/src/access/entity-policies.ts` and repository ports; `package/domain-service/src/services/workflows/{student,setup}.ts`; new annual workflows; `entities/config/students`, `entities/config/school`; runtime catalogs and command handlers. |
| Backend persistence | `package/adaptor-postgres/src/schema/{students,school}.ts`; `stores/entity-stores-{students,school}.ts`; store/repository/schema assembly, `lib/school-scope.ts`, index definitions and `package/adaptor-postgres/drizzle`. |
| Backend HTTP | `apps/api/src/lib/school-api/schemas/{entities,commands}.ts`; operation/public-operation/client-binding registries and OpenAPI generation. |
| Web shared reads/writes | `apps/webapp/src/lib/types/school.ts`; `lib/api/student-drawer-data.ts`, `student-360-data.ts`, `teachers-data.ts`, `people-data.ts`; student registration, guardian registration and teacher save helpers. |
| Web profile surfaces | `apps/webapp/src/routes/(app)/school/students/[[id]]/(tabs)/profile`; `school/guardians/[[id]]/components` plus guardian create/mutation/selectors; `school/teachers/[[id]]/components` and `(tabs)/profile`. |
| Web/mobile contracts | Frontend API-client generation; `edaya_mobile/packages/edaya_api_client`, its generated bindings and handwritten person mappings in the teacher/guardian apps. |

## 5. Verification and release

Use synthetic data shaped like the submission, without copying school personal records into fixtures.

| Test group | Required evidence |
| --- | --- |
| Persistence and patching | Both matricules, occupation and source names round-trip; original name spacing survives; omitted preserves, null clears, false/zero survive. Guardian custom mapping and all person reconstruction paths retain new values. |
| Annual invariants | Two years have independent values; profiles may exist without enrollment/assignment; same-year transfer retains facts; year rollover copies nothing; concurrent upserts produce one row and stable ID. |
| Validation | Unknown placement codes are retained. Negative/nonfinite hours, blank discipline labels and inconsistent period labels fail. Fractional hours, absent hours and numeric hours with unspecified period succeed. |
| Access and integrity | Cross-school person/year combinations fail; narrow staff scopes cannot read or write other records; pagination/counts respect scope; portals cannot access annual endpoints; parent deletion cannot orphan a profile; authorized annual removal leaves person/enrollment/assignment records intact. |
| Web journeys | Create/edit/reload all additions; change years; clear values; exercise empty and read-only states; verify stale modal/year handling and permission errors. |
| Existing application behavior | Existing registrations still work without new fields. Contact edits/invitations, teacher assignments, family access, enrollment transfer/progression, timetable behavior and existing document generation remain correct. |
| Migration | Apply to both an empty schema and a disposable copy/fixture of the previous schema. Existing row counts/keys/data remain unchanged; annual tables start empty; uniqueness and migration metadata parity checks pass. |

- [ ] Run targeted domain, adapter, command and web tests during each slice. Then run backend `bun run repo ci qualify staging` (or `bun run verify` plus `bun run test:integration`). Run `bun run test:integration:seed` if seed HTTP paths are changed.
- [ ] Generate web and mobile clients from the same committed, clean backend candidate using each repo's documented `generate client ... --ref` or `--backend-root` workflow. Avoid accidentally qualifying against the old staging contract.
- [ ] Run frontend `bun run verify` and relevant application journeys; run mobile `melos run verify` and relevant teacher/guardian integration journeys. Mobile requires contract/mapping compatibility in this phase, without new administrative profile screens.
- [ ] Record qualification evidence and the backend candidate identity. Rehearse migrations and staff/portal smoke checks in staging. Apply additive migrations before the matching backend and then release the qualified consumers through the normal release process.
- [ ] Rollback rehearsal: disable the new UI/write paths or restore the previous application release while retaining the added columns/tables and captured data. Verify old write paths preserve those values; if they do not, pause affected writes during rollback. Do not drop populated schema objects as an application rollback.

No deployment, migration execution or production-data validation is part of creating this plan.

## 6. Conditional model work

| Decision needed | Default for this implementation | Follow-on work only if required |
| --- | --- | --- |
| Can people with unresolved first/last-name components become live records? | Retain `sourceFullName`, keep required first/last names. Unresolved one-token or ambiguous names remain a preparation exception. | Change the live person-name contract across schemas, sorting/search, initials, accounts, notifications, documents and all clients. Define a reliable display fallback; do not fill a missing component with invented text. |
| Are A1/A2 and track differences class-wide? | Use existing `GradeLevel` plus year-scoped `Subject` for distinct class-wide curricula after the school confirms the mapping. Class section numbers are not evidence of curriculum choice. | If choices coexist inside one class, design student-year curriculum/subject selections and apply them to assessments, eligibility, coefficients, averages, rankings, attendance where applicable and report cards before activation. |
| Are LV2/arts alternatives selected per student? | Retain unresolved expressions in source preparation; configure supported class-wide/optional offerings only after clarification. | Include alternative-group and per-student selection rules in the curriculum extension above. Storing a choice alone is insufficient if grading ignores it. |
| What do placement codes and teacher hour values mean? | Store exact placement codes and allow `hoursPeriod=unspecified`; no inferred operational effects. | Add school-approved labels/rules or timetable/finance integration only when meanings and behavior are defined. |

These decisions do not block slices 1–4. They do block any claim that the associated ambiguous source rows or curriculum rules are fully operationally ingested.

## 7. Handoff contract and definition of done

The next import phase can target these stable destinations:

| Prepared source fact | Application destination |
| --- | --- |
| School / national matricules | `Student.matricule` / `Student.nationalMatricule` |
| Original person name | Corresponding person's `sourceFullName`, alongside resolved required name components |
| STATUT / REDOUBLANT | `StudentAcademicYearProfile.placementStatusCode` / `isRepeating`, through its annual upsert command |
| Resolved parent's/correspondent's FONCTION | That `Guardian.occupation`, after identity and contact ownership are resolved |
| DISCIPLINE / NOMBRE D'HEURE | `TeacherAcademicYearProfile.disciplines` / `declaredHours`, plus explicit `hoursPeriod`, through its annual upsert command |

The model/application phase is done when all confirmed fields are usable through authorized staff UI and API, survive persistence and unrelated edits, retain the correct year, and pass the release gates above. It must be possible to demonstrate this without any import execution. Source corrections, prepared templates, provenance, identity crosswalks and ingestion reconciliation remain separately tracked work.

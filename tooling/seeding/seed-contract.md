# Seeding contract inventory

This inventory captures the seeding port architecture and the domain commands used by `tooling/seeding/src/domains/`.

## Local dev (HTTP-only)

CLI seeding (`bun repo ops seed`) always targets a **running API**:

1. Provision Central Identity users through `SEED_API_URL`
2. Bootstrap an owner session (`register-school` on a fresh database)
3. Seed access roles, provision the seeding service account (profile API key from `@edaya/fixtures`)
4. Load demo data through `/core/*` entity routes and commands

There is **no** direct PGlite/SQLite write path from the seed CLI. If HTTP bootstrap fails, the CLI exits with instructions to wipe `.data` and reseed — do not write to the database while the API is running.

`runHttpDevSeeds` is HTTP-only: it does not accept an in-process `SeedApplication`. In-process adapters under `domains/*/adapters/in-process.ts` remain for port-level unit tests and `@edaya/seeding` orchestration when a harness provides direct database access.

After bootstrap, bulk seeding (including access assignments) uses the elevated **seeding service account API key** from `@edaya/fixtures` — no owner session re-sign-in. Use `bun repo ops seed --scope doctor` to diagnose partial local seed state; `bun repo ops seed --scope doctor --repair` runs the minimal HTTP repair chain (`auth:link`, `service-account`, `access`, `profile-pictures`) for common drift without wiping `.data`.

## Repository operations

Application-level repositories:

| Repository | Operations | Purpose |
|------------|------------|---------|
| `schools` | `list`, `findById`, `save` | seed presence and owner bootstrap |
| `students` | `list` | seed presence |
| `staffMembers` | `findById`, `findOne`, `save` | auth linking and service-account bootstrap |
| `guardians` | `findById`, `save` | auth linking and minimal bootstrap |
| `accessRoles` | `save` | access bootstrap |
| `staffRoleAssignments` | `save` | access bootstrap |
| `staffAssignments` | `save` | teaching assignments |
| `attendance` | `findById` | attendance correction |
| `authorization` | `resolveEffectiveGrants` | service-account bootstrap |

Direct base-service writes are **not** used by HTTP seed adapters. Bootstrap catalog/configuration rows go through domain commands:

`assignStaffPermission`, `assignStaffToClass`, `assignStaffToClassSubject`, `assignStaffToLessonSession`, `configureActivity`, `configureDisciplinaryAction`, `configureGradeLevel`, `configurePeriodDefinition`, `configureResource`, `configureSubject`, `configureSubjectMatter`, `enrollStudentInActivity`, `registerAttachment`, `relinkActorSubject`, `requestAttendanceJustification`, and `updateSchoolConfiguration`.

Entity reads (`findById`, `list`) remain on `/core/entities/*` query routes where seeding needs idempotent presence checks.

## Domain commands

The seed flows call these `SchoolService` workflows:

`addStudentInvolvement`, `addTarget`, `applyDisciplinaryAction`, `assignMatterToClassSubject`, `assignResourceToLessonSession`, `assignStaffPermission`, `assignStaffToClass`, `assignStaffToClassSubject`, `assignStaffToLessonSession`, `cancelActivitySession`, `cancelLessonSession`, `cancelStudentCharge`, `completeAssessment`, `configureActivity`, `configureDisciplinaryAction`, `configureGradeLevel`, `configurePeriodDefinition`, `configureResource`, `configureSubject`, `configureSubjectMatter`, `createAcademicPeriod`, `createAcademicYear`, `createAnnouncement`, `createAssessment`, `createCalendarEvent`, `createCatalogService`, `createClassGroup`, `createGradeScale`, `createReportCardDefinition`, `createReportCardDefinitionSection`, `createSchedule`, `createStudentNote`, `enrollStudent`, `enrollStudentInActivity`, `enrollStudentInService`, `generateReportCardResult`, `linkActorSubject`, `linkGuardianToStudent`, `materializeDeliveries`, `materializeSchedule`, `offerSubjectToClass`, `publishAcademicPeriod`, `publishAnnouncement`, `publishReportCardResult`, `recordAssessmentResult`, `recordAttendance`, `recordDelivery`, `recordIncident`, `recordLessonSessionAttendance`, `recordLessonSessionProgress`, `recordPayment`, `refundAvailableBalance`, `registerAttachment`, `registerGuardian`, `registerSchool`, `registerStaffMember`, `registerStudent`, `relinkActorSubject`, `requestAttendanceJustification`, `requestDocumentIssuance`, `rescheduleOccurrence`, `reverseAllocation`, `reversePayment`, `updateSchoolConfiguration`, `updateStudentDisciplinaryActionStatus`, `upsertStudentHealthProfile`, and `waiveStudentCharge`.

## Migrated vertical ports

### Auth linking

Auth linking uses `AuthLinkSeedPort`, whose records contain only IDs and optional subject IDs. It exposes eight named operations:

1. Find a school.
2. Set the school owner subject.
3. Find a staff member.
4. Register missing seed staff.
5. Replace a stale staff subject.
6. Find a guardian.
7. Replace a stale guardian subject.
8. Link an unlinked staff member or guardian through the domain command.

The HTTP adapter handles JSON records and named HTTP operations. The in-process adapter reconstructs `School`, `StaffMember`, and `Guardian` entities before direct saves. Neither representation crosses the port boundary.

### Access bootstrap

Access bootstrap uses `AccessSeedPort`, whose records describe roles, role assignments, and teaching assignments without exposing domain classes. It exposes four named operations:

1. Check that the seed school exists.
2. Save an access role.
3. Save a staff role assignment.
4. Save a staff teaching assignment.

The HTTP adapter sends these records through the explicit entity routes. The in-process adapter reconstructs `AccessRole`, `StaffRoleAssignment`, and `StaffAssignment` before repository saves. The orchestration owns only declarative fixture records and derives its result counts from those records.

### School foundation

School foundation uses `SchoolStructureSeedPort` for the dependency chain required before population and curriculum seeding. Its ten named operations cover:

1. Seed-state inspection without returning school or student domain entities.
2. School registration.
3. Grade-level persistence.
4. Academic-year creation.
5. Academic-period creation and publication.
6. Period-definition persistence.
7. Staff existence checks and registration.
8. Class-group creation.

The workflow preserves fresh bootstrap, partial demo repair, populated-demo skip, and other-school skip behavior. Dates cross the boundary as ISO strings. The in-process adapter reconstructs `Date`, `GradeLevel`, and `PeriodDefinition` values; the HTTP adapter sends plain records through explicit commands and entity operations.

### Population

Population uses a four-operation `PopulationSeedPort` for student registration, enrollment, guardian registration, and guardian/student linking. Birth dates cross the boundary as ISO strings and are reconstructed only by the in-process adapter. The HTTP adapter calls the four corresponding domain commands with plain records.

### Curriculum

Curriculum uses a four-operation `CurriculumSeedPort` for subjects, subject matters, class offerings, and class-subject matter assignments. Fixture categories and colors are validated against explicit enum maps instead of cast to domain types. The in-process adapter reconstructs `Subject` and `SubjectMatter` for direct saves; workflow-backed records remain plain command inputs.

### Scheduling

Scheduling uses a seven-operation `SchedulingSeedPort` for resources, class-level resource assignments, schedules, schedule materialization, lesson-session staff/resource assignments, and lesson-session progress. Timestamps cross the boundary as ISO strings. Lesson session IDs follow `{scheduleId}:{calendarDate}` after `materializeSchedule`. The in-process adapter reconstructs `Date` and `Resource`; the HTTP adapter sends command records directly.

### Attendance

Attendance uses a three-operation `AttendanceSeedPort` for one-off lesson-session setup (schedule + materialize), attendance records, and pending-justification updates. Fixture `scheduleId` values are full schedule ids (e.g. `sch-sess-abs-a1`). The named pending update keeps record lookup and mutation inside each adapter. The in-process implementation uses `AttendanceRecord.copyWith`; the HTTP implementation updates the plain entity response without representing it as a domain instance.

### Assessments

Assessments use a two-operation `AssessmentsSeedPort` for assessment creation and student result recording. In-class assessments seed `startsAt`/`endsAt`; homework seeds `dueAt` only (`Assessment.kind = homework`). Homework assignments and submissions from fixtures map to `createAssessment` + `recordAssessmentResult`. Partial fixture score maps are narrowed before records reach the port, so result scores remain required and finite.

### Report cards

Report cards use a five-operation `ReportCardsSeedPort` for grade scales, definitions, sections, generation, and publication. Counts are derived by the pure workflow. Generated/published dates cross as ISO strings, and the in-process adapter reconstructs dates before domain commands.

### Finance

Finance uses admitted catalog accounting commands: create catalog service, enroll a student, record a payment, then optional waive/cancel, allocation reversal, payment reversal, and refund. Allocation IDs are queried after FIFO receipts because they are generated. Dates cross as ISO strings and are reconstructed only by the in-process adapter.

### Documents

Documents use a three-operation `DocumentsSeedPort` for ready issuances (`requestDocumentIssuance` + render dispatch), failed UI rows, and a post-seed dispatch. Ready fixtures replay bulletin, receipt, and schooling-certificate commands after report-card publication and finance receipts. Failed fixtures are persisted only by the in-process adapter (no public failed-issuance command). The HTTP adapter requests the same identity instead so CLI seed stays command-only.

### Activities

Activities use a two-operation `ActivitiesSeedPort` for activity programs and enrollments. Activity categories and enrollment statuses are mapped explicitly; dates cross as ISO strings and are reconstructed only in-process.

### School life

Calendar events and incidents use a three-operation `SchoolLifeSeedPort`. The workflow expands school/class scopes, maps event and incident kinds explicitly, and records each incident before adding its student involvement. Dates cross as ISO strings and are reconstructed only in-process.

### Student support

Student support uses a two-operation `StudentSupportSeedPort` for health-profile upserts and pedagogical-note creation. The workflow owns health-list normalization and note-category mapping. Visit and creation dates cross as ISO strings and are reconstructed only by the in-process adapter.

### Discipline

Discipline uses a three-operation `DisciplineSeedPort` for catalog saves, applied actions, and non-active status transitions. Catalog and incident dependencies remain ordered by the workflow, and dates cross as ISO strings.

### Communications

Communications uses a five-operation `CommunicationsSeedPort` for announcements, targets, publication, delivery materialization, and explicit delivery recording. Materialization returns only a count across the boundary rather than domain entities.

### Attachments

Attachments use a one-operation `AttachmentsSeedPort`. The workflow maps fixture owner labels to `AttachmentOwnerKind`; each adapter owns its persistence representation.

## Migration order

1. Auth linking and owner bootstrap: migrated.
2. Access bootstrap: migrated.
3. School foundation: migrated.
4. Population and curriculum: migrated.
5. Scheduling and attendance: migrated.
6. Assessments and report cards: migrated.
7. Finance: migrated.
8. Official documents: migrated.
9. Activities: migrated.
10. Calendar events, incidents, and student involvements: migrated.
11. Student health profiles and pedagogical notes: migrated.
12. Communications, discipline, and attachments: migrated.

All dev-school seed domains now run through explicit ports. HTTP seeding no longer constructs a proxy `SeedApplication` or represents JSON responses as core domain services/repositories.

Each slice should keep the existing HTTP and in-process integration assertions green.

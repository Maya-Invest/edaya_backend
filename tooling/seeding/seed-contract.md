# Seeding contract inventory

This inventory captures the seeding port architecture and the domain commands used by `tooling/seeding/src`.

## Local dev (HTTP-only)

CLI seeding (`bun seed`, `bun seed:init`) always targets a **running API**:

1. Provision Better Auth users via `/auth/*`
2. Bootstrap an owner session (`register-school` on a fresh database)
3. Seed access roles, provision the seeding service account (profile API key from `@edaya/dev-fixtures`)
4. Load demo data through `/core/*` entity routes and commands

There is **no** direct PGlite/SQLite write path from the seed CLI. If HTTP bootstrap fails, the CLI exits with instructions to wipe `.data` and reseed — do not write to the database while the API is running.

Integration tests may still pass `application?: SeedApplication` to `runHttpDevSeeds` to use in-process adapters for speed; that path is test-only.

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

Direct base-service writes:

`activities.save`, `activityEnrollments.save`, `attachments.save`, `attendance.save`, `classLogbookEntries.save`, `disciplinaryActions.save`, `gradeLevels.save`, `homeworkAssignments.save`, `homeworkSubmissions.save`, `periodDefinitions.save`, `resources.save`, `subjectMatters.save`, and `subjects.save`.

These writes are bootstrap operations, not normal public workflows. Keep them named and isolated in future ports rather than exposing a generic repository bag.

## Domain commands

The seed flows call these `SchoolService` workflows:

`addStudentInvolvement`, `addTarget`, `applyDisciplinaryAction`, `assignFeeToStudent`, `assignMatterToClassSubject`, `assignResourceToSession`, `assignStaffToSession`, `createAcademicPeriod`, `createAcademicYear`, `createAnnouncement`, `createAssessment`, `createCalendarEvent`, `createClassGroup`, `createFee`, `createGradeScale`, `createReportCardDefinition`, `createReportCardDefinitionSection`, `createSchedule`, `createSession`, `createStudentNote`, `enrollStudent`, `generateReportCardResult`, `linkActorSubject`, `linkGuardianToStudent`, `materializeDeliveries`, `offerSubjectToClass`, `publishAcademicPeriod`, `publishAnnouncement`, `publishReportCardResult`, `recordAssessmentResult`, `recordAttendance`, `recordDelivery`, `recordIncident`, `recordPayment`, `recordSessionProgress`, `registerGuardian`, `registerSchool`, `registerStaffMember`, `registerStudent`, `updateStudentDisciplinaryActionStatus`, and `upsertStudentHealthProfile`.

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

Scheduling uses a six-operation `SchedulingSeedPort` for resources, schedules, sessions, staff/resource assignments, and session progress. Timestamps cross the boundary as ISO strings. The in-process adapter reconstructs `Date` and `Resource`; the HTTP adapter sends command/entity records directly.

### Attendance

Attendance uses a three-operation `AttendanceSeedPort` for sessions, attendance records, and pending-justification updates. The named pending update keeps record lookup and mutation inside each adapter. The in-process implementation uses `AttendanceRecord.copyWith`; the HTTP implementation updates the plain entity response without representing it as a domain instance.

### Assessments

Assessments use a two-operation `AssessmentsSeedPort` for assessment creation and student result recording. Assessment dates cross the boundary as ISO strings. Partial fixture score maps are narrowed before records reach the port, so result scores remain required and finite.

### Report cards

Report cards use a five-operation `ReportCardsSeedPort` for grade scales, definitions, sections, generation, and publication. Counts are derived by the pure workflow. Generated/published dates cross as ISO strings, and the in-process adapter reconstructs dates before domain commands.

### Finance

Finance uses a three-operation `FinanceSeedPort` for fee creation, student fee assignment, and payment recording. The workflow resolves one reference date for status-sensitive operations and maps fixture categories to domain enums. Installment, due, payment, and reference dates cross as ISO strings and are reconstructed only by the in-process adapter.

### Learning content

Learning content uses a three-operation `LearningContentSeedPort` for homework assignments, homework submissions, and class-logbook entries. Dates cross as ISO strings, and fixture types/statuses map explicitly to core enums. The in-process adapter owns all three domain constructors.

### Extracurricular activities

Activities use a separate two-operation `ActivitiesSeedPort` for activities and enrollments. Activity categories and enrollment statuses are mapped explicitly; dates cross as ISO strings and are reconstructed only in-process.

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
8. Learning content and extracurricular activities: migrated.
9. Calendar events, incidents, and student involvements: migrated.
10. Student health profiles and pedagogical notes: migrated.
11. Communications, discipline, and attachments: migrated.

All dev-school seed domains now run through explicit ports. HTTP seeding no longer constructs a proxy `SeedApplication` or represents JSON responses as core domain services/repositories.

Each slice should keep the existing HTTP and in-process integration assertions green.

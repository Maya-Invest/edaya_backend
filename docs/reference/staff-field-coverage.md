# Staff field coverage

Source review: 2026-10-20. The [machine-readable matrix](staff-field-coverage.json) maps 1,459 field paths across all 66 core entities and eight specialized communication, feedback and correction models. Nested contacts, billing terms/installments, grading and report snapshots are included. Each row records list availability, detail location, editor/workflow, read/write permissions, source evidence and exclusions.

This is a source-coverage audit. Qualification and browser evidence are recorded in the [implementation tracker](../sprints/school-data-model-plan.md); a source reference alone does not establish that a browser scenario passed.

## User-facing coverage

| Area | Editor/workflow and detail coverage |
| --- | --- |
| People | Canonical first/last names, original names, school/national identifiers, demographics, entry date, guardian occupation and complete contact methods. Account linkage stays in invitation workflows. Graduated is a distinct lifecycle state. |
| Guardians | One shared relationship editor for relationship, primary/billing/legal flags, pickup, priority, academic/attendance subscriptions, restrictions and notes. Summaries retain the related child. |
| Health and notes | Arbitrary medical text, protocols, last visit and blood type require existing health permissions. Note title/category/body/visibility use note permissions. |
| Annual profiles | Selected-year placement/repeating and teacher catalogue declarations/hours/period; unknown differs from false/zero. No automatic year copying. |
| Curriculum | Discipline, code, name/short name, coefficient, optionality, category/color/workload, class offerings, chapters and logbook progress. Manually configured subjects require an explicit discipline association; onboarding subjects use the selected canonical dataset’s discipline references. |
| Staffing/access | Codes, status, assignment responsibilities/dates/end state, availability rules and manual validity controls. Access previews and named grant/profile/default-scope commands remain authoritative. |
| Enrollment | Placement/progression history and completion/withdrawal/graduation/promotion/decision commands; sequence and audit actors remain server-managed. |
| Attendance/scheduling | Daily/lesson/activity/assessment review anchors, reasons/notes and latest review/correction audit. Recurring/one-off schedules, explicit dates and all supported weekdays. |
| Finance | Fee descriptions, due dates/installments, immutable accepted assignment terms, charge adjustments/waivers/cancellations, allocation history and payment reversal relationships. |
| Assessments/reports | Settings, attachment name/size metadata, completion, score/designation/notes, correction history, comments, publication history and readiness. Calculated grading data is read-only. |
| School operations | Activity/calendar details, incident/session association, participant/sanction notes and dates, school/timetable settings, invitation history, announcement delivery details and document lifecycle information. |
| Feedback/messages/corrections | Existing campaign setup/moderation/publication, private conversation replies/resolution and versioned correction decisions. Existing privacy/suppression rules remain in force. |

## Table contract

People tables retain their existing default fields. Every additional authorized person/annual business field is available through Columns. Identity, selection and actions are structural. Header/cells and people CSVs use the same visible key set in a fixed order. Browser preferences contain only `{version, keys}`, isolated by authenticated subject, school and list. Restoration removes obsolete or unauthorized keys; storage failures use defaults. Column changes retain filters/sorting. Optional reads are batched; health requires selection and read authority. Cached optional data is scoped to the user, school, year and current grants.

## Intentional exclusions and workflow-owned values

- Platform ownership, service-account administration, credentials/token hashes, storage/provider metadata, internal concurrency/provenance and server audit identities do not become ordinary staff editors.
- Resource booking remains deferred. Teacher signatures remain teacher-owned. School branding continues through its existing upload workflow.
- Calculated grading, balances, allocations, revision/publication snapshots and derived permission projections remain read-only or command-managed. Staff edit their authoritative inputs.
- Private feedback answers and completion identities do not become staff-level row data. Authorized moderation reads comments through the audited workflow; published results retain suppression.
- Attendance stores the latest review/correction metadata, not an append-only history. The UI accurately exposes the available metadata. Review timestamps/actors cannot be supplied by the client.
- Assessment attachments currently support name/size metadata; the existing model has no attachment bytes or download URL. This pass exposes that supported contract.
- Imported source preparation, matching/provenance and ingestion are separate work. Existing subjects stay unlinked until staff review mappings; production catalogues are not inferred from names.

## Inventory

| Model | Field paths |
| --- | ---: |
| `academicDisciplines` | 7 |
| `academicPeriods` | 9 |
| `academicYears` | 7 |
| `accountInvitations` | 14 |
| `activities` | 12 |
| `activityEnrollments` | 5 |
| `activitySessions` | 12 |
| `announcementTargets` | 5 |
| `announcements` | 10 |
| `assessmentResults` | 28 |
| `assessments` | 32 |
| `attachments` | 14 |
| `attendance` | 18 |
| `attendances` | 7 |
| `calendarEvents` | 12 |
| `catalogServices` | 20 |
| `classActivityEnrollments` | 4 |
| `classGroups` | 9 |
| `classSubjectMatters` | 10 |
| `classSubjectProgress` | 7 |
| `classSubjects` | 10 |
| `conversation` | 19 |
| `conversationMessage` | 10 |
| `definitions` | 13 |
| `disciplinaryActions` | 8 |
| `documentIssuances` | 53 |
| `enrollments` | 16 |
| `familyFeedbackCampaign` | 23 |
| `familyFeedbackCommentReadAudit` | 7 |
| `familyFeedbackResponse` | 11 |
| `familyFeedbackSlot` | 9 |
| `familyFeedbackSnapshot` | 22 |
| `gradeLevels` | 41 |
| `gradeScales` | 19 |
| `guardianLinks` | 15 |
| `guardians` | 16 |
| `incidents` | 15 |
| `lessonSessions` | 14 |
| `messageDeliveries` | 17 |
| `payments` | 18 |
| `periodDefinitions` | 11 |
| `placementStatuses` | 7 |
| `resourceAssignments` | 7 |
| `resources` | 7 |
| `results` | 257 |
| `schedules` | 13 |
| `schoolNotificationTemplates` | 178 |
| `schools` | 32 |
| `sections` | 11 |
| `staffAssignments` | 11 |
| `staffManualPermissionAssignments` | 16 |
| `staffMembers` | 19 |
| `staffPermissionAssignments` | 14 |
| `staffPermissionProfileBindings` | 14 |
| `staffPermissionProfiles` | 8 |
| `staffPermissionScopeDefaults` | 7 |
| `studentAcademicYearProfiles` | 8 |
| `studentCharges` | 29 |
| `studentDisciplinaryActions` | 12 |
| `studentHealthProfiles` | 12 |
| `studentIncidentInvolvements` | 6 |
| `studentNotes` | 10 |
| `studentPhotoSubmissions` | 12 |
| `studentServiceEnrollments` | 31 |
| `studentYearAccounts` | 8 |
| `students` | 17 |
| `subjectCategories` | 4 |
| `subjectMatters` | 7 |
| `subjects` | 16 |
| `teacherAcademicYearProfiles` | 10 |
| `teacherAssignments` | 12 |
| `teacherCorrection` | 25 |
| `teacherUnavailabilities` | 15 |
| `teachers` | 15 |

# Reduced permission catalog

Status: **implemented locally**; see [runtime cutover](runtime-cutover.md) for verification and release boundaries.

**82 staff-assignable permissions, down from 113** in the first proposal (31 fewer, 27.4%). The full target has **90 capabilities**: 82 staff, 5 platform and 3 intrinsic relationship capabilities. The original audited runtime declared 127 permissions; the local runtime now uses this reduced catalog.

These are actual catalog consolidations. Profiles remain bundles. Manage includes the listed routine operations but supplies only bounded workflow reads; View grants full permitted browse access separately. State, author, ownership, relationship, assurance and complete-target checks still apply. No hidden CRUD permissions or automatic read-implication graph are introduced.

Each case below names a person who needs the capability while lacking a neighboring capability. These are explicit business assumptions (A01–A18), not observations from live usage. Revalidate these separation cases during staging workflow acceptance; any revision must update the catalog, policies and matrix together.

Scope: **N** unscoped; **C** grade/class; **S** grade/grade-subject/class/class-subject; **L** grade/class/student; **T** grade/class/class-subject/activity; **G** grade; **A** activity; **R** relationship-derived; **P** platform. Resource scopes require a compatible target or explicit All; empty grants no access. Full semantics and operation boundaries are in [the target specification](target-specification.md).

## Staff catalog

| Area | Permissions |
|---|---:|
| School setup | 3 |
| Staff and access | 4 |
| Service accounts | 2 |
| Academic program | 4 |
| Students and health | 7 |
| Guardians | 2 |
| Enrollment | 2 |
| Discipline | 4 |
| Attendance | 4 |
| Academic configuration | 1 |
| Assessments and marks | 5 |
| Report cards | 7 |
| Class logbook | 3 |
| Timetable | 2 |
| Finance configuration | 2 |
| Payments and reports | 6 |
| Official documents | 1 |
| Family feedback | 4 |
| Conversations | 3 |
| Announcements | 4 |
| Resources and attachments | 10 |
| Query surfaces | 2 |
| **Total** | **82** |

### School setup

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View school setup** — `SCHOOL_STRUCTURE_READ` | N | A planning assistant inspects years, terms and classes without changing setup or releasing a year. |
| **Manage school setup** — `SCHOOL_CONFIGURE` | N | A setup administrator maintains structure, branding and calendars while a director controls academic-year release. |
| **Release academic years and periods** — `SCHOOL_LIFECYCLE_MANAGE` | N | A director authorizes lifecycle transitions without needing to edit structural dates, branding or holidays. |

### Staff and access

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View workforce** — `STAFF_READ` | N | An office coordinator consults the full staff directory without hiring, editing or deactivating colleagues. |
| **Manage staff** — `STAFF_MANAGE` | N | A workforce administrator maintains human staff records without assigning access or managing integration credentials. |
| **Audit access** — `ACCESS_CONTROL_READ` | N | An access reviewer inspects grants and profiles without changing anybody's authority. |
| **Manage access** — `ACCESS_CONTROL_MANAGE` | N | An access administrator maintains profiles and bounded assignments without gaining staff-record or service-credential maintenance. |

### Service accounts

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View service accounts** — `SERVICE_ACCOUNT_READ` | N | An integration auditor inspects service-account inventory without obtaining key-rotation or account-change authority. |
| **Manage service accounts** — `SERVICE_ACCOUNT_MANAGE` | N | A human integration administrator manages school service credentials without becoming a platform S2S-client administrator. |

### Academic program

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View curriculum allocations** — `ACADEMIC_PROGRAM_READ` | S | A curriculum observer reviews placed subjects and syllabus without changing allocations or reading student marks. |
| **Manage curriculum allocations** — `ACADEMIC_PROGRAM_MANAGE` | S | A subject coordinator maintains covered allocations without altering the shared subject dictionary or school-wide grading scales. |
| **Manage academic dictionary** — `ACADEMIC_CATALOG_MANAGE` | N | A curriculum librarian maintains shared definitions without assigning them to classes or changing grading rules. |
| **View academic dictionary** — `ACADEMIC_CATALOG_READ` | N | A curriculum planner browses even unused subject definitions without editing them or accessing class progress. |

### Students and health

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View student dossiers** — `STUDENT_READ` | L | A class supervisor reads basic dossiers without changing identity, reading health data or reading restricted pastoral notes. |
| **Register new students** — `STUDENT_CREATE` | N | An intake clerk registers an unenrolled student without gaining editing rights over the existing school directory. |
| **Manage existing student dossiers** — `STUDENT_MANAGE` | L | A caseload registrar corrects or archives existing dossiers without creating school-wide unenrolled identities or editing health records. |
| **View health records** — `STUDENT_HEALTH_READ` | L | An authorized health responder reads a covered emergency profile without changing clinical information. |
| **Manage health records** — `STUDENT_HEALTH_UPDATE` | L | A health officer updates a covered health record without changing the student's basic identity or pastoral notes. |
| **Manage own pastoral notes** — `STUDENT_NOTE_MANAGE` | L | A counselor records and maintains their own notes without changing lesson logs, health data or another author's notes. |
| **View pastoral notes** — `STUDENT_NOTE_READ` | L | A pastoral reviewer reads permitted notes without authoring, editing or deleting them; visibility rules still exclude admin-only notes. |

### Guardians

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View guardian contacts** — `PARENT_READ` | L | A class supervisor contacts guardians through covered child links without changing a shared guardian identity or exposing siblings. |
| **Manage guardian records** — `PARENT_MANAGE` | N | A registrar maintains guardian identities, child links and family portal access without assigning staff permissions or changing class enrollment; guardian self-service remains limited to its current fields. |

### Enrollment

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View class enrollment history** — `ENROLLMENT_READ` | L | An attendance administrator reviews placements and history without admitting, transferring or withdrawing students. |
| **Manage class enrollment** — `ENROLLMENT_MANAGE` | C | A registrar changes class placements without changing a student's master dossier or approving optional activity participation. |

### Discipline

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View discipline records** — `DISCIPLINE_READ` | L | A pastoral observer reviews covered incidents without reporting, editing, cancelling or adjudicating them. |
| **Report discipline incidents** — `DISCIPLINE_CREATE` | T | A lesson/activity monitor reports an occurrence without editing or cancelling the official incident register or imposing sanctions. |
| **Maintain discipline records** — `DISCIPLINE_MANAGE` | C | A class supervisor corrects and cancels official incidents without deciding sanctions or validating a teacher correction. |
| **Review and resolve discipline** — `DISCIPLINE_VALIDATE` | C | A disciplinary reviewer decides covered cases and sanctions without rewriting reporter content or cancelling records as maintenance. |

### Attendance

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View attendance** — `ATTENDANCE_READ` | C | An attendance analyst reviews class registers without capturing, correcting or approving entries. |
| **Record lesson or daily attendance** — `ATTENDANCE_RECORD` | T | A lesson/activity supervisor captures an authorized occurrence without maintaining the official class register or approving explanations. |
| **Maintain attendance registers** — `ATTENDANCE_MANAGE` | C | An attendance clerk corrects register entries and records explanations without approving explanations or submitted teacher corrections. |
| **Review attendance** — `ATTENDANCE_VALIDATE` | C | A class reviewer accepts or rejects explanations/corrections without general register editing or new attendance capture. |

### Academic configuration

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **Manage grading scales** — `GRADE_SCALE_CONFIGURE` | N | A grading-policy administrator maintains shared scales without editing class assessments or student results; subject coordinators cannot alter school-wide rules. |

### Assessments and marks

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View marks** — `GRADE_READ` | S | A subject observer reads authorized marks without entering results or reviewing corrections. |
| **Enter and submit marks** — `GRADE_MANAGE` | S | A marker enters, corrects and submits draft marks without approving corrections to submitted/published results. |
| **Review mark corrections** — `GRADE_VALIDATE` | C | A class reviewer approves submitted corrections without general draft-mark entry authority for other workflows. |
| **View assessments** — `ASSESSMENT_READ` | S | A timetable or academic observer inspects assessments without creating, changing or deleting them or entering marks. |
| **Manage assessments** — `ASSESSMENT_MANAGE` | S | A subject coordinator maintains covered assessments without entering marks, reviewing corrections or changing global scales. |

### Report cards

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View report cards** — `REPORT_CARD_READ` | L | An advisor reads permitted reports without generating results, commenting, publishing or issuing official documents. |
| **Configure report templates** — `REPORT_CARD_CONFIGURE` | G | A grade coordinator designs sections and computation rules without editing an individual report or releasing results. |
| **Prepare report results** — `REPORT_CARD_GENERATE` | L | An academic assistant computes and cleans up drafts without authoring comments, releasing results or issuing official documents. |
| **Publish report cards** — `REPORT_CARD_PUBLISH` | L | A director releases approved results/corrections without routine draft editing; publication may request its own required replacement document. |
| **Issue official report cards** — `REPORT_CARD_EXPORT` | L | A records clerk issues or downloads already-published official reports without publishing results or applying pending corrections. |
| **Write report comments** — `REPORT_CARD_COMMENT` | S | A subject/homeroom author writes only their permitted comments without reviewing corrections, changing marks or publishing reports. |
| **Review comment corrections** — `REPORT_CARD_REVIEW_COMMENTS` | C | A reviewer approves a comment correction while a separate publisher controls its effect on the official published revision. |

### Class logbook

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View lesson logs and progress** — `CLASS_LOGBOOK_READ` | S | A subject observer reads/export logs and syllabus progress without editing lesson records or validating corrections. |
| **Maintain lesson logs** — `CLASS_LOGBOOK_MANAGE` | S | A lesson author records and corrects draft progress without approving submitted corrections or changing pastoral notes. |
| **Review lesson logs** — `CLASS_LOGBOOK_VALIDATE` | C | A class reviewer validates logbook corrections without ordinary subject-log authoring authority. |

### Timetable

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View timetables and calendars** — `TIMETABLE_READ` | C | A coordinator consults covered schedules and applicable calendar dates without rescheduling classes or changing holidays. |
| **Manage class timetables** — `TIMETABLE_MANAGE` | C | A class scheduler maintains lessons without changing school holidays or a shared activity's definition/participants. |

### Finance configuration

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View service and pricing catalog** — `FINANCIAL_CONFIG_READ` | N | An office assistant explains prices from the full service catalog without changing prices or receiving money. |
| **Manage service and pricing catalog** — `FINANCIAL_CATALOG_MANAGE` | N | A pricing administrator maintains service definitions without recording payments or retroactively changing issued charges. |

### Payments and reports

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View student accounts** — `PAYMENT_READ` | L | An account observer reads covered charges, payments and receipts without receiving, allocating, cancelling or reversing money. |
| **Record payments and charges** — `PAYMENT_RECORD` | L | A cashier records transactions without reallocating existing credit, cancelling charges or reversing completed payments. |
| **Allocate account credit** — `PAYMENT_ALLOCATE` | L | An accountant applies existing credit without receiving new money or reversing a payment. |
| **Cancel financial entries** — `PAYMENT_CANCEL` | L | A billing supervisor cancels eligible charges/entries without issuing refunds or changing amounts; combined changes require both capabilities. |
| **Reverse payments** — `PAYMENT_REVERSE` | L | A refund officer reverses covered payments without general price administration or authority to record new payments. |
| **View school financial reports** — `FINANCIAL_REPORT_READ` | N | An accountant reconciles school totals without mutation rights; a cohort cashier does not receive cross-school-year or whole-school reconciliation through scoped account access. |

### Official documents

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **Void official documents** — `DOCUMENT_VOID` | N | A records authority voids an issuance without changing its academic/financial source; ordinary issuers cannot void unrelated documents. |

### Family feedback

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View feedback campaigns** — `FAMILY_FEEDBACK_CAMPAIGN_READ` | N | A campaign observer inspects authorized administration data without changing setup, moderating responses or publishing results. |
| **Manage feedback campaigns** — `FAMILY_FEEDBACK_CAMPAIGN_MANAGE` | N | A survey organizer maintains campaign setup/lifecycle without censoring responses or releasing results. |
| **Moderate feedback** — `FAMILY_FEEDBACK_MODERATE` | N | A moderator handles permitted response content without configuring a campaign or publishing its aggregated results. |
| **Publish feedback results** — `FAMILY_FEEDBACK_PUBLISH` | N | A principal releases privacy-eligible results without editing campaign settings or moderating individual responses. |

### Conversations

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View school enquiries** — `SCHOOL_MESSAGES_READ` | N | An enquiries observer reviews the shared inbox without sending replies or inspecting teacher-private conversations. |
| **Reply to school enquiries** — `SCHOOL_MESSAGES_REPLY` | N | An enquiries responder reads and answers school conversations with explicit inbox read access, without teacher-message oversight. |
| **Review teacher conversations** — `TEACHER_MESSAGES_REVIEW` | N | An oversight officer inspects eligible teacher conversations without impersonating participants, replying or altering their read state. |

### Announcements

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View announcement administration** — `COMMUNICATION_READ` | N | A communications observer reads drafts and delivery administration without editing content or sending announcements. |
| **Manage announcement drafts** — `COMMUNICATION_DRAFT_MANAGE` | N | An editor creates, corrects and removes drafts without sending them to any audience. |
| **Send to selected classes** — `COMMUNICATION_SEND` | C | A class supervisor sends prepared announcements to covered classes without school/all-staff/direct-recipient broadcast authority. |
| **Send school broadcasts** — `COMMUNICATION_SEND_BROADCAST` | N | A central dispatcher sends prepared broad announcements without draft-editing authority; all-classes send authority cannot substitute for this unscoped capability. |

### Resources and attachments

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View resource inventory** — `RESOURCE_READ` | N | An inventory observer browses shared equipment/rooms without changing inventory or seeing unrelated private bookings. |
| **Manage resource inventory** — `RESOURCE_CONFIGURE` | N | An inventory custodian maintains equipment/rooms without assigning reservations or administering activities. |
| **Inspect authorized attachments** — `ATTACHMENT_READ` | N | A records inspector uses the standalone file surface for otherwise eligible source-bound files without uploading, replacing or deleting them. |
| **Manage authorized attachments** — `ATTACHMENT_CONFIGURE` | N | A records clerk maintains otherwise eligible source-bound files without changing the academic/health/financial records they attach to; source/owner checks remain mandatory. |
| **Create activity definitions** — `ACTIVITY_CREATE` | N | A program coordinator creates an initially unplaced activity without gaining authority to alter every existing activity. |
| **Manage activity participation** — `ACTIVITY_ENROLLMENT_MANAGE` | A | An admissions clerk approves/withdraws participants for an assigned activity without rewriting its schedule or changing class enrollment. |
| **Manage activity programs** — `ACTIVITY_MANAGE` | A | An activity leader edits and schedules an assigned program without approving or withdrawing its participants. |
| **View activities** — `ACTIVITY_READ` | T | An activity observer sees covered details and permitted participants without editing the program or admitting students. |
| **Manage resource bookings** — `RESOURCE_ASSIGNMENT_MANAGE` | T | A session coordinator reserves or reallocates resources for covered occurrences without maintaining the shared inventory or other activities. |
| **View resource bookings** — `RESOURCE_ASSIGNMENT_READ` | T | A reservations observer reads covered bookings without moving equipment or changing inventory. |

### Query surfaces

| Capability and identifier | Scope | Why it remains separate |
|---|---|---|
| **View class rosters** — `CLASS_READ` | C | A roster coordinator browses class membership and minimal identifiers without full student contact dossiers, health or notes. |
| **View overdue balances** — `OVERDUE_BALANCE_READ` | L | A collections assistant follows covered overdue debt without seeing full payment/receipt history or school reconciliation totals. |

## Platform catalog

| Capability and identifier | Boundary |
|---|---|
| **Register schools** — `PLATFORM_REGISTER_SCHOOL` | An admitted bootstrap/operator flow provisions a school without managing operator accounts or platform integration keys. |
| **View platform operators** — `PLATFORM_USER_READ` | A platform auditor inspects operators without creating or deactivating them or managing client credentials. |
| **Manage platform operators** — `PLATFORM_USER_MANAGE` | An operator administrator provisions/deactivates bounded accounts without managing S2S credentials or self-deactivation. |
| **View platform integration clients** — `S2S_CLIENT_READ` | A platform integration auditor lists clients without creating, rotating or revoking their credentials. |
| **Manage platform integration clients** — `S2S_CLIENT_MANAGE` | A platform integration administrator owns client credentials without operator-account management or school service-account maintenance. |

## Intrinsic access — absent from staff permission pickers

| Capability and identifier | Boundary |
|---|---|
| **View own guardian identity** — `GUARDIAN_SELF_READ` | A guardian reads their own permitted identity fields without accessing the staff guardian directory or another guardian. |
| **Read own communications** — `PERSONAL_COMMUNICATIONS_READ` | A selected recipient accesses their own inbox without announcement administration or another profile's inbox. |
| **Open own workspace** — `WORKSPACE_ACCESS` | An active selected profile loads minimal workspace context and domain-filtered dashboard cards without gaining any business read authority. |

## Consolidations from the first proposal

Names on the left include proposed names that never existed in runtime. Every existing runtime identifier still has its own disposition in the [full matrix](permission-matrix.md). No automatic grant migration is implied.

| Previous proposal capabilities | Revised capability | Decision |
|---|---|---|
| `SCHOOL_STRUCTURE_CONFIGURE`, `SCHOOL_SETTINGS_UPDATE`, `CALENDAR_MANAGE` | `SCHOOL_CONFIGURE` | A school setup administrator maintains structure, ordinary settings and calendars; lifecycle release remains a separate sign-off. |
| `STAFF_CREATE`, `STAFF_UPDATE`, `STAFF_ARCHIVE` | `STAFF_MANAGE` | Hiring, correcting and deactivating human staff records are one workforce maintenance capability; access grants and service credentials remain separate. |
| `ACCESS_CONTROL_CONFIGURE`, `ACCESS_CONTROL_ASSIGN` | `ACCESS_CONTROL_MANAGE` | Editing an applied profile can change effective authority just as assigning it can; one access-administration capability avoids a misleading template-versus-assignment boundary. |
| `SERVICE_ACCOUNT_CREATE`, `SERVICE_ACCOUNT_UPDATE`, `SERVICE_ACCOUNT_REVOKE`, `SERVICE_ACCOUNT_ROTATE_KEY` | `SERVICE_ACCOUNT_MANAGE` | One human integration administrator owns provisioning, metadata, rotation and revocation; machine callers and read-only auditors remain excluded. |
| `ACADEMIC_PROGRAM_CREATE`, `ACADEMIC_PROGRAM_UPDATE`, `ACADEMIC_PROGRAM_DELETE`, `ACADEMIC_PROGRAM_ASSIGN` | `ACADEMIC_PROGRAM_MANAGE` | Constructing, allocating, correcting and removing a placed curriculum is one coordinator workflow; target containment, not CRUD tokens, bounds its authority. |
| `ACADEMIC_CATALOG_CREATE`, `ACADEMIC_CATALOG_UPDATE`, `ACADEMIC_CATALOG_DELETE` | `ACADEMIC_CATALOG_MANAGE` | Shared subject/matter/category maintenance has one responsible administrator; dependency protection remains an invariant. |
| `STUDENT_UPDATE`, `STUDENT_ARCHIVE` | `STUDENT_MANAGE` | Correcting and archiving an existing student dossier are one registrar maintenance capability, bounded by caseload and complete affected targets. |
| `STUDENT_NOTE_CREATE`, `STUDENT_NOTE_UPDATE` | `STUDENT_NOTE_MANAGE` | An author creates and maintains their own pastoral notes; ownership and visibility restrictions continue to limit edits and deletion. |
| `PARENT_CREATE`, `PARENT_UPDATE`, `PARENT_ARCHIVE` | `PARENT_MANAGE` | A registrar maintains shared guardian identities, child links and portal-access status through one capability; child-scoped contact reads and staff access administration retain independent boundaries. |
| `ENROLLMENT_CREATE`, `ENROLLMENT_UPDATE`, `ENROLLMENT_ARCHIVE` | `ENROLLMENT_MANAGE` | Admission, transfer and withdrawal are one class-placement workflow; source and destination coverage constrain changes. |
| `DISCIPLINE_UPDATE`, `DISCIPLINE_ARCHIVE` | `DISCIPLINE_MANAGE` | Official incident content corrections and cancellation/cleanup belong to the class supervisor; reporting and adjudication remain separate responsibilities. |
| `ATTENDANCE_UPDATE`, `ATTENDANCE_JUSTIFY` | `ATTENDANCE_MANAGE` | Register maintenance includes corrections, removal and recording an explanation; approving an explanation or submitted teacher correction stays separate. |
| `EXAM_CONFIG_CREATE`, `EXAM_CONFIG_UPDATE`, `EXAM_CONFIG_DELETE` | `ASSESSMENT_MANAGE` | A subject coordinator maintains draft assessments through one capability; marks, review state and shared grading scales stay separate. |
| `GRADE_INPUT`, `GRADE_UPDATE` | `GRADE_MANAGE` | Entering, editing and submitting draft marks are already alternatives in the same workflow; retain one authoring capability and a separate correction reviewer. |
| `CLASS_LOGBOOK_CREATE`, `CLASS_LOGBOOK_UPDATE` | `CLASS_LOGBOOK_MANAGE` | Recording and correcting draft lesson progress are one subject author workflow; review and pastoral notes remain independent. |
| `TIMETABLE_CREATE`, `TIMETABLE_UPDATE` | `TIMETABLE_MANAGE` | Class scheduling includes creation, rescheduling and removal; whole-school calendar and activity definition administration have different target boundaries. |
| `COMMUNICATION_CREATE`, `COMMUNICATION_UPDATE`, `COMMUNICATION_DELETE` | `COMMUNICATION_DRAFT_MANAGE` | A communications editor owns draft creation, correction and removal; sending remains a deliberate separate release capability. |
| `TIMETABLE_READ`, `CALENDAR_READ` | `TIMETABLE_READ` | Viewing a class schedule includes its applicable calendar; a separate calendar-query permission provides no demonstrated independent responsibility. |
| `CLASS_LOGBOOK_READ`, `CURRICULUM_PROGRESS_READ` | `CLASS_LOGBOOK_READ` | Subject progress is the read projection of the same lesson logbook workflow; one scoped observation capability covers both. |
| `WORKSPACE_ACCESS`, `DASHBOARD_READ` | `WORKSPACE_ACCESS` | Opening the dashboard needs no assignable permission once every card enforces its own business read authority. |
| `PLATFORM_USER_CREATE`, `PLATFORM_USER_DEACTIVATE` | `PLATFORM_USER_MANAGE` | An operator administrator owns account provisioning and deactivation; read-only inspection, self-protection and bounded delegation remain distinct. |
| `S2S_CLIENT_CREATE`, `S2S_CLIENT_REVOKE`, `S2S_CLIENT_ROTATE_KEY` | `S2S_CLIENT_MANAGE` | A platform integration administrator owns a client credential lifecycle; read-only inventory access and school-service administration stay separate. |

## Review and implementation gate

Review the retained View/Manage boundaries, capture-versus-maintenance duties, independent review/publication, unplaced-record creation and platform maintenance breadth. In particular, A07 still proposes a publisher handoff after comment approval; A16 approves broader routine maintenance; A17 validates the remaining specialist/observer workflows; A18 preserves portal/job operations and delegated authority.

The [matrix](permission-matrix.md), [exact metadata](permission-matrix.json), [technical specification](target-specification.md), and [ordered backlog with SC-01–SC-28](implementation-plan.md) describe the same target. Runtime implementation and development/staging permission resets follow review. Production deployment and unrelated data deletion remain outside scope.

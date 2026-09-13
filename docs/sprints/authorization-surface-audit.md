# Authorization surface and acceptance audit

This audit supports [the clean implementation plan](authorization-clean-implementation.md). It records the intended boundaries, the complete resource inventory and inspected allowed/denied evidence. Implementation and development verification are complete; final results and operational release boundaries are recorded in the plan. Runtime rules live in the authorization package; this document is not a second permission catalog.

## Enforcement inventory

| Surface | Enforcement path | Evidence |
| --- | --- | --- |
| REST and GraphQL entity reads/writes | API entity dispatch → `ManagedEntityService` → action-bound `EntityAccessPolicy` → repository `forAccess` | Native tenant, action-isolation, before/after placement and batch rollback tests; API entity tests. All 55 resources are reconciled in the inventory below, including the five direct-resource families completed in the final review. |
| Commands | School command catalog → workflow → business policy and scoped repository or managed entity, inside atomic execution | Named-action caller guard passes. The transport caller-kind flags and gate are deleted. Native tests prove direct/REST/GraphQL parity for all previously restricted commands and the adjacent delivery-record command; business policies preserve machine, signed-event and internal publication paths. |
| Overview, shell counts and finance/report counts | Named overview/finance/report policy → scoped repositories before aggregation | `query-services.test.ts`; foreign context and unrelated grants denied. |
| Class timetable and availability | Class timetable policy assertions; event repositories are scoped; availability receives an explicit class/year/period/calendar repository set | `authorization-policies-pglite.test.ts`, `query-services.test.ts`, timetable integration tests. Availability has staff/teacher/guardian/student, counts, ancestor-calendar and revocation coverage. |
| Documents and attachment content | Named report-card/logbook/file policies, published-source and owner scope checks | Native API report-card/logbook/file tests; cached objects require fresh access. |
| Identity linking and invitations | Identity/invitation policies; exact school/profile; transaction with business ownership validation | Native identity linking, invitation lifecycle, expired/stale invitation and rollback tests. |
| Manual permissions and staff assignments | Human staff administration, typed target validation, same-action/year/validity delegation | Assignment/delegation tests. Both old and proposed service-account targets are excluded from ordinary staff administration. |
| Service accounts | Dedicated create/update/revoke/rotate policies and transactions | Service-account lifecycle/delegation/assurance tests; generic edit/delete/grant bypass tests added in this continuation. |
| Platform and S2S accounts | Explicit platform actions or live school-bound S2S access class | Native platform/S2S provision and scope tests. Native SQL cases verify live permission changes, bounded delegation, revoked S2S keys, read/write distinctions, cross-school denial and selected-profile isolation; the API suite verifies credential and profile admission. |
| Personal communications | Exact selected login/profile tuple and current source audience | Native inbox, contact and delayed-dispatch tests; web/mobile profile-switch tests. |
| Delayed delivery | `notify-adapter` notification policy before each channel; one durable dispatcher; Novu email and FCM transports | Native dispatch, receipt and transport tests; no subscriber profile/permission synchronization. |
| Scheduled jobs and fixtures | Named system action sets with school scopes; normal invariants | Cron/API tests, explicit fixture-note policy, native queue/concurrency and seeding suites. |
| Migration and client displays | Offline typed grant conversion; clients consume projections of current facts | Migration rejection/meaning-preservation tests, generated artifact drift, web/mobile checks. The runbook specifies offline migration, explicit rejection, matched releases and matching application/data/queue rollback; operational rehearsal remains a release step. |

## Intended actor/action/resource decisions

| Business action | Allowed resource boundary | Required denials |
| --- | --- | --- |
| Grade reads | Same-action scoped staff; current subject teacher or homeroom class; family student's published results | Other subjects for subject-only teachers; unrelated students/classes; foreign school; unpublished family results |
| Grade input/update | Appropriate distinct action, subject teaching assignment or typed staff scope; assessment and student together | Read grants contributing write scope; homeroom-only input; reassignment outside either existing or proposed placement; partial batches |
| Report comments/publication | Subject comments for subject teachers, homeroom comments for homeroom teachers; publication requires its full staff policy | Editing marks through a comment; changing published results; generating documents with comment authority |
| Attendance | Subject teacher session capture; homeroom daily capture; staff action scope | Correcting or validating using capture alone; unrelated subject/session/student; cross-school anchors |
| Logbooks and progress | Current subject assignment or staff scope; related snapshot and aggregates together | Homeroom-only subject writes; another subject; combining different action scopes; partial aggregate writes |
| Finance | Scoped staff action; family reads of linked students' permitted fees/payments | Family writes; read authority used to cancel/reverse; unrelated balances and aggregate leakage |
| Guardian contacts/preferences | Selected guardian's contacts/photo; notification opt-outs on their existing links | Name, identity, account-access or relationship-rights changes; creation/deletion; reassignment; shared-login staff privilege inheritance |
| Staff profile lifecycle | Staff action scope, excluding service-account administration; actor-independent owner safeguards | Self-deactivation/deletion; generic identity relinking; ordinary staff lifecycle used for service accounts |
| Ownership | Current human owner may transfer; business validation rejects removal or assigning an owner of another school | Non-owner/service/job transfer; stale previous owner authority; bypass through direct entity saves |
| Staff permission delegation | Caller holds the requested action, typed placement, year and validity; owners have explicit authority | Different action contributing scope; invalid parents/year; longer-lived or broader authority; service-account targets through ordinary staff commands |
| Service-account administration | Dedicated human/owner policy, bounded grants and key lifecycle | Generic profile/grant/deletion bypass; non-owner management of elevated accounts; insufficient assurance; other school |
| Communications | Personal exact-profile inbox/current audience; sends authorize all targets | Login-only cross-profile inbox; unpublished/expired content; class scope used for school/direct broadcasts; stale queued eligibility |
| School structure/lifecycle | Structure and lifecycle actions checked separately, together when both change | Structure permission used to publish; lifecycle permission used to reconfigure unrelated fields; cross-school context |
| Discipline | Same-action incident and student scopes; subject/homeroom distinction; validate/archive actions for status changes | Native discipline tests cover unrelated lessons, years, foreign records, mixed mutations and batches, profile isolation and removed teaching. |
| Resources | School-grain action and year with exact class/occurrence placement; mandatory reservation invariants | Native resource tests cover foreign/old placements, read/write isolation, expiry, every overlap ordering, batch rollback and valid adjacent/untimed reservations. |

## Findings resolved in this continuation

- Guardian preference commands could not pass the final write policy and discarded notification overrides. They now submit preserved state to the self-service policy, with field restrictions enforced for commands and direct saves.
- Self-deactivation lived in entity business validation, while self-deletion remained possible. Both decisions now belong to policy; actor-free business gates retain owner and dependency invariants.
- School ownership invariants were checked only in selected commands. Shared validation now covers direct managed saves and invitation claims too.
- Ordinary staff deletion and permission administration could bypass service-account lifecycle policy. Generic edits, deletion, grants and assignment writes reject service targets; dedicated commands remain authoritative.
- The external Novu gateway duplicated recipient/preferences and dispatch decisions. Those gateways, mappings and synchronization hooks are deleted; Novu is a transport under the existing durable dispatcher.

Discipline/resources now have native adversarial coverage. Production services and routes no longer assemble generic permission checks; source guards enforce action-bound policy calls. Named internal actors have an exhaustive action-vocabulary test with tenant denials. Resource and privileged-actor evidence is reconciled with the acceptance criteria below. The plan records coordinated verification separately from operational deployment.


## Split actor restriction resolved

The REST/GraphQL caller-kind gate and five registry flags have been deleted. Business policies now own admission and canonical-action resource checks for invitation acceptance, curriculum imports, direct delivery materialization and provider events. Human publication has a private materialization path under its send policy. Direct/workflow and real REST/GraphQL cases verify matching allowed/denied decisions; service revocation, scoped imports and missing-record retry denials are covered. Current source guards prohibit reintroducing the removed transport mechanism.


## Acceptance evidence reconciliation

This table reconciles each acceptance requirement with inspected evidence. File names refer to the native test suites unless noted otherwise; a checked code path alone is not exhaustive actor/action coverage.

| Acceptance requirement | Inspected implementation and evidence | Current disposition |
| --- | --- | --- |
| One action vocabulary and identity-only actors | `actor-metadata`, `authorization-migration-guards`, exhaustive `system-action-boundaries`; production action assembly and old transport gates are prohibited | Implemented; retain source guards in final verification |
| Manual grants and assignments have one authoritative representation | `assignment-authority`, `typed-staff-grants-migration`; `AccessFacts.staffGrants` reads each business fact directly | Implemented; migrated wildcard grants now also exercised through native result/exam queries |
| Different actions cannot lend one another scope | Native grade/input, before/after alternative-action, curriculum and delegation cases | Finance mixed status/detail saves exposed an additional gap; correction and native tests added in this checkpoint |
| Expiry, revocation, year and profile selection | Native grades, portal resources, service accounts, guardians, discipline, resources, delayed dispatch; `AccessFacts` is evaluation-local | Covered across these policy families and the final health, availability, activity and shared-curriculum native cases; privileged actor evidence is included below |
| Subject teacher versus homeroom | Native grade input/read, daily/session attendance, report comments, documents and logbooks | Distinct policies and current assignment facts inspected |
| List, single, count, pagination and aggregation | `PostgresStore.scopedWhere` applies SQL predicates before limits; native grades, overdue fees, portal finance, timetable availability, discipline/resources and documents | Shared repository semantics inspected; specialized query evidence listed above |
| All existing/proposed and batch write resources | `ManagedEntityService` preflights all targets in its transaction; native mixed-class batches, discipline, resources, curriculum and service-account administration | Shared mutation path inspected; finance combined mutations and all-consumer curriculum writes have additional native regression coverage |
| Owner, service/job, assurance and publication | Native owner transfer, generic service-account bypass, dedicated lifecycle/delegation/assurance, platform/S2S, job matrix, report/publication and six-command REST/GraphQL parity | Review found ordinary delivery saves bypassed restricted provider-event admission. Direct saves/imports now enforce machine admission too; direct/REST/GraphQL single/batch parity (67 assertions) and publication/read-receipt workflow regressions pass |
| Migration meaning and rejection | Typed-scope, guardian details, notification source/contact migration suites; converted valid wildcards retain query meaning and expire immediately | New migrated-query case passes; legacy persisted student scopes remain rejected because the prior grant model prohibited them |
| Replaced mechanisms deleted | Production source guards plus current architecture and cutover guidance | Cross-repository scan: 888 backend, 1,008 web and 192 mobile production files; no replaced mechanism references. Backend source guards prohibit the deleted evaluator, translations, duplicate state, caches and caller-kind transport gate |
| Backend, integration, contracts, web and mobile | Previous coordinated checkpoints are recorded in the plan | Final results are recorded in the implementation plan; resource inventory and privileged-action review are reconciled here |


## Direct-resource review scope

The final review targeted `gradeLevelSubjectMatters`, `activityEnrollments`, `classActivityEnrollments`, `teacherUnavailabilities` and `studentHealthProfiles`. Their earlier business-gate and generated-client positive tests were insufficient to establish action, tenant, year and selected-profile boundaries. The native tests below close those identified gaps; generated-client integration still supplies transport/contract coverage.


## Direct-resource matrix closure checkpoint

`remaining-resource-policies.test.ts` now contains 19 native database cases. Together with nine existing academic workflow cases, all 28 tests pass. The earlier fixture-only gaps above have the following concrete evidence:

| Resource family | Native allowed/denied evidence |
| --- | --- |
| Student health | General student access cannot read health records; explicit health read/update actions, school-wide grain, counts/pagination/single parity, foreign targets, immutable student assignment, batch rollback, expiration and selected-year grant isolation. Teacher/guardian/student profiles cannot inherit the same login's owner/health grants; a non-elevated service account requires its own current grant. |
| Teacher availability | Teachers can read their own historical/current rules, excluding unrelated and foreign teachers, but cannot mutate constraints. Deactivation revokes reads. Staff read authority cannot administer rules; assignment authority covers old/proposed year, foreign teachers, batch rollback and expiration. |
| Student activity enrollments | Read/create/update/archive actions remain distinct; both activity and student stay in-school; mixed batches roll back. Guardian/student reads include their own enrollment statuses, with counts/pagination parity and immediate family-link removal. Same-login owner/staff grants do not permit family writes. |
| Class activity enrollments | Read alternatives preserve their separate class scopes; neither can lend placement to writes. Existing/proposed classes and years, foreign activities and batch writes are checked. Homeroom and family class reads exclude unrelated classes; subject-only teachers receive no class-activity access; homeroom removal revokes access. |
| Grade-level chapters and other shared curriculum | Native linked-class reads/counts/pagination, teacher/family isolation, revoked teaching, foreign records, create/update/delete distinctions, expiration and mixed-batch rollback. Separate cases verify shared subject, chapter and grade-allocation edits require the update action for every affected class. |

The tests exposed three implementation defects and failed before correction: family activity SQL used the nonexistent enrollment state `active`, a shared grade chapter could be updated through authority over only one consuming class, and class-scoped activity reads lacked their SQL relationship path. The SQL now uses the canonical approved enum. Shared curriculum mutations check all affected classes for the complete canonical action, covering old/proposed records and deletion. Class-scoped activity reads now include assigned and genuinely school-wide activities, requiring an existing class in the authorized year. Native assertions exclude unrelated classes, foreign activities, old-year links and dangling class grants, including all-class scopes. No alternative evaluator or persisted scope state was introduced. See the implementation plan for final broad verification after these corrections.


## Complete resource inventory reconciliation

The following groups enumerate all 55 keys in the current entity policy catalog exactly once. The native policy suites exercise the action-bound entry points and SQL predicates; business-gate tests supplement those checks but do not replace them. Specialized query, command, transport, job and client evidence is recorded in the enforcement and acceptance tables above.

| Family | Resource keys | Evidence inspected |
| --- | --- | --- |
| Curriculum | `classSubjectMatters`, `classSubjectProgress`, `classSubjects`, `gradeLevelSubjectMatters`, `gradeLevelSubjects`, `subjectMatters`, `subjects` | Native curriculum scope/action and mirrored-aggregate rollback cases; remaining-resource shared-placement cases; academic workflows |
| Identity and staff administration | `accountInvitations`, `staffAssignments`, `staffMembers`, `staffPermissionAssignments`, `teacherAssignments`, `teacherUnavailabilities`, `teachers` | Invitation, ownership, assignment/delegation and service-account native suites; teacher self/administration cases; REST/GraphQL command parity |
| Assessments and marks | `assessmentResults`, `assessments` | Native grade read/input/update, subject/homeroom, family publication, reassignment and mixed-batch cases |
| Report cards | `sections`, `definitions`, `results`, `gradeScales` | Native report/portal comments and publication cases, rendering and cached-attachment denial; grade-scale business gates |
| Finance | `fees`, `payments`, `studentFees` | Native overdue and portal finance scopes; distinct payment/fee actions, combined-mutation denials, workflow rollback and real PostgreSQL concurrency |
| Communications | `announcementTargets`, `announcements`, `messageDeliveries`, `schoolNotificationTemplates` | Native audience, exact-profile receipts, contact preferences and delayed dispatch; machine write parity; notification-template isolation |
| School structure | `schools`, `academicYears`, `academicPeriods`, `gradeLevels`, `classGroups`, `periodDefinitions` | Lifecycle/structure action isolation and owner invariants; native scope/year tests; setup and tenant-boundary integration |
| Timetable | `activitySessions`, `calendarEvents`, `lessonSessions`, `schedules` | Native subject/homeroom event scopes and availability counts; scheduling/generation lifecycle; before/after and batch reservation cases |
| Attendance | `attendance`, `attendances` | Distinct capture/correction/justification/validation policies; subject-session versus homeroom-daily capture; mixed-roster rollback |
| Resources | `resourceAssignments`, `resources` | Native year/tenant/read/write/profile cases; complete placement and batch checks; all conflict orderings and business invariants |
| Activities | `activities`, `activityEnrollments`, `classActivityEnrollments` | Native approved family visibility, exact enrollment identity, action isolation, foreign/mixed batches, homeroom versus subject and live revocation |
| Students | `students`, `enrollments`, `studentNotes`, `studentHealthProfiles` | Native student lifecycle, enrollment targets, author/visibility and fixture-note policies; health access/profile/service matrix and batch rollback |
| Guardians | `guardians`, `guardianLinks` | Native contacts/relationship self-service, own-action linking, school/enrollment invariants, same-login isolation and current relationship revocation |
| Discipline | `incidents`, `studentIncidentInvolvements`, `studentDisciplinaryActions`, `disciplinaryActions` | Native incident and student scope conjunction, subject/homeroom and year distinctions; validate/archive/combined action cases and atomic resolution |
| Files | `attachments` | Native owner-specific file scopes, personal/foreign/sensitive restrictions; published report/grade attachments and fresh download authorization |

Inventory reconciliation: 55 unique keys; no missing or extra key relative to `entity-policies.ts`. No new migration or API shape is required for the activity-status or shared-curriculum corrections. Final backend, seed, integration, generated-contract, web and mobile results are attached to the completed implementation plan.


## Seed identity and delivery reconciliation

The seed acceptance run additionally verifies central identity linking precedes publication, unlinked profiles receive no inbox rows, and explicit history applies to the single persisted source/profile delivery. Existing bootstrap staff identities are retained. Seeding uses the same managed reads, delivery-event commands and write policies as other callers; it does not bypass the unique delivery key or reintroduce placeholder recipient identities. Final verification is recorded in the plan.

# Permission target specification

Status: **implemented locally**; see the [runtime cutover record](runtime-cutover.md) for verification and release boundaries. The [matrix](permission-matrix.md) supplies the per-permission choices; [structured rows](permission-matrix.json) supply exact metadata for all 90 active target actions. The [reduced catalog and separation cases](reduced-catalog.md) is the review entry point. Retired, renamed, merged and withdrawn proposal identifiers are not accepted aliases after cutover. This revision has 82 staff-assignable permissions, five platform permissions and three intrinsic relationship capabilities.

## 1. Canonical catalog and public contract

Move assignment eligibility and scope capability into a complete core-owned definition for every canonical permission. Authorization consumes it; the service/API and generated clients project it. Core must not import authorization or service packages. Definitions are exhaustive, not a partial override map with implicit school-wide fallback.

Replace `PermissionCatalogEntry.scope?: ScopeType` with:

```ts
type ResourceScopeKind =
  | 'grade_level' | 'grade_level_subject'
  | 'class_group' | 'class_subject' | 'activity' | 'student';

type ScopePolicy =
  | { mode: 'none' }
  | { mode: 'resources'; allowedKinds: ResourceScopeKind[]; allowAll: true }
  | { mode: 'relationship' }
  | { mode: 'platform' };

type AssignmentTarget =
  | 'class_group' | 'class_subject' | 'lesson_session'
  | 'activity_session' | 'assessment';

interface PermissionCatalogEntry {
  permission: Permission;
  scopePolicy: ScopePolicy;
  staffAssignable: boolean;
  serviceAccountAssignable: boolean;
  s2sAccess: 'none' | 'read' | 'write';
  assignmentTargets: AssignmentTarget[];
  humanOnly: boolean;
  minimumAssurance: 'standard' | 'verified' | 'strong';
}
```

The exact values are each active row's `target_catalog`; do not derive eligibility from a name prefix, permission family, or scope alone. `read` means usable by read or write S2S clients; `write` requires a write client. Both remain subject to caller admission and resource policies. The catalog exposes no credentials or grant decisions. Existing human access to the catalog can remain; the staff UI filters `staffAssignable`, and service-account editors filter `serviceAccountAssignable`.

Scope labels and permission labels continue using the existing i18n system. Neither labels nor API clients hard-code action-specific scope exceptions. Profile selectors, manual selectors, service-account selectors, assignment placement selectors, allowed-scope badges, validation, and previews consume the same definition.

### Consolidation contract: C1–C6

**C1 — One capability, several operations.** Each consolidation in [consolidations.json](consolidations.json) maps directly to one canonical permission. These are actual catalog merges, not additional bundles over hidden CRUD permissions. Permission profiles remain the only bundle mechanism. Create, edit and delete command names may stay unchanged; they call the same capability check and keep their operation-specific field, state, dependency and target checks. A new permission needs a concrete scenario requiring it while denying its nearest existing capability, or an incompatible resource boundary. The [reduced catalog](reduced-catalog.md) records that case for every surviving capability.

**C2 — Reads stay explicit and bounded.** `MANAGE` is not a wildcard and does not automatically imply any `READ` grant. It supplies only the supporting workflow projection described in D-*; full browse/list/count/export surfaces still check their documented read capability. Read-only staff are a real use case, so each retained View capability has an observer example. A profile can explicitly include both. There is no recursive implication graph, no new role rule, and no automatic grant to all successor actions.

**C3 — Scope and operation must both fit.** Merged permissions retain the reviewed target scope rather than accepting the union of every predecessor's old grants. ACADEMIC_PROGRAM_MANAGE supports S selections: creating a new grade-owned allocation requires its grade selection or All grades; creating a new class allocation requires its class/grade authority (or an all-subjects-of-that-class selection). An explicit existing subject grants only that subject and its descendants. A full-class synchronization checks every resulting subject; one mathematics grant cannot authorize a language allocation. Updating a shared grade allocation checks the grade anchor and every affected class. ASSESSMENT_MANAGE preserves exact occurrence assignments: an assessment placement covers that assessment's permitted edits/removal, never creation of a sibling assessment. New assessments require coverage of their proposed parent/occurrence. Scope labels never bypass published-source/dependency protections.

**C4 — Actor and command restrictions survive merges.** Teacher/family profiles do not receive the full staff meaning of a new Manage permission. When several old actions converge, portal policies still distinguish allowed operations and fields. In particular, a teacher authorized to create/update an assessment does not acquire deletion solely because ASSESSMENT_MANAGE includes it for staff. Preserve existing relationship-dependent deletion behavior where it was already allowed; verify it against the current route, rather than grant the merged capability wholesale. The same applies to guardian self-edits, named jobs, bootstrap, elevated service exceptions and integration command admission. Remap command/action pairs, not just action sets. A renderer's export path and a delivery callback's update path never gain human draft deletion. This is policy logic, not a second assignable permission catalog. Catalog metadata uses the strongest existing assurance and human-only restriction among merged actions; operation-level guards may be stricter. Never lower assurance through a merge.

**C5 — Consolidation changes the unit of assignment.** A grant of STAFF_MANAGE intentionally covers create/edit/archive. There is no create-only staff toggle in this target. Its UI description and preview must state the included operations. Deletion still respects self/owner/state/reference protections; permission is not a bypass. First-wins operates on the new identifier: if two profiles formerly provided separate CRUD actions, their consolidated capability may now be claimed once by the earlier profile, including unresolved shadowing. Reseed reviewed profiles accordingly instead of unioning legacy scopes. Manual grants remain additive under the existing rules. ACCESS_CONTROL_MANAGE requires the same delegation constraints when editing an applied profile as when assigning it: check every newly effective action, target and validity interval for affected recipients; a profile edit cannot add authority the actor could not grant directly.

**C6 — Dashboard and platform boundary.** Dashboard entry is part of intrinsic WORKSPACE_ACCESS; every card still requires its business read scope. Platform account create/deactivate converge on PLATFORM_USER_MANAGE, and platform client create/revoke/rotate converge on S2S_CLIENT_MANAGE. Neither is staff-assignable or inferred from school ownership. Their read-only auditors remain separate. In development/staging, reseed reviewed `PlatformUser.permissions` alongside the affected school authorization data; preserve operator identities, active status, keys, school bindings and S2S access classes. Existing operator holders must not automatically receive the broader merged permission. Production rollout remains outside this plan.

### User selections versus resolved authority

Keep the existing typed resource shapes, including `all` with an explicit grain. Introduce a separate user-input schema:

```ts
type UserScopeSelection = Exclude<GrantScope, { kind: 'school' }>;
type ResolvedGrantScope =
  | { kind: 'school' }       // emitted by server for an unscoped action
  | UserScopeSelection;
```

`school` remains a trusted internal representation used by persisted effective grants, owner authority, system policy and SQL. This avoids equating an empty array with unrestricted access and avoids changing all resource-policy internals solely to remove a UI concept. It is rejected in manual assignment `customScopes`, profile binding `customScopes`, and staff default `scopes`. It is not a selectable kind or an effective-scope badge for unscoped actions.

School-wide announcement audiences and calendar placements remain valid business concepts. Remove the permission-selection concept, not those unrelated audience/placement types or their labels.

For ordinary effective staff grants, `scopePolicy.mode === 'none'` requires exactly `[{ kind: 'school' }]`; `resources` requires one or more permitted resource scopes and rejects `school`. Relationship and platform actions cannot be persisted in school manual/profile grants. Exact lesson/session/assessment authority stays in `AuthorityScope`, generated only from live assignments. These are not new manual-scope options.

The effective-grants response retains its current grant fields and scope union. Client display code consults the catalog to suppress scope controls/tags for `none`; it must not infer that a nonempty `school` marker is a user selection. Scope-render requests for effective grants can still accept that marker; selection-render requests use `UserScopeSelection[]` and cannot accept it. For unscoped actions the UI shows the permission without a scope label.

Manual/profile/default command names remain unchanged. Their input schemas change to the new selection type. Manual unscoped writes use `customScopes: []` and normalize `useDefaultScopes` to `false`; nonempty scope input for that action is a validation error. Public generic entity writes to derived `StaffPermissionAssignment` rows are rejected: source commands own their materialization. Service-account grant request validation also accepts an empty resource selection for `none` and materializes the internal marker server-side. It must not preserve a separate school-checkbox path.

`PermissionResolutionReport.changes` still describes added/changed/removed effective grants. `missing_scope` only applies to resource-scoped actions. `shadowed` retains its existing meaning. Status/expiry warnings remain whatever current workflows already expose; the audit does not create a new status system.

## 2. Exact scope semantics

| Matrix code | Allowed user kinds | Intended use |
|---|---|---|
| N | None | Assigned action needs no resource selector; school and existing year/validity rules still apply. |
| C | `grade_level`, `class_group` | Whole-class/cohort responsibility. |
| S | `grade_level`, `grade_level_subject`, `class_group`, `class_subject` | Subject-specific academic responsibility or an explicitly broader cohort. |
| L | `grade_level`, `class_group`, `student` | Student caseload, with resource-specific handling of history. |
| T | `grade_level`, `class_group`, `class_subject`, `activity` | Operational occurrences such as attendance, discipline capture and bookings. |
| G | `grade_level` | Grade-owned configuration/allocations. |
| A | `activity` | Activity definition, schedule or participant administration. |
| R | No manually assignable scopes | Selected-profile identity/relationships; never an empty manual grant. |
| P | No school staff scopes | Platform actions and their existing operator/bootstrap policies. |

### S1 — Combination and validation

Multiple selections form a union for **the same action**. Custom selections add to compatible defaults when `useDefaultScopes` is true. Defaults never supply a permission and never override action eligibility. Duplicate selections normalize deterministically. An explicit all-grain selection subsumes specific selections of that grain; normalization must not erase a different grain's distinct meaning.

An empty resource selection yields no effective grant and a `missing_scope` warning. Malformed IDs, wrong school/year, wrong parent/subject relationships and unsupported manual kinds fail command validation. Missing targets discovered during later resolution yield `invalid_scope` warnings and no authority for those targets. Profile/default editors may retain valid dormant selections that no current permission consumes; preview only reports effective changes. A change to catalog support never converts a dormant selection into school authority.

### S2 — All and future resources

`{kind:'all', grain}` includes current and future matching resources in the same school and relevant academic year. It is not a frozen enumeration and never means school authority. All classes does not authorize school broadcasts, school holidays, platform actions, shared dictionary edits, or full school reconciliation. All students includes same-school student identities, including unenrolled students, with year restrictions on their year-owned records; it does not imply health, note, or guardian-administration permissions.

A grade selection follows all current and future classes assigned to that grade in the selected year. An explicit class follows that class identity; its students change as enrollments change. An explicit student selection follows that student's identity within the granted year for year-owned data. No grant automatically rolls forward into a new academic year.

### S3 — Subject containment

An explicit class-subject requires the correct class parent. Omitting its subject means all subjects of that explicitly named class, including future allocations. A grade-subject requires its grade and year; its authority follows only class-subject allocations for that exact grade-level subject, not every subject in that grade. Omitting the grade subject means all subjects of that grade.

Use the existing `ClassSubject.gradeLevelSubjectId` relation for an explicit grade-subject match. A class subject with no such relation does not inherit authority merely because its `subjectId` has the same value; it needs its own class/subject grant or a broader permitted cohort selection.

For subject-scoped actions, a class/grade selection deliberately includes all subjects in that cohort. A subject-only grant authorizes minimum class/roster reference reads needed for its action, not whole-class operations. In particular, subject attendance is session/assessment attendance, never daily class attendance. Report comment writes check the changed section/subject fields. Shared curriculum writes cannot alter unauthorized allocations through a shared parent; global dictionary mutations use their separate catalog actions.

### S4 — Student membership and historical records

Basic student/health/cashier caseload membership via class/grade uses current active enrollment in the selected year. Losing that membership removes caseload access on the next request. An explicit student grant is the alternative for continuing an individual case.

Historical records with their own placement—enrollments, attendance occurrences, assessments, report results and incidents—are filtered against that record's class/subject/year. Moving a student to class A must not expose their class B history merely because the student master record is now visible. Class B history remains available to an actor authorized for the recorded class B/year; explicit student grants can cover that student's records within their granted year. Payment accounts and health profiles lack a class placement and follow current caseload membership; their broader dossier effect is an explicit A04/A09 review assumption.

Guardian reads return only authorized child links and the minimum shared guardian contact fields needed for those links. An authorized child does not expose unrelated siblings. Shared guardian identity edits/archival remain N. Student creation is N because no placement exists yet. Class enrollment creation uses the proposed destination; transfers require authority for both old and new placements, in one transaction. Narrow enrollment workflows expose only the minimum student identity picker required to choose an eligible same-school student; they do not confer full dossier access.

### S5 — Activity and multiple placements

Activity selection may name an activity, a class, or both, preserving the existing shape. Activity plus class is an intersection. Class-only activity selection covers activities in that class/year; it grants operational access there, not permission to alter a shared activity definition affecting other classes. Whole-definition edits require complete coverage of all affected placements under the same action, or an explicit activity-ID/all-activity grant. Unplaced activity definitions require explicit activity-ID/all-activity authority to manage; creation remains N.

Exact activity-session assignments authorize only that occurrence. They do not expand to the entire activity. Activity enrollment management gets a bounded eligibility picker and participant details necessary for the assigned activity, not student-health/general guardian authority. Existing approved-enrollment requirements remain authoritative for family activity visibility.

### S6 — Delegation and assignment containment

Check the same action, school, year, start/end validity and current relationships on delegation. Grade contains its class; class contains its own subject/occurrences; explicit subject contains only its occurrences; activity contains its sessions, with a class constraint if present. Subject parent traversal must preserve subject identity. A list of all currently known classes does not entitle an administrator to delegate a dynamic grade/all-classes selection that could cover future classes. An unscoped permission requires held unscoped authority for that same action or existing owner authority.

Use each action's exact `assignmentTargets` in the structured matrix. Do not infer placement eligibility from scope alone. Class placement emits class authority, class-subject placement emits exact subject authority, and occurrence placements retain exact session/assessment IDs. `activity_session` enables occurrence-only activity duty; it never permits rewriting the whole activity definition without full target coverage. Existing profile precedence and manual-addition behavior do not change.

### S7 — Reads, mutations and complete targets

The same action's predicates constrain lists, details, counts, aggregates, exports and document contents before pagination. Narrow UI matching is advisory; server policies remain authoritative. Pass class/grade/subject/year context into web checks and conservatively hide context-specific mutation buttons when required parent context is unavailable. Do not use a class-only UI match to treat a subject grant as class-wide write authority.

Alternative actions may authorize a complete mutation, but cannot contribute different halves of it. One action must cover all existing and proposed placements and all affected records. An operation changing separate capabilities requires each capability, such as payment cancellation plus amount editing. Batch operations preflight every target and remain atomic. None/all/relationship changes must preserve owner, service, assurance and actor-selection restrictions.

### S8 — Lifetime and visibility

Maintain active/inactive/expired status, starts/ends dates, selected school/year and revoked-profile checks. No shared cache of permission decisions is introduced. Teacher and family rights come from current teaching, homeroom, guardian links, enrollment and publication rules. A human's staff permission never flows into their guardian/teacher profile. Portal field restrictions and published/submitted-only reads survive merges of query aliases.

## 3. Supporting reads and special workflows

Supporting reads are bounded projections inside the named workflow. They are not automatically persisted `*_READ` grants and cannot be used as a general directory/export API. Full read actions remain necessary for separate browse screens, including the surviving read-only workflow examples in the reduced catalog. Profile templates may explicitly include those full reads where the job requires them.

| Dependency code | Exact supporting data permitted for the operation |
|---|---|
| D-reference | Selected school identity and current year/period reference values; full editable structure needs its explicit action. |
| D-admin | Administration target identity and current grant/profile/assignment information required by the authorized command. Access administration requires held authority for each delegated action, including changes to applied profiles. |
| D-academic | Covered class/grade/subject allocations, applicable grade-scale definitions and minimal roster identity. Shared dictionary reference reads cannot be used to mutate the dictionary. ACADEMIC_CATALOG_READ explicitly allows the full shared dictionary, including unused definitions; catalog write workflows get the target dictionary context they need. |
| D-student | Covered basic student identity/enrollment context. Health and notes each require their own action; health-write can read the record it edits only. |
| D-guardian | Authorized child-link subset and necessary shared contact fields; no unrelated siblings or identity/access updates through read. |
| D-enrollment | Source/destination classes, year, eligible student identity, and affected enrollment records; no full student dossier or health record. |
| D-discipline | Complete affected incident, participants, authorized student identities and applicable sanctions; read/field access bounded by the incident operation. |
| D-attendance | Covered roster, occurrence/daily anchor, existing record, justification/correction data; subject-only grants cannot load other sessions as daily authority. |
| D-grades | Covered assessments, roster, scale, result/revision and correction context; no unrelated subject marks. |
| D-reports | Covered report, applicable definition, permitted marks/comment context, publication state and required document assets. Comment-author reads exclude unrelated subject marks unless separately readable. |
| D-logbook | Covered lessons, subject curriculum, progress and correction context; no student notes through a logbook action. |
| D-timetable | Covered class schedule, applicable period grid and ancestor calendar; available resource labels exclude unrelated private bookings. |
| D-finance-config | Shared service/pricing catalog and validation dependencies; historical charge/payment effects need financial transaction actions. |
| D-finance | Covered student identity, account, relevant charges/payments and allocation context. Full reconciliation/aggregates require FINANCIAL_REPORT_READ. |
| D-documents | Issuance and permitted source context; attachment owner/purpose and current source eligibility remain mandatory. |
| D-feedback | Authorized campaign/moderation data with existing anonymity and publication thresholds. Portal participation stays in its existing dedicated workflow. |
| D-conversations | Authorized conversation and participant eligibility. Reply additionally requires read; oversight never changes participant state or replies. |
| D-announcements | Sender may read the specific centrally prepared announcement and complete audience needed for publication. No general draft-directory read is implied. |
| D-resources | Applicable resource labels/availability and complete booking/activity placement. Activity participants are exposed only for the activity duty; files also require owner/purpose checks. |
| D-query | Use the replacement business action's dependency set. Intrinsic self actions expose only selected-profile information. Dashboard uses the explicit card map below. |
| D-platform | Active selected operator/client records needed by the platform command, with bounded delegation and no self-deactivation. |

### M1 — Machine and intrinsic capability rules

Replace S2S prefix/suffix classification with the exact catalog's `s2sAccess`. Preserve active-client, school binding, read/write access class and named integration-command admission. `none` is denied even to write-class S2S clients. Service accounts use only `serviceAccountAssignable`; a service caller cannot acquire a human capability simply because a profile contains it.

Preserve current elevated-service exceptions for `ACCESS_CONTROL_MANAGE` and `FAMILY_FEEDBACK_CAMPAIGN_MANAGE` only through their existing privileged path. Ordinary service-account assignment remains false for these. Preserve the current elevated service-account management assurance exception without broadening actor eligibility. Keep named system action lists explicit, remap their removed identifiers, and add only needed replacements: document render uses report export for report-document creation, notification jobs use calendar/timetable/exam reads, cleanup retains attachment configure, bootstrap retains the admitted school registration/setup/lifecycle operations and intrinsic workspace context. A merged permission does not expand a named job’s admitted operations (C4). Systems never gain all new actions merely because an enum expanded; fixture-seed remains the deliberately privileged fixture identity.

`WORKSPACE_ACCESS` derives from an active selected human profile and admitted bootstrap/system needs. `PERSONAL_COMMUNICATIONS_READ` derives from the selected human recipient; only the existing named delivery systems use its system path. `GUARDIAN_SELF_READ` derives from the selected guardian. These actions are excluded from staff profiles/defaults/manual grants, service-account grants, and ordinary S2S access.

### Dashboard card map

Dashboard entry is intrinsic to `WORKSPACE_ACCESS`; it is not an additional staff assignment. Intersect every card with its business read scope: students → STUDENT_READ; guardians → PARENT_READ; staff/teachers → STAFF_READ; finance charges/payments → PAYMENT_READ, with whole-school financial summaries requiring FINANCIAL_REPORT_READ; reports → REPORT_CARD_READ; incidents/sanctions → DISCIPLINE_READ; attendance → ATTENDANCE_READ; assessments → ASSESSMENT_READ; marks → GRADE_READ; enrollments → ENROLLMENT_READ; calendar → TIMETABLE_READ; classes → CLASS_READ; activities → ACTIVITY_READ; academic periods → minimal workspace references. A card with no corresponding authority is omitted, not counted from unrestricted repositories. Aggregate combinations are unions only within the same action.

### Report comment handoff

`REPORT_CARD_COMMENT` changes only authorized comment fields on draft reports; existing teacher subject/homeroom restrictions remain. Staff comment scope also checks each changed section. It cannot modify marks or publication fields.

REPORT_CARD_CONFIGURE owns grade definitions/sections and no longer deletes individual results. REPORT_CARD_GENERATE owns draft calculation, replacement and cleanup/deletion; it cannot delete published results. REPORT_CARD_PUBLISH owns publication transitions and the explicit approved-correction application described below, not arbitrary draft content edits. Direct entity writes must enforce the same field/state boundaries as commands, requiring each applicable capability for combined changes.

`REPORT_CARD_REVIEW_COMMENTS` owns correction review. For an already-published report, approving a correction stores the approved proposal and expected source version without changing the official snapshot or issuing a replacement document. Extend correction status with `approved_pending_publication` for this workflow. Add a publisher command `publishApprovedReportCommentCorrection({ requestId, correctionId, expectedVersion })`; it requires REPORT_CARD_PUBLISH for the complete report and revalidates scope, version, approved proposal and current eligibility in the command transaction. A stale source returns a conflict and keeps the correction unissued until reviewed against the current version.

That command reuses the existing versioned replacement/document pipeline. Publication may request its required document as part of the publication action without a separately assignable export grant; the trusted document renderer acts under named system authority. Standalone generation/download of official published report documents requires REPORT_CARD_EXPORT for staff. This explicit business-operation dependency is not an alternative generic permission check. Families retain their current eligible published-document downloads through relationships. Teachers retain their existing operational document templates; report export does not become a teacher grant.

Report export alone cannot publish results or apply pending corrections. Review alone cannot request a published replacement. Family visibility remains on the last ready revision until the publisher's replacement is ready. Existing request-id idempotency and failure behavior apply; failures do not expose the proposed revision.

### Shared configuration, timetable and activity boundaries

SCHOOL_CONFIGURE owns class/term structure, ordinary school settings, notification templates, issuance branding and calendar maintenance. Academic year/period publication transitions retain SCHOOL_LIFECYCLE_MANAGE. A school setup administrator cannot release a year; a combined setup-plus-state write requires both capabilities.

Shared `subjects`, `subjectMatters` and `subjectCategories` mutations use ACADEMIC_CATALOG_MANAGE. ACADEMIC_CATALOG_READ permits the full shared dictionary including unused definitions; ACADEMIC_PROGRAM_READ exposes only references needed for covered allocations. ACADEMIC_PROGRAM_MANAGE covers creating, updating, deleting and synchronizing placed allocations under C3. Replace the current curriculum school-only gate with the applicable shared-catalog or placed-allocation policy. Grade scales retain GRADE_SCALE_CONFIGURE, independently from ASSESSMENT_MANAGE assessment maintenance and GRADE_MANAGE mark entry.

Calendar mutations use SCHOOL_CONFIGURE; ancestor calendar visibility is read-only and included in TIMETABLE_READ. TIMETABLE_MANAGE owns class lessons/schedules. Activity definitions, sessions and class-activity placements use ACTIVITY_MANAGE, with complete affected-placement checks; activity creation uses ACTIVITY_CREATE and student activity participation uses ACTIVITY_ENROLLMENT_MANAGE. Timetable readers see the authorized activity sessions needed for their schedule, without activity-administration authority. Whole-teacher timetable export loads only authorized class occurrences and verifies complete document contents; it does not call a school-only timetable check or expose unrelated teacher metadata.

ATTENDANCE_RECORD captures permitted daily/lesson/activity occurrences. ATTENDANCE_MANAGE corrects official class registers and records explanations; ATTENDANCE_VALIDATE separately decides explanations and submitted teacher corrections. DISCIPLINE_CREATE reports incidents within occurrence responsibility; DISCIPLINE_MANAGE maintains/cancels official class incidents; DISCIPLINE_VALIDATE decides cases and sanctions. Merging maintenance actions does not turn capture into register maintenance or bypass correction review.

STAFF_MANAGE, PARENT_MANAGE and ENROLLMENT_MANAGE cover routine create/update/removal of their respective business records, with existing identity, relationship and target checks. PARENT_MANAGE includes the existing guardian child-link and family portal-status operations; guardian self-service still cannot change those protected fields, and this capability never assigns staff permissions. STUDENT_CREATE remains unscoped because intake precedes placement; STUDENT_MANAGE edits/archives existing caseload records and does not include health or notes. STUDENT_NOTE_MANAGE preserves author/visibility restrictions. CLASS_LOGBOOK_MANAGE records/edits lessons; CLASS_LOGBOOK_READ includes their curriculum-progress projection. COMMUNICATION_DRAFT_MANAGE owns content maintenance, while scoped class sending and unscoped broadcast remain separate.

## 4. Resolution and UI examples

Resolve profiles in existing year/order, claiming an action before resolving it; an unresolved earlier resource-scoped profile still shadows later profiles. For each claimed N action emit the internal school marker automatically. For resource actions combine compatible defaults/custom selections, validate and normalize them, then emit scopes or missing/invalid warnings. Resolve manual sources separately and retain their current additive behavior and validity. Preview and persistence use this same planning function.

| Case | Before | Proposed result |
|---|---|---|
| Individual ACCESS_CONTROL_READ | Assign permission and tick Whole school, or leave it unresolved | Assign permission; no scope/default controls; effective internal school marker. |
| Individual ATTENDANCE_READ | Class selector and optional defaults | Choose class A/grade G or explicit All classes; empty still gives no access. |
| Mixed profile | Unscoped permissions need school selected alongside class selections | ACCESS_CONTROL_READ resolves automatically; ATTENDANCE_READ resolves for class A; missing mark-management scope warns only for that action. |
| Default selections | School, classes and other mixed grains may be saved | Save class A and mathematics selection only. Applicable actions consume compatible defaults; N actions ignore them. |
| Preview after removing class A | May remove both configured scope-dependent outputs | Unscoped actions remain effective; affected scoped grants are removed or narrowed with warnings. |
| Subject input | Current mark-entry grants are class-scoped | Mathematics in class A is selectable; other subjects and daily attendance remain denied. |
| Class sender | All classes still fails school broadcast despite apparent breadth | Class/grade send and explicit unscoped broadcast are different permissions with clear labels. |
| Comment review | Publication action both reviews and requests revised official output | Reviewer approves; publisher applies it; ordinary exporter only issues already-published content. |
| Staff maintenance | Separate create, update and archive choices | STAFF_MANAGE covers all three; a standalone directory observer receives STAFF_READ only. |
| Assessment maintenance | Separate create, edit and proposed delete choices | ASSESSMENT_MANAGE covers permitted draft maintenance; scales, marks and correction review stay separate. |
| Two profiles after consolidation | Separate CRUD identifiers could resolve from different profiles | First profile claims the merged capability; a later profile cannot supply missing scope or a different operation subset. Preview shows the shadowed capability. |
| School setup defaults | Separate settings/calendar capabilities were proposed | SCHOOL_CONFIGURE resolves without defaults; class TIMETABLE_MANAGE still requires resource selections. |
| Progress and dashboard | Proposed progress and dashboard permissions were separate | CLASS_LOGBOOK_READ includes progress; WORKSPACE_ACCESS opens domain-filtered dashboard with no staff dashboard checkbox. |

Hide scope controls, default toggles, scope badges and separator placeholders for unscoped-only forms. Mixed-profile editors show only resource kinds relevant to their scoped actions. Effective tags describe only effective resource selections; retained dormant defaults remain visible in the defaults editor. Keep unresolved warnings and the existing review-before-save interaction. Update both language dictionaries and the frontend's normative feature/shared/state specs with the later implementation; this proposal does not modify normative contracts now.

## 5. Cutover contract

This is a coordinated backend/web/mobile contract change. Regenerate the API and TypeScript clients and update the hand-written Dart grant/parser consumers. Preserve the internal school output marker, but reject it as user input. Remove retired/renamed identifiers from runtime enums, profile seeds and first-party consumers; no compatibility aliases or dual evaluator are proposed.

Reset/reseed only authorization sources/projections in development and staging using a reviewed targeted transaction: derived staff permission grants, manual grant sources, profile bindings, profiles and scope defaults. Clear `StaffAssignment.permissions` as authorization data while retaining the business assignment and placement records; reviewed fixture/profile reseeding reapplies explicit duties. Do not infer all split successors from an old permission. Ordinary service-account grants in the affected authorization tables are reset as well; inventory the affected accounts in the dry-run report. Preserve teacher assignments and guardian links, which remain relationship facts. Reseed reviewed PlatformUser.permissions for the consolidated platform catalog; preserve operator identity/status records, S2S access classes, client school bindings and credentials (C6). Do not wipe business assignments, school data, identity, keys or unrelated records. Disposable fixture schools may be created afresh for rehearsal. The existing whole-school database reset command is outside this authorization.

Keep a snapshot of affected authorization records for rollback, ship matching client/server versions, invalidate stale effective-grant displays and refresh sessions. Rollback restores matching application and authorization data versions; it does not mix old action names with the new catalog. Actual reset, deployment and production migration remain outside the audit phase.

## Assessment naming and bounded mark results

The assessment capabilities are ASSESSMENT_READ and ASSESSMENT_MANAGE. Present them with GRADE_READ, GRADE_MANAGE and GRADE_VALIDATE under Assessments and marks; GRADE_SCALE_CONFIGURE stays in Academic configuration. The renamed identifiers preserve their existing scopes and operation restrictions.

The assessment editor context returns `markResults: { assessmentId, results: AssessmentResult[] }[]`. Only assessments visible under the independent GRADE_READ scope have a group, including an empty group when no authorized current-roster marks exist. The result rows retain their own school, year, subject and relationship filtering; assessment setup authority never supplies mark-reading authority. Match active-roster results to the current class-size denominator. Unavailable groups produce no numeric progress or averages. Reload assessment definitions for editing through this context and enforce ASSESSMENT_MANAGE against both old and proposed targets.

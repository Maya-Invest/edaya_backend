# Authorization

`@edaya/authorization` owns business access policies. `Permission`, defined by `@edaya/core`, is the action vocabulary for staff, teachers, guardians, students, platform operators, and admitted machine callers.

## Identity and facts

Actors contain identity, the selected school/profile, request context, and authentication assurance. Policies read current authorization facts from repositories. Selecting a guardian profile uses guardian relationships even when that person also owns the school or has a staff profile.

| Fact | Authoritative record |
|------|----------------------|
| Manual staff permission | `StaffPermissionAssignment`: action, typed scopes, academic year, status, validity |
| Authority from a staff placement | `StaffAssignment`: permissions and placement |
| Subject teaching or homeroom responsibility | Active `TeacherAssignment`, with its year and validity |
| Staff coordinator contact (no runtime authority) | `ClassGroup.homeroomStaffId` |
| Family access | Guardian access flag, guardian/student links, student profile, active enrollments |
| School ownership | School owner subject; elevated service authority is explicit on the service account |
| Platform authority | Active `PlatformUser` and its canonical platform permissions |
| S2S authority | Active `S2sClient`, school, and access class |

Presets populate ordinary manual grants. Their names have no authorization meaning. Staff assignments remain separate business records; their permissions are derived directly when policies run.

`AccessFacts` memoizes repository reads within a policy evaluation. Authorization facts and decisions are never stored in a shared cache or on actor metadata. A subsequent evaluation sees relationship removal, expiration, or account deactivation.

## Enforcement

Policy methods bind their actions and authorize the complete affected resources. Narrow helpers implement typed-grant matching and live relationship lookup. Production services and routes call named policies; they cannot assemble checks through the generic internal action helpers. Repository guards enforce this boundary and prevent policies from importing administration presets.

```ts
await access.grades.assertInput({ assessmentId, studentId })
const scope = await access.grades.readScope()
const results = await repositories.assessmentResults.forAccess(scope).list(query)
```

A read scope is a tenant plus alternatives of resource constraints. The Postgres adapter compiles those constraints into SQL before listing, pagination, counting, and single-record lookup. A constraint describes placement; it does not choose a permission. Attachments follow the permitted owner resource, including publication restrictions.

A write runs inside the command's transaction. It authorizes existing and proposed placement and all affected resources before saving. When a policy admits alternative actions, one action must authorize the complete mutation. Permissions for different actions cannot supply different halves of a mutation. A payment reversal applies reversal authority to both the payment and its resulting fee balance update. Batch authorization preflights every proposal, then business validation and writes proceed in the same transaction so later proposals see earlier changes; any conflict rolls the whole batch back.

Business validations remain mandatory after authorization: enrollment consistency, scores, published report immutability, payment balances, and other actor-independent invariants. Owner and machine authority retain tenant constraints on every related resource.

## Discipline and shared resources

Incident content changes bind `DISCIPLINE_UPDATE`; resolution binds `DISCIPLINE_VALIDATE`; cancellation, reopening a cancelled incident and deletion bind `DISCIPLINE_ARCHIVE`. Creating a resolved or cancelled incident also needs the corresponding action. Mixed content/status changes require each action to cover both existing and proposed placement. Subject teachers are limited to their subject occurrences; homeroom teachers retain class-wide incident visibility. Participant and sanction scopes constrain the incident and student together, including the incident's academic year. Supplying both class and lesson never bypasses the lesson boundary.

Resource assignments follow their class, lesson, activity or assessment into the selected academic year. Resource configuration remains school-wide according to the existing permission catalog. Mandatory business validation rejects duplicate and overlapping reservations consistently across occurrence kinds, including conflicts within one batch. Adjacent reservations and untimed homework do not create a time conflict.

## Profile and account administration

Guardians may update their own contact methods and photo, and notification opt-outs on their existing guardian–student links. The policy rejects identity, access, relationship-rights and placement changes, creation, and deletion. Notification email/phone overrides use the separate personal communications command. Neither path inherits privileges from another profile sharing the login.

Staff may not deactivate or delete their own selected staff account. Owner non-removal and ownership uniqueness are business invariants; only the current human owner may transfer ownership. A transfer takes effect for subsequent policy evaluations immediately.

Service accounts and their permissions are managed through service-account commands. Ordinary staff entity writes, deletion, grant administration and business-assignment writes cannot alter service accounts. Dedicated commands enforce human/owner requirements, delegation bounds, key lifecycle and atomic revocation.

## Restricted integration commands

Machine-only command decisions live in business policies. Subject/matter import commands admit active service accounts or the named fixture importer, and bind the relevant curriculum action to both existing and proposed placement. Direct delivery materialization admits those same callers with current send authority. Human publishing uses its explicit send policy and materializes deliveries within the publication workflow.

Invitation acceptance admits service accounts with permission-assignment authority and the verified `account-invitation-public` or fixture identities. Token, contact, status, expiry and ownership checks remain mandatory, including on retries. Provider delivery events admit authorized service accounts and the named webhook, notification adapter, reconciliation and fixture identities. Missing delivery IDs still require an admitted caller and action.

REST and GraphQL only dispatch these commands. They contain no additional caller-kind policy or runtime authorization selector; direct workflows reach the same policies.

Guardian linking requires `PARENT_UPDATE`, without borrowing student-detail read authority. Shared entity validation retains the student's same-school enrollment requirement for commands and direct saves.

## Document policies

Report generation uses `access.reportCards.documentContext` and `assertDocumentAttachment`, both bound to `REPORT_CARD_PUBLISH`. Publication remains school-wide according to the permission catalog. Teacher comment authority cannot generate documents. A cached PDF still requires current publication authority. The command requires a published result and period, retains tenant and placement invariants, and checks attachment ownership before writes in its transaction. Class statistics query only the permitted published results for the same class, period and definition.

Logbook generation uses `access.logbooks.documentContext` and `assertDocumentExport`, bound to `CLASS_LOGBOOK_READ`. Queries apply the action scope before assembling subjects, sessions, progress, homework and counts. Export rechecks the complete included subject/session set before upload and signing. Staff use their permitted classes, subject teachers their current subjects, and families their current child enrollments. Homeroom assignment alone does not authorize subject logbooks.

Document teacher names come only from active teacher assignments in the document's academic year and validity period, with an active teacher profile. Staff coordination and staff responsibility labels never substitute for subject or homeroom teachers.

## Typed staff scopes

The same `GrantScope` union is used in persistence, application code, and contracts:

- `school` for actions whose catalog grain is school-wide.
- `all` with an explicit grain for every resource at that grain.
- `grade_level` or `class_group` with their identifiers.
- `grade_level_subject` or `class_subject` with an explicit parent and optional subject. Omitted subject means all subjects of that parent.
- `activity` with an activity, a class, or both.
- `student` with a student identifier.

The action's catalog grain, tenant, year, parent relationships, and validity constrain delegation. Empty or ambiguous selections are rejected. Platform actions cannot be persisted as school staff grants.

## Timetable availability

`access.timetable.spaceRepositories` binds timetable-read authority to the requested class and its academic year. It returns only that class/year, the shared period grid for that year, and applicable class/grade/school calendar events. SQL applies these constraints before availability cells or supporting counts are built. The calculation has no access to the full repository catalog.

## Shared curriculum and activities

Subjects and chapters are shared catalog records. Grade-level allocations apply to every class in that grade and academic year. Their write policies authorize all affected classes for the same action, including both old and proposed placements; access to one consuming class is insufficient to change a shared record. Catalog creation, update and deletion retain distinct actions. Reads may follow any authorized consuming class.

Family activity visibility uses the canonical `ActivityEnrollmentStatus.Approved` relationship. Pending and denied enrollment records remain visible to their own student/family, but do not grant access to the activity. Removing the family link or changing approval is observed on the next policy evaluation. Subject-only teaching does not grant class activity access; homeroom assignments and current student class enrollment do. Homeroom teachers and staff with class-scoped activity authority can read activities assigned to that class, plus school-wide activities with no class assignments. The class must exist in the authorized academic year; an all-class grant still excludes assignments from other years. A missing class does not grant school-wide activity access.

## Financial mutations

Payment cancellation and reversal bind their distinct actions. A direct save that also changes financial details, or creates an already cancelled/reversed payment, additionally requires `PAYMENT_RECORD` for the complete record. Fee cancellation likewise cannot create a fee or rewrite its placement, amounts, installments or adjustments using cancellation authority alone. Status-only workflow operations retain their own action, including the resulting fee balance update inside the transaction.

## Academic lifecycle

Publishing and archiving academic years and publishing periods use `SCHOOL_LIFECYCLE_MANAGE`. These actions do not grant permission to change dates, names, or placement. Structural edits use `SCHOOL_STRUCTURE_CONFIGURE`; a write that also changes publication state must satisfy both decisions for the affected records. Direct entity writes enforce the same rules as commands.

## Files

- `model/`: actor identities and authorization errors.
- `access/`: business policies, live facts, identity selection, grant administration, and display projections.
- `permissions/`: action metadata, assurance rules, and administration presets.
- `platform/`, `s2s/`, `service-accounts/`: account/key commands and credential helpers.
- `ports/`: repositories required by policies.

The grants endpoint returns a display projection of the same policy facts. Clients use it for access displays; server policies decide access to each requested resource.

## Validation and cutover

Native database policy tests cover selected-profile isolation, typed grants, assignment removal, assurance, tenant boundaries, action isolation, scoped reads, complete writes, and transactional service-account administration. The repository guard rejects production references to removed mechanisms.

Migration `0009_typed_staff_grants.sql` runs through deployment tooling after the platform identity migration. It validates existing scopes and provenance, converts manual grants, removes verified assignment-derived copies, and drops the replaced columns. Ambiguous data aborts migration. Deploy matching application/client contracts and data together; rollback restores matching application and data versions.

## Communications and scheduled work

Personal inbox access binds `QUERY_COMMUNICATIONS_READ` to the selected profile and its linked subject. Staff and guardian notification contact changes use the same personal policy and can change only notification email/phone fields. They do not require staff or guardian administration permissions. Revoked profiles cannot read or update their inbox. A staff member can read their own business assignments through workspace access; reading another staff member's assignments requires permission administration access.

Published announcement audiences come from one relationship lookup and one SQL predicate, used for portal reads and delivery eligibility. School broadcasts reach all profile kinds. Staff, guardian, and student broadcasts and direct messages reach only the named profile kind. Class and grade audiences use current enrollments, guardian links, and teaching/homeroom assignments. A guardian does not receive a private message addressed directly to a student. Draft, archived, and expired announcements are excluded from personal audience reads.

`COMMUNICATION_SEND` authorizes every announcement target before publication or delivery materialization. A class grant may address that class; broader broadcasts and direct-recipient administration require school authority. Editing content remains separate from sending it. Delivery identity includes the selected recipient profile as well as its login account, so one person's staff and guardian inboxes do not share read state. Personal inbox queries include both, even when an owner can administratively read other deliveries. Personal communication navigation does not require an administrative grant; the row policies remain authoritative.

Automatically generated deliveries persist a `sourceKey`. The unique identity is school, source, login subject, recipient kind and recipient ID. `id` is an opaque provider correlation key; retries and cancellation find it through the persisted identity. Delivery recipients and source cannot be reassigned. Direct delivery creation and edits, including imports and provider events, require an admitted machine caller and their canonical communication action. Human publication creates its deliveries under the send policy; personal read receipts use the exact-recipient policy. Administrative deletion remains a separate `COMMUNICATION_DELETE` action. Announcement dispatch takes an ID, reloads the published record and reauthorizes existing deliveries inside its transaction. Cancellation uses persisted recipients, including recipients who have since lost their account link or enrollment.

Migration `0011_notification_delivery_sources.sql` backfills source keys offline without changing delivery IDs, read status, provider history or queued provider jobs. It rejects ambiguous source/profile data and duplicate identities. The application never parses an old delivery ID or falls back to a login-only lookup. See the [coordinated cutover](../../../docs/architecture/authorization-cutover.md).

Calendar read context includes school and grade events affecting an authorized class. Calendar writes affect only the explicitly authorized placement; a class grant does not permit editing a school-wide holiday.

Scheduled work uses named system identities with canonical actions:

| System identity | Authority |
| --- | --- |
| `processDueNotifications` | Read assessments, activities/timetables, and calendar events for its school |
| `reconcilePendingDeliveries` | Read school deliveries and apply delivery-status updates |
| `expireAccountInvitations` | Read and expire invitations for its school |
| `notify-adapter` | Persist delivery records from authorized business notifications |
| `notification-delivery-webhook` | Apply provider delivery events for its school |

Each job runs in a transaction. Its reads use native policy scopes before limits and counts. An unrelated or unknown job identity cannot exercise another job's authority, including no-op retries.

The local dataset importer uses the explicit `fixture-seed` system identity. It can import historical student notes only with an existing staff author in the same school. Other jobs cannot impersonate that author. School and population fixtures start with unlinked profiles; the identity-linking commands establish their central account links. Communication fixtures create drafts, add their audiences, then publish, and never create deliveries using placeholder login IDs.

### Delayed notification authority

`access.notifications.recipient` admits only the school-bound `notify-adapter` system actor. It resolves the immutable delivery tuple and current source eligibility without manufacturing a guardian or student actor. The shared dispatcher invokes it before each channel attempt, projects current contacts from that exact profile, and cancels denied deliveries. No school contact or channel preferences are copied into provider subscriber state. Novu is an email transport on this same dispatch path, with one immediate email workflow and an explicit per-message destination. Authentication and invitation destinations remain explicit command facts; their emails are not school authorization state.

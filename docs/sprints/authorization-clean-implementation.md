# Authorization clean implementation

Status: implementation and development verification complete (2026-09-13). The replacement is the sole authorization implementation; the old evaluator, translations, duplicate grant state and shared authorization caches are removed. Operational rehearsal and deployment follow the cutover runbook; no live migration or deployment has been performed.

## Required end state

- Identity-only actors; permission identifiers are the sole action vocabulary.
- Explicit action policies use current manual grants and business assignments.
- Typed persisted staff scopes; no derived permission rows or scope-path runtime.
- Mandatory tenant and authorization predicates before reads, pagination, and counts.
- Complete authorization of existing and proposed mutation resources.
- No shared authorization caches, legacy evaluator, dual writes, or compatibility fallback.
- All API, generated client, web, mobile, fixture, and job callers updated.

## Work checklist

- [x] Inspect both implementations and agree on the target with the user.
- [x] Inventory operation declarations, actor state consumers, and grant persistence.
- [x] Implement typed grants, identity actors, and current relationship facts.
- [x] Implement action-specific policies and native repository read scopes.
- [x] Replace all entity, command, query, job, and API authorization callers (native parity and production-source guards pass).
- [x] Implement and test the offline typed-grant migration; remove assignment-derived permission persistence.
- [x] Update generated contracts and web/mobile consumers (contracts and consumers match the final model; full web/mobile verification passes).
- [x] Delete superseded mechanisms and update repository guidance (one evaluator, typed grants, no transport actor gate or shared authorization caches).
- [x] Verify adversarial authorization, migration, integration, and client checks (final results below).

## Recorded checkpoints

| Completed work | Verification |
| --- | --- |
| Native service, policy and SQL scope implementation; legacy workflow evaluator fixtures removed | 745 combined tests passed |
| API enforcement fixtures, grant projection and document policies | 224 API tests passed |
| Report-card and logbook document policies; staff-to-teacher fallbacks removed | 14 report-card and 9 logbook native policy tests passed |
| Integration fixtures use identity-only actors and persisted facts | 13 service/adaptor and 28 HTTP tests passed |
| Concurrent writes and rollback on native Postgres | 12 tests passed in a disposable loopback database |
| Scope migration, guardian opt-outs, lifecycle isolation, real identity linking and seed publication ordering | Native migration/policy tests and seeding tests passed |
| Current teacher labels, class profile loading and personal communications clients | Full web verification passed; 768 webapp tests |
| Guardian inbox profile filtering and late-response isolation; push delivery revalidation | Full mobile verification passed; 79 local tests (live integration excluded) |
| Generated artifacts and repository guidance | Repository verification, import boundaries, test naming and type checks passed |
| Notification source migration, cancellation, timetable labels and package test cleanup | Full backend verification: 1,621 tests; 12 native-Postgres and 2 generated-client integration tests; web/mobile verification repeated |
| Native delayed-dispatch policy, live profile contacts and offline snapshot retirement | Full backend verification: 1,650 tests; 12 native-Postgres and 2 generated-client HTTP integration tests |
| Shared Novu transport; guardian, ownership and service-account policies; scoped availability and human-staff clients | Full backend: 1,625 tests; full web: 770 webapp tests; 13 service/adaptor, 28 HTTP and 12 native-Postgres integration tests; final availability integration rerun passed |
| Discipline/resource policies, action-bound callers, job matrix and owner/preset separation | Full backend: 1,662 tests; final discipline/behavior: 29 tests; full web: 770 webapp tests; 13 service/adaptor, 28 HTTP and 12 native PostgreSQL tests |

These historical checkpoints show progress. The final verification and acceptance reconciliation below supersede their interim counts and remaining-work notes; they do not represent a live deployment.

## Final verification

The [surface audit](authorization-surface-audit.md) reconciles all 55 managed resources, commands, queries, REST/GraphQL, platform/S2S, jobs, permission administration, migrations and client displays. The review findings are corrected and covered; no identified implementation item remains open.

| Check | Final evidence |
| --- | --- |
| Backend suite | 1,694 tests pass in an uncached serial run: 604 service, 95 authorization, 164 Postgres, 227 API and the remaining core/adaptor/tooling suites |
| Final seed corrections | 90 fixture and 69 seeding tests pass again after the corrections; affected packages pass lint/type checks |
| Service/adaptor and HTTP integration | 13 + 28 tests pass, including generated contracts and tenant-boundary writes |
| Native PostgreSQL | 12 queue, concurrency and transaction-rollback tests pass |
| Seed integration | 8 tests pass, including real Central Identity HTTP bootstrap/validation/doctor with an in-memory database; the final delivery-history regression additionally passes 12 assertions |
| Backend artifacts and repository checks | Forced build passes with zero cached build tasks; generated API artifacts, import/runtime boundaries, layout and test naming checks pass |
| Web | Full uncached verification passes: repository/generated checks, lint/types, builds and 770 webapp tests, plus admin/tooling tests |
| Mobile | Generated bindings, analysis and all 79 local tests pass; live mobile integration is excluded by the repository's standard verify command |
| Replaced mechanisms | Source scan of 888 backend, 1,008 web and 192 mobile production files finds no replaced mechanism references; backend guards also enforce the single policy entry path |
| Merge and patch state | Backend, web and mobile contain `feature/central-identity`; diff whitespace checks pass in all three repositories |

The temporary local Identity server used for seed verification is stopped. No external email, live data migration, deployment or push was performed. The [cutover runbook](../architecture/authorization-cutover.md) defines the required release rehearsal, offline migration, matched backend/web/mobile release and matching application/data/queue rollback. These are operational release steps, not a second runtime authorization path.

The coordinator representation is resolved: `ClassGroup.homeroomStaffId` remains the sole staff-coordinator contact field in the existing external contract. It confers no authority. Active `TeacherAssignment` rows are the sole subject/homeroom teacher facts. These are distinct business facts; neither is copied into the other, and no staff-to-teacher display fallback remains in the shared teacher-label helper or documents.

## Business acceptance matrix

Acceptance evidence is reconciled in the surface audit for owner/staff, scoped staff, subject teacher, homeroom teacher, guardian, student, and admitted service actors where applicable. Denials cover unlinked and foreign-school resources, mixed action scopes, expired grants, revoked relationships, inactive profiles, academic-year mismatches, unpublished portal content, and partial batches/reassignment. Lists, counts, aggregates, and single reads must share the same access constraints.

## Cutover

Deploy matching backend/client contracts and the one-time data migration. Ambiguous legacy grants abort conversion. Rollback requires restoring matching application/data versions. No runtime chooses between authorization implementations.

## Historical checkpoint log

The dated entries below preserve progress and findings as they occurred. Their statements about remaining work describe that checkpoint only; the status and checklist at the top of this plan are authoritative.

## Implementation evidence (2026-09-13)

The combined service, authorization, and Postgres suite passed 745 tests. The complete service suite uses native SQL authorization and transaction fixtures; the old shared workflow authorization fixture and role-to-effective-grant helper have been deleted. Test databases are cleared between tests through a global Bun preload, with new application instances and request facts for every fixture. An additional native test covers historical note imports by the explicit fixture job, including foreign/missing authors and unrelated job denial.

Academic lifecycle actions are separate from structural edits. Lifecycle-only staff can publish periods and years; structural grants cannot publish through direct entity writes, and combined structural/publication changes require both decisions. Regression tests cover existing records, new records, and rollback. Report-card publication authorizes the actual generated result instead of requiring a result row before generation.

The integration harness no longer preloads grants or relationship scopes or supplies a legacy evaluator. Persisted typed-grant tests cover action isolation, exact placement, validity, assignment deletion, and responsibility labels with no runtime privilege. Current evidence: 13 service/adaptor integration tests, 28 HTTP integration tests, and 12 tests against a disposable native Postgres cluster all pass. Seeding checks pass, including the full dataset through actual policies. The complete API suite passes 206 tests, and repository hygiene, generated-artifact drift, import boundaries, and test naming checks pass. Integration/API and seeding type checks pass. Authorization and file-content route tests use native persisted facts and prove immediate revocation. Scheduled API jobs are tested against native transactions with distinct job identities.

School and population seeds create unlinked profiles and use the access-control commands for central identity links. Communication seeds create drafts, add audiences, then publish. Delivery fixtures resolve current recipient identities and omit unlinked recipients; they no longer persist placeholder login IDs. Historical note imports require an existing staff author in the same school.

Migration `0010_guardian_relationship_details.sql` accompanies the typed-grant cutover. It persists the guardian relationship settings already present in the domain/API, including report and attendance opt-outs, and retains nullable health details plus emergency protocols and update timestamps. Existing records receive their previous runtime defaults; values discarded by the old persistence implementation cannot be reconstructed. Native persistence/migration tests and notification opt-out tests cover this behavior. Both migrations run only through deployment tooling; no live migration has been performed.

Remaining implementation work: audit all remaining production callers and client access displays; consolidate the class coordinator/homeroom representation without turning staff coordination into teacher authority; finish final-model documentation and the complete backend/web/mobile verification. No deployment has been performed, and this checkpoint is not a completed cutover.


## Document checkpoint (2026-09-13)

Report-card generation now binds `REPORT_CARD_PUBLISH` to the complete document decision, including cached attachments, related school/class/year records, published-cohort aggregates, and attachment ownership. The existing school-wide publication grain is preserved. Teachers' comment authority cannot generate reports. The command checks published result/period invariants and writes attachments in its transaction, rechecking authority before upload and save. Rendering failures roll back attachment status changes.

Logbook generation now binds `CLASS_LOGBOOK_READ` in a dedicated policy. Content and counts come from native scoped queries; the complete subject/session set is reauthorized before upload and signing. Staff use class scopes, subject teachers use their current assignments, and guardians use their current child links/enrollments. Homeroom-only assignments do not grant subject logbook access. Both document paths use current valid teacher assignments for displayed names and have no staff-name fallback.

The old document authorization mocks were replaced with native database tests: 14 report-card tests and 9 logbook tests pass independently. They cover action isolation, profile selection, cross-school and unrelated resources, expiry/revocation, academic years, unpublished reports, current teacher names, counts, cached documents and transaction rollback. API and authorization type checks pass. The complete API suite passes 224 tests (59 files); the authorization suite passes 85 tests (16 files). Changed-file lint, API/authorization type checks and repository verification pass.

Remaining after this checkpoint: coordinator administration/representation, personal inbox and access displays, the full actor/action/resource audit, final coordinated backend/web/mobile checks, and cutover documentation. Object storage remains external to SQL transactions; no live deployment or data migration has been performed.


## Client checkpoint (2026-09-13)

The shared web teacher-label helper no longer reads staff assignments as a fallback or accepts the old display-only teacher shape. Labels require active teacher profiles and active, currently valid assignments; co-teachers appear once in a stable order. The class profile now loads actual homeroom assignments for its class and academic year through its route query. It refreshes teacher facts after teacher/staff changes and reloads them on each profile visit, without depending on cached status for another class. Forbidden optional enrichment leaves the display empty. The feature specification explicitly distinguishes the staff coordinator contact from teacher responsibility and attendance authority.

Personal web inbox requests now include login subject, recipient kind and recipient ID together, including owner sessions. The unused second inbox query and its subject-only helper were removed. Personal announcements are reachable without manufacturing an administrative school grant; server policies still determine the visible audience and privileged actions remain gated.

The guardian mobile inbox uses login subject, guardian ID and school together. It reloads when the selected profile changes, clears previous-profile data, and discards late responses after profile switches, sign-out or controller disposal. Opening a push message fetches the delivery through the selected guardian's scoped query; push-provided title/body are no longer used as the message record.

Verification: full web `bun run verify` passed (including 768 webapp tests, type checks, lint, repository checks and builds); full mobile `melos run verify` passed (generated-client drift, analysis and 79 local tests). Three new mobile tests cover recipient filters, profile-kind denial and overlapping-response/sign-out isolation. Thirteen backend native communications/calendar tests passed, covering audience filtering before counts/pagination and exact personal delivery identity. No backend API contract or persistence migration was required for this client checkpoint. Final backend surface/coverage audit and deployment cutover remain open.


## Notification identity and verification checkpoint (2026-09-13)

Generated deliveries now persist a source key. A database unique index identifies a delivery by school, source, login subject and selected recipient profile. Retries reuse the persisted provider ID; application code has no old-ID parser or alternate lookup. Lifecycle updates retain the source, and policies forbid moving a delivery to another source or recipient. Announcement dispatch takes only an ID, reloads persisted publication/content and reauthorizes reused deliveries in its transaction.

Offline migration `0011_notification_delivery_sources.sql` retains all existing delivery IDs, provider correlation, content, read state and timestamps. It extracts known generated event sources using the stored event and login, and announcement sources from their stored announcement ID. Unknown sources, missing profile identity and duplicate history abort conversion. No external provider keys or queues are rewritten. Source cancellation queries persisted recipients through the notification job policy, so unlinking a login or removing an enrollment does not orphan its reminder. Completing homework or converting it to a quiz cancels the source.

Six native SQL migration tests and 39 focused communications/trigger tests pass. They cover old provider-ID reuse, multiple profiles sharing one login, source immutability, removed links/enrollments, foreign-school cancellation denial, deferred-publication revocation and atomic migration rejection. The former cancellation fixture with no delivery repository was replaced by real persisted facts and policy enforcement.

Timetable enrichment was also audited: production ancillary queries already enforce the school boundary. Current subject-teacher labels now exclude expired/future assignments and inactive teachers, and include all distinct co-teachers in stable order. Stored occurrence teacher snapshots retain their historical display meaning. Eight timetable query tests pass.

Backend OpenAPI/TypeScript artifacts and mobile bindings were regenerated. Full web verification passed with caches bypassed (768 webapp tests); full mobile verification passed again (79 local tests). The coordinated cutover runbook covers migration order, pause/drain/snapshot requirements, provider-ID preservation and rollback of matching application/data/queue versions. Stale service documentation describing removed authorization-cache hooks was deleted. Full backend `bun run verify` passed after the runner fix below: repository checks, lint/type checks, builds and 1,621 tests, including 518 service, 85 authorization, 157 Postgres and 224 API tests. Twelve disposable native-Postgres integration tests and two generated-client HTTP integration tests passed. Four production-source migration guards also passed, confirming replaced authorization symbols remain absent.


The full repository run exposed a test-runner issue absent from root-level targeted runs: Turbo starts `@edaya/service` in its package directory, where Bun did not load the root cleanup preload. This retained PGlite fixtures and exhausted memory. A package `bunfig.toml` now loads the same cleanup hook explicitly. Two regression tests prove that consecutive tests reuse one emptied database; they failed without the package configuration and pass with it. The authorization facts and application instances remain fresh per test/request. The complete backend verification now passes with this fix; the service suite finishes in 114 seconds with 518 passing tests.

## Native delayed-dispatch checkpoint (2026-09-13)

School dispatch now calls a named notification policy against the exact persisted school/source/login/profile tuple. It checks current announcements, report and grade publication, guardian link opt-outs, attendance corrections, incident involvement, homework state, activity enrollment and calendar scope. The API initializes the school application before draining the queue and resolves contacts from the current exact profile. Resolution repeats before each channel. Native subscriber upsert/remove implementations were deleted; external providers expose those optional transport operations separately.

Denied recipients cancel terminally. Missing resolvers and transient lookup failures send nothing and retain retry bookkeeping. Successful channels survive retries, and revocation after email blocks push. Migration `0012_notification_contact_authority.sql` removes native school-contact snapshots while preserving explicit authentication/invitation destinations, jobs, receipts and devices; ambiguous command destinations abort atomically. The cutover runbook includes this migration.

Nineteen native policy/dispatch tests, 22 native transport tests and three offline contact-migration tests pass. Full backend `bun run verify` passes: repository checks, lint/type checks, builds and 1,650 tests, including 537 service, 85 authorization, 160 Postgres and 224 API tests. Twelve disposable native-Postgres integration tests and two generated-client HTTP contract tests pass. The native subscriber-copy production functions have no remaining references. External subscriber-provider delayed dispatch, the complete caller/action/resource audit and final coordinated acceptance remain open. No live migration or deployment has run.

## Shared Novu dispatch implementation (goal continuation)

The separate Novu school, auth and invitation gateways, subject-keyed subscriber client, preference mappings and workflow translations have been deleted. Novu is now an email transport injected into the same durable dispatcher. Its one-step workflow receives an explicit current destination override and no business subscriber profile. FCM remains on the shared per-channel policy path. Subscriber synchronization/backfill hooks and their contact-only queries were removed from account linking, grants displays, contact updates and staff/student workflows; the gateway port no longer exposes subscriber operations. A leftover grant-cache environment setting was also deleted and added to production-source guards.

The runtime uses `EMAIL_TRANSPORT=novu`, fails closed if its dispatcher or credentials are missing, and supplies explicit delivery correlation for provider receipts. The bootstrap catalog and cutover guidance describe only the single email workflow. Existing provider histories and subscriptions must be exported and retired during the coordinated deployment, outside request handling.

Focused verification so far: 62 dispatch/communications/access-control tests and 9 Novu transport/receipt tests pass. API and integration type checks pass. Final formatting, broader checks and the complete actor/action/resource audit remain in progress; this checkpoint does not mark the plan complete.


## Policy audit fixes (2026-09-13 continuation)

Guardian self-service commands previously reached a write policy that admitted no guardians, and reconstructing a guardian discarded saved notification contact overrides. The final policy admits only updates to the selected guardian's contacts/photo and existing link notification opt-outs. Identity, account access, relationship rights, reassignment, creation and deletion remain forbidden. Commands now preserve persisted profile data and submit requested changes to that policy rather than selecting behavior by actor kind. Nine native tests cover unrelated and foreign records, a shared school-owner login, removed links, deactivated/relinked profiles and persisted overrides.

Staff self-deactivation and deletion are now actor-dependent policy decisions. Entity business validation no longer receives actors; the production-source guard scans full config/helper source rather than only exported config declarations. School owner non-removal and cross-school uniqueness checks are shared actor-independent validation for commands, direct saves and invitation claims. Current-human-owner transfer authority remains in the policy, and a successful transfer immediately removes the previous owner's authority. The focused guardian/ownership/setup/invitation suite passed 50 tests; the managed entity gate and guardian suite passed 31 tests.

Ordinary staff entity deletion and grant administration could bypass service-account lifecycle policies. Generic service-account edits/deletion and ordinary grant or assignment writes targeting service accounts are now rejected, including both old and proposed grant recipients. Service-account commands remain the administration path. Two native tests prove mixed-batch rollback, grant edit/reassignment/deletion denial, and successful dedicated update/revoke behavior with key revocation.

Verification in progress: full backend and integration suites after these changes. No new API schema or generated-client contract was introduced by these policy fixes. Remaining audit areas include scheduling query construction, discipline and resource batch scopes, complete privileged actor/action coverage and the final coordinated cutover review. No live migration or deployment has run.


## Shared transport, availability and client verification checkpoint

Full backend verification passed after the Novu and guardian/ownership/service-account changes: 1,621 tests, including 549 service, 85 authorization, 160 Postgres, 223 API, 14 Novu transport/receipt and 8 Novu bootstrap tests. The lower total reflects deletion of replaced subscriber/gateway tests. Repository checks, lint/type checks and builds passed. Full integration passed 13 service/adaptor and 28 HTTP tests; 12 native Postgres concurrency/queue tests also passed. The two changed integration expectations now assert policy denial before business validation for staff self-deactivation and foreign assignment targets.

Timetable availability now uses the existing named timetable policy to supply a narrow class/year/period/calendar repository set. Applicable school and grade calendar ancestors are included in SQL; unrelated class closures are excluded before counts and cell construction. Eight aggregate/query tests pass, with four new actor cases (staff, teacher, guardian, student), foreign/mismatched context denial and live revocation. Service type checking and workspace lint pass. Coordinated backend verification passed with this last query change included: 1,625 tests (553 service, 85 authorization, 160 Postgres, 223 API), plus repository, lint/type and build checks. The timetable lifecycle integration test was rerun and passed with the new scopes.

The web human-staff roster now sends `accountKind = human` for list, count and direct drawer lookup, before pagination or relation loading. Service accounts cannot open ordinary staff permission forms through these loaders. The feature spec records that distinction. Fourteen staff/configuration-loader tests pass, including pagination/count filter parity and service-account direct-link exclusion. Full web verification passed with caches bypassed: 770 webapp tests, lint/type checks, repository checks and both application builds. No mobile contract changed; its prior 79-test verification remains the applicable checkpoint.

Next concrete audit target: discipline entity paths. Review incident class/lesson constraints together, and ensure direct involvement/sanction reads and writes authorize both the incident and the student; generic scope compilation currently reaches student-linked records primarily through the student. Workflow checks alone are not evidence for direct entity calls. Resource-assignment batches and the remaining privileged actor combinations also remain open.


## Discipline, resources and policy caller checkpoint

Discipline SQL scopes now constrain every supplied class/lesson placement; incident participants and sanctions require both the student and incident boundaries, including the incident academic year. Resolution requires `DISCIPLINE_VALIDATE`, cancellation/deletion require `DISCIPLINE_ARCHIVE`, and combined changes require each corresponding action. New resolved/cancelled incidents cannot bypass those actions through create authority. The web incident drawer now displays the distinct update, validate and archive controls.

Resource scopes preserve occurrence-only assignments and their academic years. Business validation now checks lesson, activity and timed-assessment conflicts symmetrically. Managed batches preflight authorization for all proposals, then validate and write inside the transaction so conflicting proposals cannot both succeed. Native tests cover all six cross-occurrence orderings, owner invariants, foreign and historical reassignment, expired grants, profile isolation, pagination/count parity, adjacent bookings and untimed homework. The discipline/resource suite passes 27 tests.

All production generic action-helper calls in services and API routes have been replaced by named policy calls. Discipline participant checks, payment/balance changes, enrollment targets, report actions, attendance, timetable reads, attachment access and school administration now bind actions inside the authorization package. Runtime owner authority moved out of administration presets. Source guards reject generic policy assembly by production callers and preset imports by policies. Eight internal identities were checked against every canonical action and cross-school targets; the job matrix and source guards pass 14 tests with 958 assertions.

Full backend lint, type checking and builds pass with these changes; the full backend test run and subsequent client/integration verification are in progress. Historical proposals are explicitly superseded, and the current architecture describes only the final model. This checkpoint does not close the acceptance audit or authorize deployment.


## Verification after the caller cleanup

Full backend verification passed 1,662 tests (580 service, 95 authorization, 160 Postgres and 223 API), plus repository checks, lint/type checks and builds. Resolution then received a final correction: validation-only staff can resolve existing participants without borrowing create/read authority; changing or adding participants still requires their own action and rolls back on denial. The complete behavior workflow plus discipline policy suite passed 29 tests, and service type checking and workspace lint passed. The web resolve modal prevents unauthorized participant edits and additions, while preserving resolution and sanction inputs for validators.

Native PostgreSQL verification passed all 12 finance-concurrency and notification-queue tests after the shared batch and named-policy changes. Full web verification passed with caches bypassed: 770 webapp tests, lint/type checks, repository checks and both application builds. Full integration verification passed 13 service/adaptor and 28 HTTP tests, including generated-client contracts and mixed-school writes. Repository verification confirms generated artifacts are current; final source whitespace checks pass.


Cutover review confirmed that the Postgres runtime does not run migrations by default; local PGlite initializes its schema for development/tests. The coordinated runbook explicitly disables startup migrations, pauses writes/jobs/callbacks, migrates through deployment tooling, and restores matching application/data/queue versions on rollback. The last discipline refinement also requires archive authority to reopen a cancelled incident; the 29-test discipline/behavior suite passed again with that denial included.


## Restricted command enforcement checkpoint

Removed the REST/GraphQL `serviceOnly` registry state and deleted `assertCommandActorKind`. Subject/matter imports, direct delivery materialization, invitation acceptance and provider events now enforce their admitted machine callers inside action-bound policies. Human publication invokes private materialization under its send decision; signed invitation/provider requests and named jobs retain their explicit paths. Unknown or unprivileged callers are denied even when a delivery retry has no matching record. No runtime selector or compatibility path remains for these commands.

The native command parity suite passes four tests covering all five commands through direct calls, REST and GraphQL, plus scoped service action isolation, old/proposed/foreign placements, grant expiry and account revocation. Communications/invitation workflows pass 44 tests. Guardian linking no longer requires a separate student-detail read permission; same-school enrollment validation moved into the shared entity gate. Guardian/student tests pass 37 tests, including direct saves and profile isolation. Workspace lint passes; full backend verification is running.


## Finance and delivery entry-point reconciliation (2026-09-13)

The typed-grant migration now has an end-to-end meaning test: legacy class-wide grade grants and subject/class wildcard exam grants are converted, then used by native policy-constrained queries. The fixture proves the expected results/counts, foreign and unrelated-subject exclusions, and immediate expiry. Persisted student-scoped grants remain rejected because the prior grant schema prohibited them. This new migrated-query test passes.

The finance audit found that direct cancellation/reversal could also rewrite payment details using only the status permission. Direct payment and student-fee saves now require `PAYMENT_RECORD` as well when creating an already cancelled/reversed record or combining financial-detail changes with cancellation/reversal. Each action must authorize the complete old/proposed resource. Status-only workflows continue to update the balance with their own cancellation/reversal action. Five native cases pass, including mixed-batch rollback, invalid academic-year authority, amount/placement changes, and valid combined authority.

The delivery audit found a bypass of restricted provider-event admission through direct entity saves and `recordDelivery`. Creation/import and edits now share one admitted machine-caller set, in addition to their canonical communication action. Human publication still materializes its authorized audience through the send policy; marking one's own message read uses the exact-profile policy. Administrative deletion remains its distinct delete action. Native parity now covers six commands plus delivery single/batch creates and updates through direct service calls, REST and GraphQL: four tests and 67 assertions pass. Finance/communications workflows pass 38 tests, including publication, audience restrictions and all four personal profile kinds.

The first broad backend attempt after restricted-command changes hit one five-second native database timeout under concurrent load. A serial rerun then exposed missing required status/readonly fixture input in the newly added finance tests; those fixtures are corrected and their focused tests pass. Workspace formatting passes and final serial quality/build/test verification is being completed. No test timeout was increased. Acceptance evidence is reconciled by requirement in the surface audit; this checkpoint does not mark the complete matrix or cutover ready.


## Verified finance/delivery checkpoint

Serial backend verification now passes **1,675 tests**: 585 service, 95 authorization, 164 Postgres, 227 API, and the remaining core/adaptor/tooling suites. Workspace lint/type checks, builds, repository checks and generated-artifact drift checks pass. Full integration passes **13 service/adaptor and 28 HTTP tests**, including generated clients and mixed-school writes. Native PostgreSQL passes **12 finance-concurrency and notification-queue tests**.

The communications rollback integration fixture now uses human publication dispatch instead of the restricted direct materialization command. It still injects failure on the second recipient save and proves that no partial deliveries persist. Integration lint and type checking pass after that fixture correction. No production code changed after the passing full backend run.

Caller replacement and deletion of superseded machinery are checked off. The overall plan remains in progress because the specifically identified direct-resource matrix cells above are not yet established. Existing web/mobile verification remains valid for this backend-only policy checkpoint.


## Remaining resource families (2026-09-13)

Added 19 native policy cases for student health, teacher availability, student/class activity enrollments, and shared grade-level curriculum, with explicit allowed/denied and transaction assertions. Together with nine existing academic workflows, all 28 focused tests pass. The audit records their exact coverage, including the intentional distinction between teachers' own historical availability reads and staff grants bound to the selected academic year.

Two production corrections resulted: activity visibility now uses `ActivityEnrollmentStatus.Approved`, and shared curriculum edits/deletes require the same canonical action for every affected class across old/proposed placement. A class-scoped reader can still see a shared catalog record; changing it requires authority over all consumers. Subjects, subject matters and grade allocations have separate regression cases. Existing canonical create/update/delete permissions remain unchanged. Full verification after these changes is running.


## Final activity boundary and verification (2026-09-13)

The resource review also exposed a missing class-to-activity SQL path. Homeroom teachers and class-scoped staff now see activities assigned to their authorized class and unassigned school-wide activities. Native regression assertions require the class to exist in the authorized year, reject unrelated/foreign activities and dangling class grants, and preserve year restrictions for all-class grants. The final focused case passes with 19 assertions.

A fresh cross-repository production scan examined 887 backend, 1,008 web and 192 mobile source files and found no references to the replaced authorization entry points, scope fields, capability enums or synchronization/cache functions. The earlier backend checkpoint passed 1,694 tests plus 13 service/adaptor, 28 HTTP and 12 native PostgreSQL integration tests. Final verification is being repeated with the latest activity predicate; the backend test run bypasses caches.


## Fresh backend verification (2026-09-13)

The final-source uncached backend run passes **1,694 tests** with zero failures: 604 service, 95 authorization, 164 Postgres, 227 API and the remaining core, adaptor, migration, codegen and tooling suites. All 30 Turbo tasks executed without cached test/check results. Workspace lint/type checks and repository/generated-artifact checks pass. HTTP/native integration, seed HTTP verification, a forced final build and refreshed web/mobile checks are the remaining verification steps.


## Seed cutover corrections (2026-09-13)

The additional seed HTTP check exposed assumptions left from placeholder identities and duplicate delivery rows. Fresh school seeding now links central identities before publication. Delivery expectations count provisioned profiles only; unlinked students receive no deliveries. Explicit history and guardian inbox probes reuse the persisted source/profile delivery and apply existing delivery-event commands, preserving its ID and read state. School structure seeding preserves every existing staff member, including profiles already linked during HTTP bootstrap. No authorization rule or uniqueness constraint was relaxed.

Fixture and seeding suites pass (90 and 69 tests); affected packages pass lint/type checks. The native seed contract now passes linked-recipient/history, entity-count, staff-access, population and dashboard cases. Live HTTP seed diagnostics and final client verification remain in progress.


## Development completion (2026-09-13)

All planned implementation and development verification items are complete. Final seed integration passes eight tests against disposable local Identity; the final repeated-delivery case proves one persisted row and retained read history. Forced backend build/repository checks, full uncached web verification and mobile verification pass. The acceptance audit and architecture guidance describe the single replacement model. Operational rehearsal and live cutover remain governed by the release runbook.

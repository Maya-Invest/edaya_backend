# Implementation backlog and acceptance plan

Status: **catalog, resolver, policies and API/UI cutover implemented locally** following user authorization. The [runtime cutover record](runtime-cutover.md) lists delivered behavior, executed checks and remaining release qualification. The [reduced catalog](reduced-catalog.md), [audit](README.md), [decision matrix](permission-matrix.md) and [target specification](target-specification.md) remain the reviewed design baseline. A change to an assumption must update the matrix, metadata, specification and acceptance scenarios together.

The earlier [catalog/resolver proof](catalog-resolver-proof.md) is historical evidence for the first slice. The subsequent implementation includes target identifiers, supported scopes, canonical API metadata, operation context, bounded supporting reads, separate report-correction publication, client gates and seed updates. The work packages below retain their completion criteria; local implementation does not substitute for coordinated release qualification and representative staging workflow acceptance. No existing environment has been reset or deployed.

## Work order and completion criteria

### W1 — Canonical catalog and contracts

- Freeze the reviewed count and canonical identifiers: 90 active capabilities, of which 82 are staff-assignable. Apply the 22 consolidation groups in consolidations.json; no hidden CRUD permission layer or automatic permission-implication graph. Any additional split requires a named need-without-authority case and a matching denial.
- Replace partial single-grain metadata with the exhaustive catalog in the structured matrix. Apply all rename/merge/split/retire dispositions; retained split identifiers keep only their stated responsibility. Adopt exact `scopePolicy`, staff/service eligibility, S2S access class, placement targets, human-only and assurance fields.
- Split user scope selections from resolved/internal authority. Reject user `school` selections, allow no selections only for explicit N actions, and keep the server-produced internal marker. Make effective-grant entity mutation inaccessible through generic APIs.
- Update command/entity validation, service-account requests, selection-render versus grant-render schemas, API catalog output, report correction status and the proposed publisher command. Keep profile precedence and manual source validity unchanged.
- Regenerate the backend client/OpenAPI contracts. Add completeness checks for every permission and ensure no non-staff action is accepted in a staff profile or manual assignment.
- Completion: each active target identifier has one metadata record; every old identifier has a disposition; clients can represent all metadata without manually maintained action exception lists.

### W2 — Policy, resolver and resource enforcement

- Resolve N actions automatically in the same plan used by preview and save. Resource actions still resolve compatible explicit/default selections, warn when unresolved and never become school-wide through emptiness. Preserve first-wins, including unresolved earlier bindings.
- Implement the documented grade/class/subject/student/activity containment for validation, delegation and SQL. Preserve exact occurrence assignments. Exercise wrong-parent, historical-placement and future-resource cases before exposing newly supported scope choices.
- Apply consolidations and justified boundaries in this order: school setup/lifecycle and shared/placed curriculum; attendance/discipline capture, maintenance and review; students/enrollment/notes/health/finance; assessment/marks/logbook maintenance and review; report comments/publication/export; timetable/activities/bookings; query merges and intrinsic dashboard; machine/platform remapping. Each family includes source reads, commands, direct entity writes, counts, documents and notifications.
- Replace school-only checks that conflict with scoped operations. Shared catalog/broadcast/calendar/global reconciliation keep their explicit unscoped capabilities. Whole-teacher timetable export checks complete authorized occurrences.
- Add bounded supporting-read projections and resource pickers inside their owning workflows. Do not manufacture broad directory grants to make a scoped write screen load.
- Implement published-comment review as an approval awaiting publication, with the new publisher command and existing versioned document replacement pipeline. Apply idempotency, stale-version conflicts, complete target checks and old-ready-revision visibility.
- Remap portal/system/owner command-and-action checks deliberately under C4. A teacher create/edit branch must not gain assessment deletion through ASSESSMENT_MANAGE, and a named delivery callback must not gain all announcement draft operations. Preserve any deletion already permitted by its original relationship policy. Check both old command boundaries and proposed targets.
- Validate ACCESS_CONTROL_MANAGE applied-profile edits against effective recipient authority as well as direct assignment; retain self/owner and all delegation restrictions.
- Remap portal/system/owner action sets deliberately. Use explicit S2S metadata instead of suffix/prefix inference. Keep selected-profile isolation, admission, assurance and elevated-service exceptions.
- Completion: every retained/new matrix row has an enforcing business policy and its allowed/denied scenario; retired identifiers are absent from runtime consumers, not merely hidden in the UI.

### W3 — Web, mobile and human-facing contracts

- Generate the frontend client from the changed backend checkout, then dependencies/setup using the existing repository commands. Use `bun run repo generate client staging --backend-root ../edaya_backend` to avoid preparing from an unrelated backend revision; follow with `generate dependencies` and `generate setup`.
- Show business labels and included operations from the reduced catalog; Manage means the documented operations and View remains a separate full-browse capability. Show consolidation-induced first-wins shadowing in previews.
- Drive permission/profile/manual/service/assignment pickers and badges from catalog metadata. Remove the school checkbox and the four hard-coded special-action lists. Hide scope/default fields and empty separators for unscoped actions. Preserve useful unresolved and stale-target warnings.
- Update route/navigation gates, context-aware web permission checks, workflow dialogs, dashboards, report-review/publication UI, translations and fixtures to canonical target identifiers. Keep permission context through class/grade/subject/year UI checks.
- Ensure scoped workflows load their bounded supporting records and show useful denied/empty states without requesting broad reads. Profile summaries show effective scopes only; the defaults editor still displays saved dormant selections.
- Update mobile action-name consumers, grant parsing/projection and teacher/guardian queries. Keep assignment relationships authoritative; never infer homeroom authority from a class ID embedded in a subject scope. Preserve profile-switch and late-response protection.
- Update affected frontend normative specs in the implementation change. The current audit files remain a proposal/history, not a competing runtime catalog.
- Completion: each representative job can finish its intended workflow using only its planned profile/relationships; invisible or unauthorized actions cannot be reached by bypassing the UI.

### W4 — Profile fixtures and development/staging preparation

- Rebuild seeded profiles using the reviewed matrix; remove retired identifiers, broad legacy query bundles and school input scopes. No role name becomes runtime authority.
- Create the representative fixture accounts below. Use explicit all-grain scopes only where the scenario needs all resources, with narrow defaults elsewhere. Keep unscoped permissions explicitly assigned and scope-free at input.
- Prepare a targeted authorization reset/reseed transaction and a dry-run report of affected rows. Do not invoke the existing school-database reset command: it drops unrelated business data.
- Clear permission arrays in preserved staff business assignments as part of the authorized permission reset, then apply explicitly defined fixture duties. Preserve placement records, teacher assignments and guardian links. Include ordinary service-account grants in the affected-row report. Do not infer replacements or assign every split successor to an old holder; reseed reviewed PlatformUser.permissions for the five platform capabilities while preserving operator identities/status, S2S access classes and credentials. Existing limited operator grants must not be promoted automatically to Manage.
- Snapshot affected authorization records, record a matching backend/web/mobile version set, and document restoration. Rehearse only in fresh disposable fixture schools first. Actual development/staging execution follows review of the targeted script and its concrete affected-row report; production remains outside scope.
- Completion: fresh fixtures contain only canonical identifiers and valid selections; no relationship/business/identity records or credentials are removed by the reset.

### W5 — Verification and release handoff

- Run the scenario matrix below through real policies/repositories and representative API/UI paths. Include counts/export and direct entity mutation parity where a named command adds restrictions.
- Run backend `bun run verify`, `bun run test:integration`, and `bun run test:integration:seed` because profiles/seeds change. Run frontend `bun run verify` and the affected permission/profile browser journeys. Run mobile `melos run verify` and affected teacher/guardian integration journeys.
- Check generated contract drift and retired identifier references after the coordinated build. Documentation history may retain old names; runtime code, generated active contracts and new fixtures may not.
- Capture results per scenario and per affected repository, plus fixture access previews and targeted reset rehearsal results. Record failures as incomplete; never substitute the current audit's static checks for runtime acceptance.
- Completion: required checks pass on the same revisions; assumption decisions are recorded; deployment/rollback instructions identify the exact matched artifacts. No production deployment is part of this work package.

## Representative fixture set

Use schools Alpha and Beta, academic years Y and Y+1, grade G with classes A/B, another grade H/class C, mathematics and language subjects in each class, and an activity shared by A/B. Include an unplaced activity, a new class created after grants, students S-A/S-B plus an unenrolled student, a guardian linked to children in both classes, a subject teacher, a homeroom-only teacher and a dual staff/guardian login. Include draft/submitted marks, draft/published reports, ready/failed document replacements, and current/ended/expired relationships.

| Account | Explicit authority and purpose |
|---|---|
| Unscoped auditor | ACCESS_CONTROL_READ only, with empty user selections; proves automatic unscoped resolution without mutation rights. |
| Class supervisor | Separate capture, maintenance and reviewer fixture accounts for A; attendance maintenance includes explanation entry, discipline maintenance includes cancellation. |
| Subject coordinator | Academic/mark/logbook/assessment actions for mathematics in G; no language or unrelated-grade authority. |
| Registrar | STUDENT_CREATE and PARENT_MANAGE for intake; separate caseload STUDENT_MANAGE/ENROLLMENT_MANAGE accounts prove creation and existing-student boundaries. |
| Health officer | STUDENT_HEALTH_READ/UPDATE for S-A; no general class health access or marks authority. |
| Cashier | PAYMENT_READ/RECORD/ALLOCATE for A; no reversal, catalog configuration or reconciliation. |
| Accountant | Explicit financial report/catalog permissions plus scoped payment reversal/cancellation as needed; no pedagogical write access. |
| Comment author | REPORT_CARD_COMMENT for assigned subject/class relationship; no review, publication or export grant. |
| Comment reviewer | REPORT_CARD_REVIEW_COMMENTS for A, with publication deliberately absent. |
| Report publisher/exporter | Separate accounts for REPORT_CARD_PUBLISH and REPORT_CARD_EXPORT; one combined account for integrated workflow validation. |
| Class sender | COMMUNICATION_SEND for A only, reading the prepared announcement through bounded workflow context. |
| Communications administrator | Explicit central content and broadcast actions; no implicit teacher-conversation oversight. |
| Activity manager | ACTIVITY_MANAGE and ACTIVITY_ENROLLMENT_MANAGE for one activity, plus minimal read; no other activity or class-transfer authority. |
| Assignment delegate | Exact mathematics lesson/assessment duty and a separate exact activity-session duty; no whole-class expansion. |
| Routine maintenance / observers | Separate STAFF_MANAGE, ASSESSMENT_MANAGE, TIMETABLE_MANAGE, COMMUNICATION_DRAFT_MANAGE and ACADEMIC_CATALOG_MANAGE accounts exercise their consolidated operations; companion View-only accounts prove mutation denial. |
| Profile editor | ACCESS_CONTROL_MANAGE with a narrow delegated subject grant; adding a broader action via a live profile must fail. |
| Platform observers / maintainers | Separate PLATFORM_USER_READ/MANAGE and S2S_CLIENT_READ/MANAGE accounts; limited old grants are not automatically promoted. |
| Portal/system/platform | Teacher, homeroom-only teacher, guardian, student, read/write S2S clients, ordinary service account, named delivery renderer/job and selected platform operator. |

## Acceptance scenarios

Every retained/new permission also has its own allow/deny requirement in the matrix. Execute related rows as parameterized business scenarios where appropriate; literal enum presence alone is not a test. A scenario is complete only after both allowed behavior and required denial are verified.

| ID | Allowed case | Required denial or boundary |
|---|---|---|
| SC-01 School | Unscoped structure read resolves with no selections; setup and lifecycle actors perform their own action. | No setup writes from workspace/read; no publication from SCHOOL_CONFIGURE; changed setup+state require both. |
| SC-02 Access | Earlier profile claims a permission; manual grants remain additive; valid bounded delegation succeeds. | Later broad profile cannot rescue unresolved earlier profile; no delegation beyond same action/year/validity; self/owner/service administration protections hold. |
| SC-03 Service | Authorized human provisions/rotates/revokes managed service account. | Ordinary service caller cannot administer service accounts; revoked key loses access immediately; generic staff writes cannot bypass lifecycle. |
| SC-04 Curriculum | Grade G mathematics allocation is read/edited, including future class allocation through explicit grade-subject selection; catalog reader sees unused definitions. | No language/grade H mutation or match through subject-name coincidence; shared catalog editing needs catalog action; all classes does not satisfy global configuration. |
| SC-05 Student/health/notes | Current A caseload reads permitted students; explicit S-A health officer and note author use separate capabilities. | Basic student read reveals neither health nor notes; transfer removes current cohort dossier access; another author/admin-only note remains protected. |
| SC-06 Guardians | A registrar reads contact and links necessary for S-A; guardian uses own contact fields. | Same guardian's unrelated child link hidden; class read cannot modify shared identity; guardian cannot change access flags. |
| SC-07 Enrollment | Destination-A enrollment and A→B transfer with both placements covered succeed. | Unauthorized destination fails atomically; creation picker exposes minimal identity only; class enrollment permission cannot administer activity participation. |
| SC-08 Discipline | A supervisor creates/edits/resolves covered incidents under the correct distinct action. | Every participant and old/new placement checked; maintenance permission cannot resolve sanctions; report-only authority cannot edit/cancel official records; partial multi-class incident change rejected. |
| SC-09 Attendance | Subject/session capture, class daily capture, register maintenance (including explanation entry) and review work within appropriate scopes. | Subject-only scope cannot record whole-class day; maintenance cannot approve; class A supervisor cannot correct B; counts follow detail scope. |
| SC-10 Assessments | Mathematics coordinator creates/edits/deletes covered assessments; scale admin maintains scales. | ASSESSMENT_MANAGE covers routine deletion but preserves state/dependency protections; scale authority cannot delete an assessment; generic writes cannot change protected review state. |
| SC-11 Grades | Subject mark maintenance and class correction review work under their separate actions; current submission workflow remains valid. | Other subject marks denied; homeroom-only input denied; published report sources cannot be generically unlocked; retired actions rejected. |
| SC-12 Reports | Author comments; reviewer approves; publisher applies revision; exporter issues published official document. | No author publication, reviewer issuance, exporter result mutation or premature family visibility; stale version conflicts; retries do not duplicate replacement. |
| SC-13 Logbook | Subject teacher/coordinator records/exports subject logbook; A reviewer validates it. | Homeroom-only relation cannot read all subject logs; unrelated subject/notes cannot be edited through logbook authority. |
| SC-14 Timetable/calendar | A coordinator schedules A; school setup admin changes holiday; document contains permitted teacher occurrences only. | Class schedule authority cannot mutate school holiday; aggregate export excludes/denies unauthorized occurrences and metadata. |
| SC-15 Finance catalog | Verified catalog manager creates/updates/retires service definitions. | Catalog edits cannot retroactively change issued charges or record payment. |
| SC-16 Finance | Cashier handles A student account; accountant reconciles with explicit global permission. | Allocation/reversal check every affected account; amount edits require record action; dashboard/read/receipt never expose uncovered debt or totals. |
| SC-17 Documents | Central records admin voids an eligible issuance; permitted source actor accesses allowed document. | Teacher/family cannot void; generic attachment grant cannot bypass source/purpose; stale source/replaced/failed document eligibility is rechecked. |
| SC-18 Feedback | Authorized manager/moderator/publisher performs the relevant campaign task. | No cross-school access or privacy-threshold bypass; moderation does not imply publication; portal participation remains relationship-bound. |
| SC-19 Conversations | Enquiry reader+replier responds; oversight staff reads teacher conversation. | Read alone cannot reply; oversight cannot reply/alter participant state; removed relationship stops new replies. |
| SC-20 Announcements | Class sender publishes fully covered prepared audience; broadcast actor sends school audience. | Class A cannot include B; all classes cannot target school/all-staff/direct recipient; human cannot materialize delivery rows directly. |
| SC-21 Activities/resources/files | Covered booking/activity/session operation succeeds; file access follows permitted owner/purpose. | Inventory authority cannot alter bookings; exact session cannot edit entire activity; class-only grant cannot alter shared activity outside its coverage; pending family enrollment grants no activity access. |
| SC-22 Queries/dashboard/self | Canonical reads replace aliases; cards use domain scopes; own selected-profile inbox and guardian-self remain available. | Workspace/dashboard entry alone reveals no domain totals; same-login profile switch inherits no staff access; removed aliases and relationship manual grants rejected. |
| SC-23 Platform/machines | Active selected operator administers allowed platform clients; S2S read/write classes use explicit metadata. | School owner has no platform grant; platform delegation cannot exceed held actions; rename does not grant read S2S mutation access; unknown system identity denied. |
| SC-24 Catalog/UI/contracts | Every active action has exact metadata and compatible selector; N actions have no selection/default badge. | No school input scope; no hard-coded exception list; no dangling replacement, unsupported picker grain, stale API artifact or unknown Dart scope on supported portal responses. |
| SC-25 Consolidated maintenance | Every group in consolidations.json exercises each included operation with the target permission; existing invariants and complete targets hold. | Every surviving View-only fixture denies its sibling mutations; Manage alone cannot browse a full directory or grant unrelated reads; protected deletion/owner/author rules still apply. |
| SC-26 Consolidated precedence | Two profiles carrying the same merged capability retain first-wins; preview/save agree; a separate manual grant remains additive. | Later profile cannot rescue an unresolved first binding or union a broader scope; no automatic assignment of all successors or hidden old-CRUD grants. |
| SC-27 Operation-preserving remap | Teacher permitted assessment authoring, guardian self-edits and named callback/job operations continue after renaming. | A teacher cannot gain deletion merely from merged ASSESSMENT_MANAGE; a delivery callback cannot delete drafts; read-class S2S cannot mutate; current unrelated denied operations remain denied. |
| SC-28 Applied profiles/platform | Access editor changes a live profile only within held action/scope/year/validity; new platform maintainers perform reviewed account/client lifecycle operations. | Live-profile edit cannot bypass delegation; no implicit promotion of old create-only/revoke-only operator grant; no identity/status/credential deletion in permission reset. |

For every scoped family, repeat its representative case with wrong school, wrong year, expired/future/inactive grant, deleted target, wrong subject parent, mixed permitted/unpermitted batch, and revoked relationship. Compare detail, list, count, pagination, aggregate and applicable export results. Include one same-action full-coverage success and one attempted combination of different actions' partial scopes. Run transfer/history and new-resource cases from S2–S5, not just static IDs.

## Existing verification entry points

Extend existing tests rather than duplicating policy logic:

- Core grant-scope validation and authorization assignment/delegation suites; service permission-profile/access-control workflow suites for resolution/preview/save.
- [Native SQL authorization suite](../../../package/adaptor-postgres/tests/authorization-policies-pglite.test.ts) for real repository predicates and resource boundaries.
- [Permission-profile workflows](../../../package/domain-service/tests/services/workflows/permission-profiles-workflows.test.ts), [marks review](../../../package/domain-service/tests/services/workflows/marks-review.test.ts), [teacher corrections](../../../package/domain-service/tests/services/workflows/teacher-corrections.test.ts), and native/integration document/marks tests for complete operations.
- [Web scope tests](../../../../edaya_frontend/apps/webapp/tests/lib/api/grant-scopes.test.ts), permission-form/profile browser journeys, contextual permission checks and generated-client checks.
- Mobile effective-grant parsing, teacher assignment/context queries, guardian inbox/profile-switch tests and live teacher/guardian journeys where available.

## Audit verification versus future acceptance

For the frozen audit, run `python3 docs/sprints/permission-scoping-audit/audit.py --check --baseline` and `git diff --check`. The validator verifies all 127 original identifiers exactly once; all 124 previous proposal capabilities map to 90 active targets; 82 are staff-assignable; every active target has a separation case and exact metadata; generated matrix/catalog, contract identifiers and links agree with the saved baseline. This mode does not verify current source freshness; plain `--check` reports drift after implementation changes. SC-25–SC-28 explicitly cover consolidation behavior. Readable audit counts are derived from the structured data. The audit validator does not execute permissions or certify runtime security. See the proof's executed checks separately; W1–W5 are not complete.

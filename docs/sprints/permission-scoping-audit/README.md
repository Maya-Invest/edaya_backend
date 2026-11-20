# Permission scoping simplification and catalog audit

Status: **reduced catalog and API/UI cutover implemented and verified locally; release qualification remains**. See [runtime cutover](runtime-cutover.md) for implementation, compatibility and deployment boundaries.

Audit date: 2026-10-16, America/Toronto. No application code, deployed configuration, database, generated API contract, or existing grant was changed by this audit.

The subsequent user-authorized [catalog/resolver proof](catalog-resolver-proof.md) changes backend code and tests using the existing 127 identifiers. The inventory and matrix's current-behavior descriptions remain the pre-implementation snapshot; the proof records the new behavior. The subsequent [runtime cutover](runtime-cutover.md) implements the 90-capability consolidation. Neither phase deploys or resets an existing environment.

## Deliverables and coverage

- [Catalog/resolver proof and executed verification](catalog-resolver-proof.md): implemented first slice, passing checks, compatibility boundaries and remaining work.
- [Implementation feasibility and value review](implementation-review.md): readiness findings, concrete design gaps, delivery gates and evidence needed to demonstrate value.
- [Reduced permission catalog](reduced-catalog.md): all 82 staff capabilities, five platform permissions and three intrinsic capabilities, with a realistic need-without-authority case for every remaining split. Start here for review.
- [Consolidation decisions](consolidations.json): the exact 22 merge groups and complete baseline of the previous 124-action proposal.

- [Permission decision matrix](permission-matrix.md): every existing identifier and every proposed addition, with current behavior, recommendation, users, scope, dependencies, allow/deny examples, and impact.
- [Structured matrix](permission-matrix.json): the same decisions plus exact proposed catalog metadata for every active target identifier. This is review data, not a runtime catalog.
- [Target specification](target-specification.md): scope semantics, internal representation, interfaces, resolver behavior, supporting reads, and before/after examples.
- [Implementation and acceptance plan](implementation-plan.md): ordered work packages, workflow scenarios, fixture requirements, and cutover boundaries.
- [Source inventory](evidence/source-inventory.json): per-permission backend, frontend, catalog/preset, generated-contract, tooling, migration, and test references, with source hashes.
- [Audit validator](audit.py): reproduces inventory, checks freshness, verifies matrix coverage and replacement destinations, and checks local document links.

The initial planning count of 123 was incorrect: a letters-only identifier scan omitted the four `S2S_CLIENT_*` actions. The enum contains **127 existing permissions**. The corrected inventory includes digits. Its current scope distribution is 86 without catalog scope, 23 class-group, 3 class-subject, 7 student, and 8 platform. Four of the 86 have a school/class validation exception. No permission currently declares grade-level, grade-subject, or activity as its catalog grain.

The revised matrix has 177 decision rows: 127 existing identifiers plus 48 proposal-only identifiers, including rename destinations and withdrawn names from the first draft. Existing dispositions are 46 keep, 19 split, 13 retire, 9 rename, and 40 merge. Rows describing obsolete proposal names are traceability records, not additional permissions. Each old identifier points directly to final successors or retirement; there are no chained aliases.

The resulting target has **90 active identifiers**, of which **82 are staff-assignable**, five are platform permissions and three are intrinsic relationship capabilities. The previous proposal contained 124 active actions and 113 staff-assignable permissions. This revision removes **31 staff choices (27.4%)** and 34 active identifiers overall. Runtime now has 90 declared identifiers; the 127-identifier inventory remains the historical audit baseline.

Routine maintenance is now one business capability: staff create/edit/archive, assessment create/edit/delete, timetable maintenance, announcement drafts and academic dictionary maintenance all consolidate. This rule is also applied to other routine maintenance and platform credential/account lifecycles. Dashboard entry becomes intrinsic, calendar viewing joins timetable viewing, and curriculum progress joins logbook viewing. Consolidations change the assignable catalog itself; profiles remain bundles, and there is no second layer of hidden CRUD permissions.

Every surviving split must name a realistic person who needs one capability while being denied its neighbor, or show incompatible resource boundaries. Those cases are in the reduced catalog and each active structured row's `review`. They are product assumptions to review, not findings from live usage telemetry. Read-only observers, independent review/publication, health, monetary reversals and unplaced-versus-placed records justify the retained boundaries. The exact 82 staff choices are the review baseline; adding or re-splitting a capability requires the same justification. Manage capabilities deliberately confer more operations than any one old CRUD grant, so reviewed fresh profiles replace automatic legacy-grant promotion.

Repository revisions inspected:

| Repository | HEAD |
|---|---|
| Backend | `7249ab73cf54a608e6a3357ec85971318d46a1eb` |
| Frontend | `b123af73b4ddc36861dcc327212147b730d88555` |
| Mobile | `7a59715105af3e1625b804baf7fa77986e795175` |

Source hashes, rather than HEAD alone, identify the working-tree evidence. Historical authorization audits were read as context, not as proof of current behavior.

## Method and evidence limits

The inventory searches exact identifiers in TypeScript, Svelte, Dart, JSON, and SQL across the three repositories, then groups matches by purpose. It excludes documentation/build output from usage claims. It also records context files whose generic policy or client code contains no permission literal. Reference counts show occurrences, **not executed coverage**. Generated enum membership, presets, owner enumeration, and generic `knownActions` checks are not evidence of a dedicated business-operation gate.

The review traced action selection in entity policies and named workflows, staff/profile resolution, teacher/family relationship policies, SQL scope compilation, assignment/delegation constraints, UI catalog filtering, and web/mobile grant consumers. Rows refer to the current enforcement mechanism below and retain all literal references in the inventory. For suspected unused actions, both the identifier references and the corresponding state-transition/document workflows were examined.

No live school assignments or production telemetry were queried. No application regression suite was run for this documentation-only change. The proposed allow/deny cases are acceptance requirements, not claimed passing results. The audit validator is the verification executed for these deliverables.

## Current enforcement and consumer map

| Area | Inspected source and behavior |
|---|---|
| Catalog and validation | [scope overrides](../../../package/domain-core/src/domain/permissions/permission-scopes.ts), [grant schema](../../../package/domain-core/src/domain/permissions/grant-scope.ts), [catalog route](../../../apps/api/src/routes/authorization.routes.ts). The API exposes only identifier plus optional single grain; unscoped staff grants require a `school` marker. |
| Profile/manual resolution | [selection compatibility](../../../package/domain-core/src/domain/permissions/permission-selections.ts), [resolver](../../../package/domain-service/src/capabilities/access-control/resolve-staff-profile-grants.ts). Compatible defaults/custom selections are combined, invalid targets warned, empty results withheld, earlier profiles claim an action even when unresolved. |
| Runtime staff/owner/system | [action policy](../../../package/domain-authorization/src/access/access-policies.ts), [facts](../../../package/domain-authorization/src/access/facts.ts), [projection](../../../package/domain-authorization/src/access/action-grants.ts). Policies apply live grants/relationships; owner/system authority is separate from ordinary manual scopes. |
| Entity business actions | [entity policies](../../../package/domain-authorization/src/access/entity-policies.ts). Resources bind explicit read/create/update/delete actions; alternative write actions must each cover the complete mutation. |
| SQL enforcement | [resource compiler](../../../package/adaptor-postgres/src/lib/resource-access-scope.ts). Tenant, placement, year, publication, attachment purpose and owner constraints apply before repository results. `all` stays grain-specific; it is not school authority. |
| Assignment and delegation | [placement policy](../../../package/domain-authorization/src/access/staff-assignment-policy.ts), [delegation](../../../package/domain-authorization/src/access/grant-administration.ts), [authority containment](../../../package/domain-core/src/domain/permissions/authority-scope.ts). Exact session/assessment placement is preserved; delegates must hold the same action, scope, year, and validity. |
| Portals | [portal policies](../../../package/domain-authorization/src/access/portal-policies.ts). Teacher subject/homeroom rights and family linked-student rights differ from staff grants and include field/publication restrictions. |
| Academic review | [marks review](../../../package/domain-authorization/src/access/marks-review-policies.ts), [teacher correction policy](../../../package/domain-authorization/src/access/teacher-corrections-policies.ts), [marks workflow](../../../package/domain-service/src/services/workflows/marks-review.ts), [teacher corrections](../../../package/domain-service/src/services/workflows/teacher-corrections.ts). Submission, review, and published-source protection are workflow rules. |
| Documents and reports | [report policy](../../../package/domain-authorization/src/access/report-card-policies.ts), [document policy](../../../package/domain-authorization/src/access/document-policies.ts). Publication currently covers comment writing/review and official report document generation; other documents follow their business source actions. |
| Finance and communication | [finance](../../../package/domain-authorization/src/access/finance-policies.ts), [announcements](../../../package/domain-authorization/src/access/communications-policies.ts), [conversations](../../../package/domain-authorization/src/access/conversation-policies.ts), [feedback](../../../package/domain-authorization/src/access/family-feedback-policies.ts). Reconciliation and central inbox/moderation have school-wide gates; sending checks the complete audience. |
| Service/platform | [assurance](../../../package/domain-authorization/src/permissions/permission-assurance.ts), [S2S access classes](../../../package/domain-authorization/src/s2s/access-class.ts), [platform policy](../../../package/domain-authorization/src/access/platform-policies.ts). Human-only, assurance, selected profile, platform delegation, and machine access-class rules supplement resource scopes. |
| Profiles and seeds | [invitation profiles](../../../package/domain-service/src/capabilities/onboarding/default-access-roles.ts), [presets](../../../package/domain-authorization/src/permissions/presets.ts), [profile seeding](../../../package/domain-service/src/capabilities/access-control/seed-staff-permission-profiles.ts). Presets include broad read bundles and several actions without dedicated gates; names never decide runtime access. |
| Web editing and gating | [scope mapping](../../../../edaya_frontend/apps/webapp/src/lib/api/grant-scopes.ts), [scope editor](../../../../edaya_frontend/apps/webapp/src/lib/smart-components/scope-builder/PermissionScopeSelections.svelte), [UI matcher](../../../../edaya_frontend/apps/webapp/src/lib/permission-check.ts), [assignment filter](../../../../edaya_frontend/apps/webapp/src/lib/api/staff-assignment-permissions.ts). Catalog grain drives options, four identifiers have hard-coded exceptions, and only platform entries are hidden from ordinary staff pickers. |
| Mobile | [grant parser/projection](../../../../edaya_mobile/packages/edaya_api_client/lib/src/effective_grants.dart), [teacher queries](../../../../edaya_mobile/apps/teacher/lib/live/entity_queries.dart), [school client](../../../../edaya_mobile/packages/edaya_api_client/lib/src/school_client.dart), [guardian inbox](../../../../edaya_mobile/apps/guardian/lib/features/inbox/inbox_controller.dart). Few literal permission strings does not mean no impact: clients parse scope kinds and build relationship-filtered requests. |

## Findings and recommended treatment

**F01 — “Whole school” is an extra activation requirement.** Missing catalog grain does not currently mean “assign and use”: the resolver still needs a compatible `school` selection. Removing just the checkbox would leave unscoped assignments unresolved. Resolve unscoped actions automatically, retain a server-produced internal marker, and remove it from user selection schemas.

**F02 — Scope capabilities are not fully described by the catalog.** Attendance validation, discipline validation, logbook validation, and report publication accept school/class scopes through hard-coded exceptions in core and web code. Default editors also offer grains with no current catalog consumer. Replace single-grain metadata with explicit supported kinds and assignment eligibility.

**F03 — Some selectable grants cannot authorize their advertised workflow.** `ACADEMIC_PROGRAM_UPDATE` is class-scoped but curriculum-wide configuration calls `assertSchool`. `COMMUNICATION_SEND` is class-scoped but non-class audiences require a school clause. Whole-teacher timetable document handling can likewise require school authority from a class-scoped read action. An `all(class_group)` grant does not satisfy these checks. Split shared catalog/broadcast capabilities and replace the timetable aggregate check with complete resource coverage; do not treat `all` as a school bypass.

**F04 — Operational scope is inconsistent within a workflow.** Attendance capture/read are class-scoped while update/justify are unscoped. Discipline read/update/archive are unscoped while create is class-scoped. Grades are class-scoped while exam create/read/update allow class-subject grants. Introduce consistent cohort and subject choices, with action-specific limits on daily versus subject/session attendance.

**F05 — Report publication bundles several responsibilities.** Teachers' constrained comment writes and staff correction review use `REPORT_CARD_PUBLISH`; report document issue also checks it. Separate comment authoring, comment review, academic publication, and official document issue. Activating the existing `REPORT_CARD_EXPORT` action avoids adding a duplicate export identifier. Review approval of an already-published comment must no longer automatically publish a revision without publication authority.

**F06 — Fifteen identifiers lack a direct backend business-policy reference.** They are `SCHOOL_STRUCTURE_READ`, `EXAM_CONFIG_LOCK`, `EXAM_CONFIG_UNLOCK`, `GRADE_LOCK`, `GRADE_UNLOCK`, `GRADE_PUBLISH`, `REPORT_CARD_LOCK`, `REPORT_CARD_UNLOCK`, `REPORT_CARD_SIGN`, `REPORT_CARD_EXPORT`, `TIMETABLE_LOCK`, `TIMETABLE_UNLOCK`, `PAYMENT_EXPORT`, `FINANCIAL_REPORT_EXPORT`, and `COMMUNICATION_APPROVE`. The matrix retains and wires structure read and report export, and retires the other thirteen. This is not a claim that all fifteen tokens are absent from the repository: presets, tests, generated contracts and owner enumeration still mention them. Inspected marks workflows own submission/correction locks; report workflows enforce publication immutability and hydrate existing signature assets; existing finance documents use actual read actions. No independent approval/lock/sign/bulk-export workflow was found for the retired identifiers.

**F07 — Query names mix duplicate reads and intrinsic personal access.** Directory/detail/attendance/timetable/curriculum aliases can merge into business reads. Workspace access, personal inbox access, and guardian self access must instead be hidden relationship capabilities. Aliases cannot simply be deleted from portal and system action sets. Preserve selected-profile and field restrictions while changing identifiers.

**F08 — Several capabilities cross unrelated business responsibilities.** School lifecycle includes settings/templates/assets; exam configure includes both assessment deletion and grade-scale administration; resource configure includes inventory, bookings and activities; logbook update includes student notes. The revised matrix separates these responsibilities while consolidating their routine maintenance: school settings join SCHOOL_CONFIGURE, assessment deletion joins EXAM_MANAGE, and note creation/editing join STUDENT_NOTE_MANAGE. Shared guardian identity edits, central financial reconciliation, feedback administration, official-document voiding and enquiry oversight remain unscoped deliberately.

**F09 — Supporting reads and aggregate reads need explicit boundaries.** Broad preset read bundles currently help screens load. A scoped write should load only the records and reference fields required for its workflow, without conferring a standalone directory or sensitive read. The existing overview action independently scopes many domains; the proposal makes dashboard cards intersect their own domain read authority and uses intrinsic WORKSPACE_ACCESS for entry, removing the proposed dashboard checkbox.

**F10 — Assignment eligibility and machine access also need catalog metadata.** Web assignment choices filter two grains; backend placements have their own mapping and an assessment allowlist; the legacy five-action assignment constant does not describe all accepted placement/action pairs. S2S read classification uses identifier spelling. Publish explicit placement eligibility and machine read/write class from the canonical catalog so renames and added scope kinds do not silently change eligibility.

**F11 — Scope hierarchy needs authorization tests, not just editor changes.** SQL can follow ancestors/parents, while the web matcher and delegation helpers have different structural shortcuts. In particular, the subject of a grade-level subject selection must survive traversal into class subjects, and a class-subject grant must not become class-wide write authority. The target defines relationship-aware containment and complete-target checks before exposing those choices.

**F12 — Mobile remains in the cutover.** Grant identifiers are strings and scope kinds have a hand-written parser. The teacher display helper collects class IDs even from class-subject scopes; it must never become proof of homeroom authority. Keep teaching relationships authoritative and test narrow subject access after contract changes.

**F13 — The first proposal retained unnecessary CRUD granularity.** Separate staff create/update/archive, assessment maintenance, draft creation/edit/removal and similar actions did not have sufficiently distinct intended users. Twenty-two consolidation groups now reduce the catalog. Some operation differences remain policy invariants: author ownership, protected deletion, review state, complete target coverage, and portal/system command admission. Merging action names must preserve those constraints; it must not give teachers or named jobs the complete staff meaning of Manage.

**F14 — Consolidation affects precedence and delegated administration.** First-wins now applies to the merged identifier, so old separate CRUD scopes cannot simply be unioned. ACCESS_CONTROL_MANAGE covers both profiles and assignments because edits to an applied profile also change authority. The target requires held-authority checks for live-profile edits and direct assignments. These are target requirements, not a claim that the current implementation has been exploited.

## Business assumptions requiring review

These are concrete recommendations used consistently in the matrix, not additional implementation choices. Product review may amend them before runtime work.

| ID | Proposed decision |
|---|---|
| A01 | School setup (structure, ordinary settings and calendars) has one central SCHOOL_CONFIGURE capability. Minimal workspace context is intrinsic; full setup read remains explicit. Lifecycle release stays separate because a director may release a year while a setup administrator cannot. |
| A02 | Routine human staff maintenance uses STAFF_MANAGE; access profiles and assignments use ACCESS_CONTROL_MANAGE; human service-account administration uses SERVICE_ACCOUNT_MANAGE. Separate read-only audit surfaces remain. Existing teacher administration through access workflows is retained; no campus/org-unit scope is introduced. |
| A03 | Shared subject dictionaries use ACADEMIC_CATALOG_MANAGE; placed curriculum construction/correction/synchronization uses ACADEMIC_PROGRAM_MANAGE with exact target checks. Global grading-scale administration stays separate. Shared dictionary browse includes unused definitions. |
| A04 | Student creation stays unscoped before placement; STUDENT_MANAGE corrects/archives existing caseload records. Health and pastoral notes remain independent. Guardian create/edit/archive use unscoped PARENT_MANAGE because shared identities span children. Grade/class caseload access follows current enrollment; recorded history stays anchored to its original placement. |
| A05 | Supervisors review whole classes/grades. Subject/session/activity capture is separate from official register maintenance and review. Attendance maintenance includes explanation entry; discipline maintenance includes correction/cancellation. Exact activity duty never implies class-wide daily attendance. |
| A06 | Existing marks submission and correction workflows remain authoritative. No new generic lock/unlock or separate marks-publication product is introduced. |
| A07 | Comment authoring, correction review, report publication and official report issue can be delegated separately. An approved correction to a published report waits for a publisher; family visibility stays on the previous ready revision until replacement succeeds. |
| A08 | TIMETABLE_MANAGE covers class/grade lesson scheduling; timetable viewing includes applicable calendars. SCHOOL_CONFIGURE controls calendars. Activity sessions follow activity management. |
| A09 | Cashier/payment and collection access may be delegated by current cohort or explicit student. Full reconciliation remains central. Catalog create/edit/delete use one financial-catalog maintenance capability. |
| A10 | Official-document voiding remains central. Existing receipt/finance document issuance follows source read permission; official report cards get a distinct export/issue permission. No new general bulk-export feature is introduced. |
| A11 | Feedback privacy/moderation, shared school enquiries and teacher-message oversight remain central. Teacher/family participation is relationship-driven; oversight cannot impersonate participants. |
| A12 | COMMUNICATION_DRAFT_MANAGE combines announcement draft creation/edit/removal. A supervisor may send a prepared announcement for covered classes/grades; school/all-profile/direct-recipient audiences require explicit broadcast authority. Content authority does not imply sending. |
| A13 | Shared resource inventory stays central; bookings are placed/scoped. Activities have explicit creation, management and participation capabilities. Generic file permissions always retain owner/purpose checks. |
| A14 | Dashboard entry is intrinsic; every card intersects its own domain read authority. Calendar and progress query surfaces merge into timetable/logbook reads. Minimal class rosters and overdue-debt collections retain independent read capabilities. Portal field/publication restrictions survive alias merges. |
| A15 | The five platform actions cover school registration, operator View/Manage and S2S-client View/Manage. They remain outside school grants. Reviewed PlatformUser.permissions are reseeded in development/staging; identity, active status, client bindings, access classes and credentials remain intact. |
| A16 | The consolidated Manage capabilities intentionally combine the listed routine operations; no create-only/update-only/archive-only subgrants remain. State, author, self/owner and dependency checks continue. First-wins operates on merged identifiers and must be visible in previews. |
| A17 | The remaining read-only observers and specialized responsibilities in the reduced catalog are valid school workflows, including standalone file inspection/maintenance under source-owner checks. If product review cannot confirm a case, merge or retire it rather than retaining speculative granularity. No live usage evidence is asserted. |
| A18 | Teacher/family relationship capabilities and admitted machine operations remain as narrow as their current operation/field rules after identifier merges. ACCESS_CONTROL_MANAGE enforces held-authority limits on applied-profile edits as well as direct assignments. |

## Review outcome and boundaries

Review the reduced catalog and its separation cases, matrix, assumptions A01–A18, exact target metadata and SC-01–SC-28 together. A16/A17 approve the broader maintenance operations and the retained read-only/specialist boundaries; C4 prevents unintended portal/job broadening. In particular, A07 adds a publication handoff to the existing comment-correction workflow; it is a proposed behavior change, not a description of current behavior.

The first-wins profile resolver, year-local defaults, explicit manual additions, school isolation, assurance, revocation, and relationship-based portal model are retained. The previously inspected source hashes remain unchanged; the inventory also records the platform permission record used by this revision. The source inventory grounds existing behavior; the consolidation manifest records the previous proposal and every reduced target. Development/staging **permission data** may be reset/reseeded after review; this is not permission to drop school databases, remove business records, reset identity, or deploy production. No reset or deployment has been executed.

To validate the proposal against its frozen pre-implementation evidence from the backend root:

```sh
python3 docs/sprints/permission-scoping-audit/audit.py --check --baseline
```

Baseline validation does not claim that the evidence describes the current working tree. It checks local link destinations, but historical source line numbers can drift and are not checked against changed files. Plain `--check` verifies source freshness and is expected to report drift after the proof changes. Use `--write` only when deliberately refreshing this audit's inventory, rendered matrix and reduced catalog after re-auditing changed source. It does not update application code.

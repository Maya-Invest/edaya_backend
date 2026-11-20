# Reduced catalog and client cutover

This is the user-authorized implementation following the catalog/resolver proof. The frozen audit continues to describe the original 127 identifiers. Runtime now declares 90 identifiers: 82 staff-assignable, five platform and three intrinsic capabilities. There are no compatibility aliases for removed identifiers.

## Implemented behavior

The core catalog owns scope policy, staff/service-account eligibility, assignment placements, S2S access, assurance and human-only requirements. The permission-catalog API exposes that metadata and the web controls consume it. Unscoped source assignments contain no selections and resolve to the internal school marker; this marker is not a selectable resource. Scoped assignments with no compatible selections remain ineffective. Defaults contain resources only. Mixed profiles, first-wins ordering, manual additions and preview/save resolution remain intact.

The web no longer offers Whole school. Unscoped permissions have no selector, default toggle or scope badge. Explicit All selections remain available for compatible resources. API schemas reject school selections in defaults, manual sources and profile bindings. Derived grants are changed through source commands, not generic entity saves.

The consolidated actions are used by policies, presets, seeds and client gates. Teacher assessment maintenance retains its operation restrictions; guardian self-updates do not acquire administrative create/delete authority. System delivery operations remain restricted to their named jobs. Dashboard counts use each business read capability. Health, review, publication, exports and finance cancellation/reversal retain independent checks.

Report-comment review now produces `approved_pending_publication`. A separate publication command applies the approved proposal and queues the replacement document. Existing ready PDFs remain available until rendering succeeds. Migration 0043 extends the correction-status check and pending uniqueness index; it does not reset permissions or delete business data.

Bounded assessment context and activity roster queries supply workflow reads without general grade/student dossier access. The activity roster exposes minimal identity fields, restricts eligibility to the selected activity and classes, and checks current authority again on every request. Shared activity edits cover all affected placements. Calendar configuration remains separate from class timetable management.

## Assessment terminology and review follow-up

The follow-up review renamed `EXAM_CONFIG_READ` to `ASSESSMENT_READ` and `EXAM_MANAGE` to `ASSESSMENT_MANAGE`, with no aliases. Both capabilities appear with mark viewing, entry and correction review under **Assessments and marks** / **Évaluations et notes**. Shared grading scales remain in Academic configuration. The matrix records both retired identifiers and their successors; the catalog remains at 90 capabilities, 82 staff-assignable.

Assessment navigation accepts assessment read/management independently of mark permissions. Creation, edit, deletion and direct edit/delete-modal submission check assessment management for the relevant class, subject and existing assessment. The editor checks both existing and proposed subjects, and reloads the definition through the bounded context so a setup-only user does not need a general assessment read grant. Setup-only users have no Grading tab.

The assessment context includes `markResults`, grouped by the assessments authorized by the independent mark-read scope. Setup-only users receive no mark groups. Authorized empty results remain distinguishable from unavailable marks, so the list and detail never present inaccessible results as zero progress. Results and class size use the current active roster, preserving the previous list's enrollment behavior; marks for departed students do not inflate current completion. Teacher and family relationship rules, including submitted-only family results, still apply.

Both issues identified by the readiness review are resolved. The local implementation is ready to begin broad workflow acceptance with fresh fixtures and matching backend/client contracts. This is not a production release approval; the coordinated environment rehearsal and complete release qualification below remain required.

## Compatibility and deployment

This is a coordinated breaking change. Old permission identifiers and user-selected school scopes are rejected. Do not deploy the backend alone against old clients or legacy authorization rows.

Local generated web and mobile clients use a disposable, committed snapshot of the working backend to satisfy the client tool's provenance check. This is verification provenance, not a release commit. Prepare clients again from the final committed backend candidate before deployment.

No existing environment has been reset or deployed by this work. Local browser rehearsal uses disposable databases and fresh seeded accounts. Production deployment and production data conversion require a separate plan.

## Development/staging cutover procedure

1. Stop writes and take a recoverable snapshot of the selected development/staging environment. Record the exact backend and client revisions and scope the operation to its intended schools.
2. Apply ordinary schema migrations, including 0043. Reset only permission source/materialization data: staff profile bindings, manual assignments, defaults, staff permission assignments, permission profiles and their seeded assignment permissions. Preserve staff/teacher/guardian/student identities, school ownership, academic/business records, accounts, credentials and unrelated assignment placements.
3. Rebuild reviewed presets and assignment permissions through the access seeding workflow. Reconfigure platform operators with the reviewed platform vocabulary while preserving identity, status and keys. Do not automatically promote a legacy create-only grant into a broader Manage capability.
4. Start matching backend/web/mobile versions, invalidate cached authorization/catalog views, and sign in with fresh representative accounts. Exercise both allowed workflows and denied neighbors, including teacher/family profile switching and relationship removal.
5. Compare list/detail/count/export access, preview/save resolution and mixed-profile ordering. Keep the environment unavailable if any gate fails; restore its coordinated snapshot and versions rather than mixing old and new contracts.

A broad database reset or deletion of unrelated business data is not part of this procedure. The seed workflow is safe to rehearse only in disposable databases unless its target and reset boundary are explicitly selected.

## Verification record

Local verification performed on 2026-10-17:

| Check | Result |
|---|---|
| Frozen audit, `python3 docs/sprints/permission-scoping-audit/audit.py --check --baseline` | Passed: 127 original identifiers, 90 target capabilities, 82 staff-assignable; every disposition remains accounted for. |
| Backend TypeScript workspace checks | All 19 configured tasks passed, including an API rerun after correcting test-fixture typing. Service and Postgres checks also passed after the final updates. |
| Backend repository hygiene and generated OpenAPI drift | Passed. |
| Core, authorization and seeding tests | 486 passed, including mixed profiles, empty resource scopes, delegation, lifetime, ordering, current relationships and portal isolation. |
| Native Postgres/PGlite authorization policies | 43 passed, including bounded assessment context, separate setup/mark authority, subject-restricted results, list/count/detail parity, old/new targets, batch rollback, finance and relationship removal. A final five-case assessment rerun also passed after adding actual create/edit/delete and active-roster coverage; reruns are not additive. |
| API suite | 395 passed across 79 files, including the new context routes, assignment schemas, service accounts, portal boundaries and document publication/export races. |
| Service regression coverage | Clean readiness-review run: 904 passed, zero failures across 126 files. The subsequent assessment follow-up is covered by the native policy/workflow tests below and service TypeScript checks. |
| Local PDF rendering | 13 passed with Chrome access. The initial sandboxed renderer timeout was resolved by this rerun. |
| Web unit/state tests | 1,110 passed. |
| Web Svelte/TypeScript checks and production build | Passed; zero Svelte diagnostics. Webadmin TypeScript checks also passed. |
| Mobile repository CI verify | Passed analysis and unit/widget tests across its packages with the regenerated contract. |
| Fresh HTTP fixture seeding | Passed: 30 students, five staff, 12 accounts, 205 permission rows and two staff assignments in a disposable environment. |
| Assessment browser regression | Passed English desktop and French mobile controls, setup-only/marks-only/unrelated-subject grants, direct edit/delete URLs, authorized progress/averages, unavailable statistics and localized grouping. Registered in focused browser qualification. |
| Permission browser journey | Passed English/French desktop/mobile layouts, keyboard disclosure controls, profile ordering, defaults, manual grants, previews, stale-response protection, source mutation and scope badges. Unscoped-only profiles also resolve without selections and show neither scope badges nor a misleading missing-scope label. |

Web and mobile clients were regenerated against the same local backend snapshot (`83ca5a78880105978fcd8b1b125aa46765424977`); current OpenAPI drift checks confirm the generated contracts still match after the final fixture, roster-filter and label corrections. The previous proof's 533 tests remain historical evidence and are not added to these counts. Overlapping focused reruns are not additive coverage. The browser produced no page errors; development-mode Svelte `derived_inert` console warnings occurred during navigation/race exercises while stale-preview protections passed.

This is local implementation evidence, not production release qualification. A single clean full-monorepo qualification run and the coordinated development/staging rehearsal against the chosen release revisions remain release gates. The browser rehearsals cover permission administration and the assessment UI; the audit's wider business scenarios rely on the listed policy/service/API tests and still require representative workflow acceptance during staging cutover. No existing environment was reset or deployed.


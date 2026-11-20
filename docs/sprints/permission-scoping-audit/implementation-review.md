# Implementation feasibility and value review

Status: **historical feasibility review**. The verdict and implementation gaps below describe the pre-implementation assessment.

Follow-up: the user authorized the [catalog/resolver proof](catalog-resolver-proof.md), then the [runtime cutover](runtime-cutover.md). The latter implements operation-aware merge boundaries, bounded assessment/activity supporting reads and separate report-correction publication. Its verification record supersedes the open-gap status below. Deployment remains a separate release gate.

## Verdict

The existing architecture supports the target. No authorization-engine replacement, role-based runtime rules, profile-precedence redesign or production grant migration is required. The strongest benefits are automatic unscoped resolution, consistent catalog-driven scope choices, and resource-bounded workflows. Reducing staff choices from 113 in the first proposal to 82 helps, but that count alone does not demonstrate a usable product.

The proposal is sufficiently developed to plan delivery. It is not yet a fully specified implementation contract in three areas: operation-aware authorization after merges, supporting-read interfaces, and the report correction publication lifecycle. These are tractable design tasks rather than reasons to abandon the direction. Complete them before changing their affected policies and clients.

## Findings

### R1 — High priority: define the internal operation contract before merging permissions

[C4](target-specification.md#consolidation-contract-c1c6) correctly requires teacher, family and machine operations to remain narrow. However, [AccessPolicies.scope](../../../package/domain-authorization/src/access/access-policies.ts#L68) and [teacherPolicy](../../../package/domain-authorization/src/access/portal-policies.ts#L118) currently carry only read/write intent. [Entity deletion](../../../package/domain-authorization/src/access/entity-policies.ts#L133) calls the shared resource assertion with write intent. System admission in the same policy layer is primarily an action-name allowlist.

Assessment creation/update and deletion currently use different permissions. Simply mapping all of them to EXAM_MANAGE would remove that distinguishing information before the teacher policy decides access. This is a concrete regression risk, not a claim that the current code permits the proposed broadened access.

**Required refinement:** define internal operation context for entity create/update/delete and the existing named workflow commands, and propagate it through write authorization and portal/system admission. It is not another assignable permission. Entity save derives create/update from existence; deletion supplies delete; named workflows supply their command operation. Deny missing/unknown operation context on restricted write paths. Update effective-grant displays and client action checks so a relationship-derived Manage label cannot imply every staff operation.

**Exit evidence:** staff EXAM_MANAGE can perform permitted draft maintenance; the same teacher relationships retain their existing create/update/deletion boundaries. Named delivery callbacks retain their admitted operations without gaining draft deletion. Include direct generic entity writes/deletes and batches, not only named commands (SC-25, SC-27).

### R2 — High priority: make supporting reads usable without widening browse access

[C2 and the D-* dependencies](target-specification.md#3-supporting-reads-and-special-workflows) promise bounded context reads for Manage-only workflows while keeping full View permissions separate. Those dependencies describe the intended data, but do not yet identify exact request/response schemas, routes or client loaders.

This matters in current clients: [fetchClassAssessmentsSources](../../../../edaya_frontend/apps/webapp/src/lib/api/assessments-data.ts#L40) loads assessments, subjects, enrollments and **assessment results**. [The generic entity policy](../../../package/domain-authorization/src/access/entity-policies.ts#L26) protects assessment results with grade-read authority. A person allowed to manage assessments without reading marks would encounter a forbidden dependency if that loader were merely renamed. [Staff navigation](../../../../edaya_frontend/apps/webapp/src/lib/navigation/nav-catalog.ts#L32) also assumes directory-read authority; Manage-only entry needs deliberate treatment.

**Required refinement:** for each pilot workflow, specify the entry route, supporting-read request, returned fields, resource predicate and client loader. Use an operation-bounded context/picker endpoint where a narrower projection is needed. Split assessment setup from mark-result loading. Use explicitly reviewed View+Manage profiles where the job genuinely needs both; do not grant broad reads merely to unblock a form. The current generic entity read mechanism must not silently become a directory/export bypass.

**Exit evidence:** a permitted manager can navigate to and complete the task with only its planned profile; an assessment editor without GRADE_READ can maintain an assessment without seeing marks; the same caller still cannot use unrelated lists, counts or exports. Covers SC-04, SC-10, SC-25 and the remaining workflow-specific cases.

### R3 — Medium priority: finish the report handoff as a separate business workflow

The [report comment handoff](target-specification.md#report-comment-handoff) is a product behavior change. Today [approval](../../../package/domain-service/src/services/workflows/teacher-corrections.ts#L185) applies the proposal and [requests the replacement document](../../../package/domain-service/src/services/workflows/teacher-corrections.ts#L252). The target inserts approval pending publication and a separate publisher command.

The target specifies version conflicts and keeping the last ready family-visible revision, but leaves the recovery transition for a stale approved correction unclear. Existing decision commands require pending status. “Reviewed against the current version” therefore needs an explicit transition/command rather than an assumption that the current review command accepts the new state.

**Required refinement:** write the state/event table for approve, reject, withdraw/cancel, publish, stale-source conflict, render failure and retry, including permitted actors, notifications, queue visibility, idempotency and current-authority checks. Treat this as a separately reviewed slice before enabling the new report review/publication split. It can be built after the core simplification; do not silently release the split without its workflow or remove it from the final catalog without product review.

**Exit evidence:** no approved correction becomes stranded; approval alone cannot change official family-visible output; publish/retry cannot duplicate or expose failed revisions; the ordinary combined reviewer/publisher journey remains practical (SC-12).

### R4 — Medium priority: demonstrate workflow value before the final cutover

The current backlog has useful policy scenarios and representative accounts, but most profile rows describe intent rather than an exact set of permissions/selections. Eighty-two choices still constitute a large administrative catalog. The value depends on useful profiles, clear previews and working scoped screens.

**Required refinement:** specify exact pilot profile memberships and resource defaults, then use those same fixtures in API and browser acceptance. Keep role names descriptive only. Measure task completion, unexpected authorization failures, workaround grants and setup steps against the current flow. Record setup time/errors where a school administrator can participate; until then, do not claim measured human usability improvements.

## Recommended execution gates

Preserve W1 → W2 → W3 → W4 → W5 as the dependency order. Pull fixture design and relevant verification forward into each slice; W5 remains the full cross-repository qualification. Build unpublished slices on a coordinated change set and perform one matched cutover. This does not require compatibility aliases or a second evaluator.

1. **Close R1–R3 contracts and define pilot profiles.** Keep the 90-capability matrix as the review baseline; do not add permission granularity to solve implementation details.
2. **Prove the core path.** Canonical catalog, automatic unscoped grants, mixed profiles, defaults, first-wins, expiry/revocation, preview/save equivalence, and scope-free UI for unscoped actions.
3. **Prove two complete scoped journeys.** Class-supervisor attendance and subject-specific assessment/mark authoring. Include supporting reads, existing/proposed targets, teacher isolation, direct APIs and browser entry. This tests the hardest reusable machinery early.
4. **Complete the remaining families in bounded slices.** Students/enrollment/health, finance, communications/activities, administration, then the explicitly gated report handoff and platform changes. Preserve list/detail/count/export parity throughout. Platform consolidation is lower direct school-user value and should not delay the pilot proof.
5. **Rehearse the full target.** Fresh representative fixtures, coordinated backend/web/mobile artifacts, targeted authorization reset and rollback rehearsal, and all SC-01–SC-28 cases. Production remains outside scope.

## What constitutes real value

| Outcome | Required demonstration |
|---|---|
| Simpler unscoped assignment | Assign an unscoped capability with no scope/default control; preview and save both show effective access. |
| Predictable scoped access | A class-A supervisor completes attendance maintenance/review with their intended capabilities; class B, wrong year, unauthorized batch targets and empty selections remain denied. |
| Independent responsibilities | Assessment maintenance works without mark access; a cashier cannot reverse payments; health remains separate from basic student data. |
| Fewer administrative decisions | Reviewed job profiles complete their tasks without editing dozens of individual permissions or adding workaround broad grants. Record the actual before/after setup steps. |
| Lower maintenance cost | One catalog drives selectors/validation; the four permission-specific frontend scope exceptions disappear; every active target has enforcing policy and acceptance coverage. |
| Preserved portal behavior | Teacher/family journeys and relationship removal pass after remapping, with no staff-authority inheritance or newly admitted machine operations. |

## Positive evidence and review limits

The shared [plan/save resolver](../../../package/domain-service/src/capabilities/access-control/resolve-staff-profile-grants.ts#L86) already provides an appropriate home for automatic unscoped resolution and unchanged precedence. [Applied-profile editing](../../../package/domain-service/src/services/workflows/access-control.ts#L189) already runs inside atomic execution and invokes the actor-aware planner; preserve and extend that mechanism instead of inventing a separate grant engine. Typed resource scopes, tenant-aware repository filtering, explicit portal policies, and existing profile/SQL authorization tests provide a substantial foundation.

The audit validator passes for all 127 current identifiers, all 124 prior-proposal mappings, 90 active targets and 82 staff choices. This review is based on source inspection and static audit checks; no new runtime implementation or regression run was performed. Feasibility is well supported, while runtime correctness and actual school-user benefit remain outcomes to demonstrate through the gates above.

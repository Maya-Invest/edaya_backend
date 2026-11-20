# Catalog/resolver proof

Status: **historical proof, implemented and verified locally**. This records the first user-authorized slice of W1/W2 against the then-current **127 identifiers**. The subsequent [runtime cutover](runtime-cutover.md) implements the **90-capability catalog**, workflow policy changes and clients. Counts and observations below describe the proof snapshot; they are not the current runtime catalog. No existing environment was deployed or reset.

## Result

Automatic unscoped grants work through the existing profile/manual resolution path used by preview and save. Resource permissions remain ineffective without compatible targets. The proof preserves profile ordering, first-wins ownership, manual additive grants, delegation, status, validity, school/year boundaries and selected-portal isolation.

The core [permission catalog](../../../package/domain-core/src/domain/permissions/permission-catalog.ts) now explicitly records scope policy and staff assignment eligibility for every current identifier. An omitted entry fails compilation; unknown runtime identifiers fail closed. Authorization's definitions, core grant validation and staff profile/manual validation use that catalog. Existing single-grain consumers receive a compatibility projection.

The current policy distribution is **82 unscoped, 37 resource-scoped and 8 platform**. These counts describe current identifiers, not the target's separate count of 82 staff capabilities. The four legacy review exceptions are included among the 37 resource permissions: attendance validation, discipline validation, class logbook validation and report publication. Their old single-grain field is absent, but that absence no longer makes them automatically unscoped.

## Behavior proved

| Case | Observed result |
|---|---|
| Assign unscoped access-audit read with no selections | Preview adds one internal school grant; save produces the same result. Preview persists nothing. |
| Unscoped manual source uses old school/default inputs | Stored domain source normalizes to `customScopes: []`, `useDefaultScopes: false`. Resource selections are rejected for that source. |
| Mixed profile contains unscoped, class, subject and review permissions with no selections | Only the unscoped permission resolves; resource permissions report `missing_scope`. |
| Add a class default to that profile, then clear it | Compatible class/review grants appear, then disappear. The unscoped grant remains; the incompatible subject permission stays unresolved. |
| Duplicate permission in ordered profiles | First profile owns it. Reordering changes the owner; removing the owner reveals the next profile. An unresolved earlier scoped profile still shadows later profiles. |
| Manual grant accompanies an unresolved profile | The compatible manual grant remains independently effective and can be revoked independently. |
| Unscoped source is inactive, expired, future-dated or past its end | Generated grant retains the source lifetime; real access policies deny access. |
| Active automatic grant used in another school/year or after revocation | Access is denied. A neighboring, unassigned action also remains denied. |
| Administrator assigns an unheld unscoped permission with empty selections | Preview and save both deny delegation; no source or generated grant is persisted. |
| Resource permission has empty, wrong-grain or school selection | It does not resolve. Explicit compatible All retains existing normalization behavior. |
| Four review exceptions have empty selections | No authority. Explicit class or legacy school selection remains required. |
| Platform or unknown identifier is passed to staff resolution | No platform grant; unknown identifier throws. Platform permissions remain invalid in staff profiles/manual assignments. |

Evidence lives in the new [core catalog tests](../../../package/domain-core/tests/unit/value-objects/permission-catalog.test.ts), [authorization catalog tests](../../../package/domain-authorization/tests/unit-auth/permission-catalog-queries.test.ts), and [profile workflow tests](../../../package/domain-service/tests/services/workflows/permission-profiles-workflows.test.ts). Existing SQL and portal regression tests cover enforcement beyond the resolver.

## Internal representation and compatibility

Unscoped source assignments carry no selections. Their effective grant uses the existing `{ kind: 'school' }` internal marker, within its staff, school, academic-year and validity boundaries. This reuses existing policy/storage semantics without adding another grant representation or changing precedence. Shared profile/default selections are ignored for unscoped members of a bundle and continue to constrain its resource members.

The public catalog response still exposes its existing `scope` projection. Public selection schemas, preset expansion, defaults and the UI still accept/show school selections where they did previously. The four review capabilities temporarily retain explicit school grants through catalog compatibility metadata; empty selections never create those grants. Removing these compatibility paths requires the planned API/UI and review-policy cutover.

This proof does not move service-account, S2S, assurance or business-assignment eligibility into the canonical metadata yet. It does not add relationship-only catalog entries, new hierarchy containment, grade/activity selections, consolidated identifiers or expanded scope support. Current unscoped actions that the target matrix proposes to scope retain their current classification here.

## Executed verification

All commands ran from the backend root against this working tree:

| Check | Result |
|---|---|
| Entire core and authorization test directories | **435 passed, 0 failed**, 83 files |
| Relevant service workflows plus native SQL policy regression tests | **98 passed, 0 failed**, 8 files |
| Core, authorization and service TypeScript checks | Passed |
| ESLint on all 14 changed/new TypeScript files | Passed |
| `bun run repo check` | Passed: environment/layout, runtime/import boundaries, generated API freshness and test naming |
| Frozen audit validation and whitespace check | Passed; preserves the pre-implementation source inventory |

Reproduce the runtime tests and package checks:

```sh
bun test package/domain-core/tests package/domain-authorization/tests
bun test \
  package/domain-service/tests/services/workflows/permission-profiles-workflows.test.ts \
  package/domain-service/tests/services/workflows/access-control-workflows.test.ts \
  package/domain-service/tests/services/workflows/guardian-preferences-policy.test.ts \
  package/domain-service/tests/services/workflows/guardian-link-policy.test.ts \
  package/domain-service/tests/services/workflows/teacher-corrections.test.ts \
  package/domain-service/tests/services/managed-entities/teacher-attendance-record.test.ts \
  package/domain-service/tests/services/staff-assignment-read-access.test.ts \
  package/adaptor-postgres/tests/authorization-policies-pglite.test.ts
bun --filter @edaya/core check
bun --filter @edaya/authorization check
bun --filter @edaya/service check
bun run repo check
python3 docs/sprints/permission-scoping-audit/audit.py --check --baseline
git diff --check
```

The 533 passing tests include real policy calls and PGlite SQL filtering, counts and target checks; they are not a claim that every proposed matrix workflow is implemented. Full cross-repository builds, browser/mobile journeys, deployment integration and seed/reset rehearsal were not run for this slice.

## Next implementation gates

1. Review the existing-to-target identifier and scope changes. Add the remaining canonical metadata and public contracts, then coordinate client consumption and removal of school selections/default controls for unscoped permissions.
2. Implement new containment and workflow policy semantics per family. Close operation-context, bounded supporting-read and report correction/publication details before implementing affected consolidations, as recorded in the [feasibility review](implementation-review.md).
3. Rebuild representative fixtures and rehearse a targeted permission reset with coordinated backend/client versions. Run the full acceptance suite before cutover.

Existing unresolved unscoped profile/manual requests can acquire effective authority when regenerated under the new rules. This is the intended behavior change and must be visible in the eventual fixture/reset rehearsal; this local proof must not be treated as a standalone deployment or silent migration. The audit's source inventory remains the original snapshot; `--baseline` validates proposal consistency without certifying source freshness.

# Service Layer Security Action Plan

Date: 2026-06-03

This plan addresses the findings in `docs/service-layer-security-audit.md`.

## P0 - Central Service Guard Fixes - Fixed

1. Fixed: `ManagedEntityService.count()` now loads matching entities, applies tenant checks, applies configured row access, and returns the authorized count.
   - Regression coverage: `ManagedEntityService > count applies tenant and row access checks`.

2. Fixed: unresolved tenant resolution now denies by default in `ensureEntityTenant()`.
   - Regression coverage: `ManagedEntityService > rejects entities whose tenant cannot be resolved` and `BaseSchoolService managed entity wiring > rejects orphan class subject progress before save`.

3. Fixed: `authorizeExistingById()` now checks proposed entity access and existing entity access; relationship-owned configs that need parent checks override it explicitly.
   - Regression coverage: direct student note and subject matter authorization tests.

## P1 - High-Risk Entity Config Parity - Fixed

4. Fixed: `studentNoteConfig` save authorization now checks proposed `studentId` with `checkStudentAccess()` while preserving author/admin-only gates.
   - Regression coverage: `student note direct save requires proposed student access`.

5. Fixed: `classSubjectProgressConfig` now checks session access for reads/writes/deletes and validates parent existence, class/session consistency, duplicate progress, and decreasing progress.
   - Regression coverage: orphan progress and session-access direct save tests.

6. Fixed: behavior direct configs now enforce incident class/session/student context, student incident scope, duplicate involvement, disciplinary catalog/involvement consistency, incident dependency deletes, and terminal disciplinary action gates.
   - Regression coverage: workflow parity tests plus managed-service terminal status and incident-scope tests.

## P2 - Lifecycle And Delete Protection - Fixed

7. Fixed: `studentClassEnrollmentConfig` now authorizes proposed `classGroupId`, validates active student, class school/year, duplicate active enrollment, capacity, and blocks active/progression enrollment deletes.
   - Regression coverage: direct capacity bypass and active delete test.

8. Fixed: published report cards and assessment results linked to published report-card periods cannot be deleted directly.
   - Regression coverage: published report card and linked assessment result delete test.

9. Fixed: dependency `preDelete` gates were added for student, guardian, class group, fee, student fee, payment, report card definition, report card section, announcement, resource, and staff member.
   - Policy: hard delete is blocked while inbound/dependent records exist; payment deletes are blocked once terminal or attached.
   - Storage-level constraints remain a repository/persistence follow-up under P3.

## P3 - API Surface And Regression Harness

10. Decide whether `BaseSchoolService` managed entity services are public.
    - If public: every config must be complete and tested.
    - If internal: restrict export/use and expose workflow/application methods for scoped actors.

11. Add an authorization parity test suite.
    - Cover actor kinds: admin, coordinator, teacher, accountant, guardian, student, system.
    - For each entity: read/list/count, create, update same parent, update moved parent, delete.
    - Include cross-school, orphan-parent, and dependency-present cases.

12. Add config lint checks.
    - Fail when an indirect-tenant config has no `preSave` parent existence gate.
    - Flag no-op write/delete authorization on actions available to scoped actors.
    - Flag no `preDelete` gate for entities listed in the dependency matrix.

## Suggested Implementation Order

1. Fixed: P0 central guard fixes.
2. Fixed: P1 direct-service parity for notes, progress, and behavior.
3. Fixed: P2 delete/lifecycle gates.
4. Remaining: P3 public API decision and automated config linting.

## Acceptance Criteria

- No direct managed entity service can read, count, create, update, or delete a row that the actor could not access through the intended workflow/query path.
- Orphan linked entities cannot be created through service saves.
- Published report cards and their supporting results cannot be mutated or deleted through direct services.
- Every delete operation has an explicit documented policy and a corresponding test.

# Service Layer Security Audit

Date: 2026-06-03
Scope: `packages/core/src/services` & `packages/core/src/shared`

---

## Executive Summary

Following the execution of the **Service Layer Security Action Plan**, the security posture of the new service layer has been significantly hardened. 

All **P0 (Central Service Guard Fixes)**, **P1 (Entity Config Parity)**, and **P2 (Lifecycle and Delete Protection)** issues—originally labeled **Findings F1 through F8**—have been **fully resolved** in the codebase. Managed entity configurations now correctly mirror workflow-level security constraints, and `ManagedEntityService` enforces strict tenant isolation and access checks across all endpoints.

A remaining gap has been identified where **Finance and Scheduling workflows bypass module write checks** via `moduleChecked: true`.

---

## Finding Resolution Status

| Finding ID | Title | Status | Verification & Test Coverage |
| :--- | :--- | :--- | :--- |
| **F1** (High) | `count()` bypasses row/tenant checks | **RESOLVED** | Loads matching entities first, then runs tenant/access checks. Covered by `ManagedEntityService > count applies tenant and row access checks`. |
| **F2** (High) | Missing tenant resolves allow orphan writes | **RESOLVED** | Falsy tenant resolution now denies by default. Covered by `rejects entities whose tenant cannot be resolved` tests. |
| **F3** (High) | `authorizeExistingById` checks old context only | **RESOLVED** | Updated to authorize both proposed and existing entity states. Verified via direct student note and subject matter tests. |
| **F4** (High) | Academic progress bypasses session access | **RESOLVED** | Added class group/session checks to read/write/delete configs. Covered by `orphan progress and session-access direct save` tests. |
| **F5** (High) | Direct behavior configs weaker than workflows | **RESOLVED** | Configs now enforce incident scopes, duplicate involvements, and terminal status checks. Covered by behavior parity tests. |
| **F6** (Medium) | Enrollment config lacks target class/lifecycle gates | **RESOLVED** | Added active status, school consistency, capacity, and active delete checks. Covered by capacity bypass and active delete tests. |
| **F7** (Medium) | Published report cards lack delete block | **RESOLVED** | Added `preDelete` gates for published report cards and assessment results. Covered by publish result delete tests. |
| **F8** (Medium) | Delete operations lack dependency gates | **RESOLVED** | Added inbound reference check gates for all master entities. Covered by delete dependency policy test suite. |

---

## Detailed Audit of Resolutions

### 1. Centralized Security Enforcement (`ManagedEntityService`)
* **`count()` Safety**: In [managed-entity-service.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/services/managed-entity-service.ts#L115-L121), the `count` query now correctly mirrors `list()` by retrieving matching entities, enforcing tenant validation, and checking row-level access permissions.
* **Fail-Closed Tenant Isolation**: In [managed-entity-service.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/services/managed-entity-service.ts#L214-L218), `ensureEntityTenant` now rejects access if `schoolId` resolves to `undefined` or a falsy value, eliminating the risk of orphaned writes bypassing tenant validation.
* **Dual-State Authorization**: In [authorization.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/shared/entity/authorization.ts#L36-L42), `authorizeExistingById` now ensures that both the proposed entity changes and the existing database state are validated against row-access checks.

### 2. Configuration & Gate Hardening
* **Academic Progress**: [class-subject-progress.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/services/entity-configs/academics/class-subject-progress.ts) now checks `checkSessionAccess` on read and write paths. It includes a `preSave` gate enforcing parent matter/session consistency, duplicates, and non-decreasing completion percentages.
* **Enrollments**: [student-class-enrollment.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/services/entity-configs/students/student-class-enrollment.ts) enforces active student checks, duplicate active enrollment blocks, capacity constraints, and blocks deleting active or decided enrollments.
* **Immutability of Published Records**: Deletions are now blocked for published report cards in [report-card-result.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/services/entity-configs/assessments/report-card-result.ts#L78-L86) and assessment results linked to published report cards.
* **Delete Dependency Gates**: Master data entities (such as `Student`, `Guardian`, `ClassGroup`, `Fee`, `Payment`, `StaffMember`) now have `preDelete` gates that query their dependent relationships, preventing cascading integrity issues.

---

## Remaining Security Gaps & Action Items

### 1. High Risk: Workflow Bypass of Module Write Permissions
While direct `BaseSchoolService` saves now correctly enforce actions, the service workflows in `SchoolService` frequently invoke operations with `{ moduleChecked: true }` but forget to perform the global module-level write check themselves:

* **Finance Workflow** (`finance.ts`):
  * `assignFeeToStudent` calls `studentFees.save(..., { moduleChecked: true })` but **never** checks the global action `finance.manage`. This permits scoped actors (like teachers or guardians linking students) to assign fees.
  * `recordPayment` and `updatePaymentStatus` call `payments.save(..., { moduleChecked: true })` but **never** verify `finance.manage`, allowing unauthorized payment logging or reversals.
* **Scheduling Workflow** (`scheduling.ts`):
  * `generateSessions` calls `sessions.save(..., { moduleChecked: true })` but **never** checks `scheduling.manage`.
  * `recordAttendance` (and bulk attendance variants) call `attendance.save(..., { moduleChecked: true })` but **never** check `attendance.record`.

#### Recommendation:
Add explicit module action checks inside the workflows before saving:
```typescript
// Example fix in recordPayment (finance.ts)
await this.baseService.authorizationPolicy.checkGlobalAction(this.baseService.actor, 'finance.manage')
```

### 2. P3 Action Items: API Surface Decisions & Linter Harness
* **API Exposure**: Decide whether direct managed entity properties on `BaseSchoolService` are fully public or internal-only. If they remain public, a parity linter or stricter checks are recommended to ensure no config becomes no-op over time.
* **Config Linting**: Add build-time lint checks that parse configurations to verify:
  * Every indirect entity config implements a `preSave` parent existence gate.
  * No config uses `noopSaveAccess` or `noopDeleteAccess` without explicit, documented architectural approval.
  * Every master entity config implements a `preDelete` gate checking foreign key dependencies.

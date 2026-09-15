# Plan 00 — Common requirements and sequence index

| Field | Value |
|---|---|
| Status | done |
| Created / updated | 2026-09-13 / 2026-09-14 |
| Target | Existing `edaya_backend`, current staff webapp, guardian/teacher mobile apps, and existing identity service |
| Owner | Codex — implementation and automated verification |
| Predecessor | None |
| Next | [Plan 01 — Pairing and invitations](01-guardian-pairing-and-invitations.md) |

## Outcome and approved decisions

Finish and verify shared foundations before implementing five v1 features. Preserve the current ports-and-adapters architecture, identity service, in-process notification adapters, and in-process document renderer. The backend rewrite and archived document repository are outside implementation scope.

This is the index and common implementation contract for exactly seven sequential plans:

| Order | Plan | Status | Exit outcome |
|---|---|---|---|
| 00 | [Common requirements](00-common-requirements.md) | done | Shared foundations are verified and consumable |
| 01 | [Guardian pairing and invitations](01-guardian-pairing-and-invitations.md) | on-going | A guardian opens the existing invitation link in the app and reaches the intended child |
| 02 | [Student photos and branding](02-student-photos-and-branding.md) | done | Portrait review, approved publication, and school branding/issuance assets |
| 03 | [Service catalog and accounting](03-service-catalog-and-accounting.md) | done | Account-based finance and all consumers agree |
| 04 | [Official documents](04-official-documents.md) | done | Every retained document is issuable and privately downloadable |
| 05 | [Family feedback surveys](05-family-feedback-surveys.md) | planned | Confidential feedback produces protected published results |
| 06 | [Final release rehearsal](06-final-release-rehearsal.md) | planned | The exact coordinated candidate has release-readiness evidence |

Approved defaults:

- Implement against `edaya_backend`; do not introduce the rewrite's membership model or its separate docs host.
- Use account-funded allocations and append-only accounting history. A payment may fund multiple charge allocations.
- Existing finance data is disposable. Reset only finance and its identified dependent demo artifacts; preserve identities, school structure, students, guardians, links and academic records.
- Pairing authorizes one intended guardian–student link per single-use code, with seven-day expiry.
- Surveys allow one response per student/evaluated assignment/campaign, submitted by any currently eligible guardian. Optional comments require restricted moderation; teachers receive themes only.
- Include every document group from Plan 04 before v1.
- Keep release rehearsal separate from feature completion. Feature flags do not make unfinished features complete.

## Sequencing and ownership

Start a plan only after its predecessor is `done` and its exit evidence is recorded. Each feature plan owns domain/persistence changes, authorization, API contracts, generated clients, web/mobile behavior, messages/jobs, fixtures, tests, and handoff. Plan 00 supplies shared mechanisms, not future business models.

Lifecycle: `planned` → `on-going` → `done`. Name the implementation owner when starting. A checkbox means implemented **and verified**, not merely written. Update the index row when a plan's status changes. Record a concrete blocker and next action when progress stops; do not mark a prerequisite complete to unlock dependent work.

The existing [authorization cleanup](../authorization-clean-implementation.md) and [RC plan](../backend-release-candidate-plan.md) remain baseline evidence. Reconcile them with current source before changing anything. Their historical test counts do not prove this new sequence complete.

Do not require the old RC's overall exit before this plan: shared technical prerequisites finish here, finance replacement belongs to Plan 03, and deployed release qualification belongs to Plan 06. Keep unrelated unfinished launch capabilities under their existing owner and record them as additional Plan 06 entry prerequisites; do not silently turn missing implementation into a rehearsal task.

The approved finance work supersedes the older RC finance freeze and the [older catalog plan](../service-catalog-plan.md)'s 1:1 payment/allocation rule and deferred client cutover. Other RC requirements and current package boundaries remain applicable.

## Prerequisites and current starting points

- Read the applicable repository `AGENTS.md` files; preserve existing unrelated working-tree changes.
- School business authority remains in the backend. Identity authentication/JWT/directory integration remains in `edaya_identity`.
- Keep dependency direction `@edaya/service` → `@edaya/authorization` → `@edaya/core`; persistence stays in adapters and transport handlers stay thin.
- Existing command catalogs, workflow repository declarations, transaction adapters, file endpoints, scheduling and notification jobs are starting points. Extend them instead of introducing a second execution framework.
- Before frontend work, follow its six UI specifications, including URL-backed drawers, focused mutation modals, route state and generated-client usage.

Useful source anchors: [transaction port](../../../package/domain-core/src/ports/platform/atomic-execution.ts), [workflow command catalog](../../../package/domain-service/src/services/runtime/school-command-catalog.ts), [workflow repository catalog](../../../package/domain-service/src/services/runtime/workflow-repository-catalog.ts), [Postgres transaction implementation](../../../package/adaptor-postgres/src/lib/transaction.ts), [cross-repo contract workflow](../../reference/cross-repo-workflow.md).

## Ordered implementation checklist

### 00.1 — Establish and reconcile the baseline

- [x] Record backend, identity, frontend and mobile revisions, dirty-tree state, generated-client versions and environment identity.
- [x] Map current authorization/RC items to verified, outstanding shared prerequisite, later feature ownership, or unrelated launch prerequisite. Give every outstanding requirement an owner and destination.
- [x] Run the relevant baseline checks and retain exact commands, outcomes and failure classifications. Preserve unrelated failures as explicit baseline findings.
- [x] Confirm the finance reset target is disposable and distinguish finance dependencies from records that must survive. See the [disposable target and preservation inventory](evidence/00-finance-reset-boundary.md); Plan 03 owns the finance-only cutover and preservation tests.

### 00.2 — Complete authorization enforcement

- [x] Finish current actor/action/resource caller coverage with explicit permissions and current relationship facts; keep guardian authority separate from staff authority.
- [x] Apply tenant and access predicates before single reads, lists, counts, pagination and aggregates. Preserve concealed not-found behavior for inaccessible resources.
- [x] Authorize every existing and proposed write endpoint inside its transaction, including mixed batches, file owners and relationship destinations.
- [x] Verify disabled guardian access, unlinking, assignment changes and expired grants invalidate subsequent access without copied permission rows or shared authorization caches.
- [x] Provide an authenticated identity-only entry boundary for operations preceding school-actor linkage. It may resolve only its admitted operation; Plan 01 supplies credential-scoped target resolution.
- [x] Finish affected existing web/mobile caller alignment and generated contract updates without creating staff fallback authority.

Current enforcement evidence: [actor/resource and entry-point reconciliation](evidence/00-authorization-reconciliation.md), with the final checks recorded in [implementation evidence](evidence/00-implementation.md#file-command-journal-and-current-authorization-checkpoint). Client alignment and the completed exit are recorded in the [final acceptance matrix](evidence/00-exit.md).

### 00.3 — Complete reliable command execution

- [x] Extend existing transaction infrastructure with durable command receipts, normalized request digests, payload-minimal audit and outbox records.
- [x] Scope idempotency by school, command and caller identity; same accepted payload returns the original authorized result, changed payload conflicts, and another caller cannot read the replay result.
- [x] Ensure receipt claim/completion, business effects, required audit and outbox commit or roll back together using the same transaction client.
- [x] Keep provider delivery and other network effects outside business transactions; verify pool-size-one paths cannot borrow a second connection and deadlock.
- [x] Define an explicit secret-display result mode: generic replay stores non-secret result metadata only; individual capabilities define secure lost-display recovery.
- [x] Preserve domain-specific duplicate detection and lifecycle checks; idempotency alone is not duplicate-payment or single-use-credential enforcement.

### 00.4 — Complete durable work and notifications

- [x] Reuse existing scheduler/notification adapters with migration-managed job/outbox persistence; remove runtime DDL from the affected paths.
- [x] Support atomic claiming, lease expiry, bounded retries, interruption recovery, versioned payloads and stable failure classification.
- [x] Persist recipient/channel completion independently; retry incomplete delivery without repeating completed channels unnecessarily.
- [x] Make recipient/device and occurrence identities school-aware. Jobs load authoritative school/resource state rather than accepting authority from mutable delivery payloads.
- [x] Expose the shared durable-work interface needed by document rendering and feature lifecycle jobs; register feature handlers only in their owning plans.
- [x] Preserve the selected notification provider configuration; this series does not itself require a provider migration.

### 00.5 — Complete private-file foundations

- [x] Verify authorized upload intents, upload completion, content/size validation and owner/purpose integrity; clients cannot assert upload readiness or ownership freely.
- [x] Support purpose-specific restrictions narrower than general student attachment access, including list metadata and content downloads.
- [x] Provide authorized bounded-byte loading for document assets; do not make renderers fetch arbitrary URLs.
- [x] Use authenticated private delivery or bounded signed delivery, with current authorization before granting access. Do not log download credentials.
- [x] Implement safe abandoned-upload/orphan cleanup primitives that do not delete referenced artifacts; feature-specific retention is owned by Plans 02/04/05.

### 00.6 — Standardize client, fixture and evidence delivery

- [x] Preserve existing auth wrappers, renewal rules, generated TypeScript/Dart clients, localization and error conventions. Automatically retry mutations only when their contract supports safe replay.
- [x] Provide consistent loading, empty, error, conflict and retry presentation without widening client authority.
- [x] Establish shared two-school synthetic fixtures covering owner/scoped staff, assigned/unassigned teachers, guardians, students, multiple profiles, multiple guardians, siblings, unrelated children and revoked access.
- [x] Preserve declarative fixtures separately from seed orchestration; run mutation seeds through admitted command paths.
- [x] Document reusable verification commands and evidence requirements; give every later plan a concrete dependency handoff.

Current fixture and dependency contracts: [two-school scenario](evidence/00-shared-fixture-contract.md) and [handoff to Plans 01–06](evidence/00-dependency-handoff.md). Minimal guardian bootstrap and fixture owner assignment now use admitted policies and transactions; their rollback, selected-school and native concurrency checks pass. See [completed acceptance](evidence/00-exit.md).

## Shared interface contract

Every changed capability documents input/result types, fixed permission and resource requirements, tenant source, transaction mode, idempotency/concurrency semantics, stable failures, audit/outbox facts, exposure and tests. Domain transitions are named commands; entity persistence does not imply public generic writes.

| Shared interface | Required behavior | Consumer |
|---|---|---|
| Command execution/receipt | Atomic effect and replay, caller-bound disclosure, changed-payload conflict, safe secret-display exception | All feature writes |
| Audit/outbox | Payload-minimal records in the business transaction; external effects after commit | All features |
| Durable work | Authoritative record reference, claim/lease/retry, status and interruption recovery | Expiry, documents, surveys, cleanup |
| Private files | Owner/purpose enforcement, bounded bytes and reauthorized downloads | Photos, branding, documents |
| Identity-only admission | Verified identity before school actor exists; no caller-selected school authority | Pairing/invitation acceptance |
| Generated clients | Canonical server contracts, coordinated TypeScript/Dart regeneration, drift verification | Web/mobile/fixtures |

Do not add a generic business workflow engine, copy the rewrite's contract/governance framework, or put domain logic into HTTP handlers.

## Fixtures and verification

- [x] Unit/service tests: permission/resource decisions, normalized replay conflicts, secret-free audit and domain-independent durable-work behavior.
- [x] Persistence tests: scope-before-pagination/counts, atomic rollback and guarded writes, including same-school unrelated and foreign-school IDs.
- [x] Native PostgreSQL tests: competing receipt claims, lease recovery, current relationship access, rollback and pool-size-one behavior.
- [x] Public API tests: generic-write bypass attempts, private-file access, identity-only admission, stable errors and request-body limits.
- [x] Consumer tests: generated contract drift, existing auth wrappers, selected-profile behavior and baseline web/mobile journeys.
- [x] Notification tests: one failed channel retries while successful deliveries stay complete; no exactly-once network-delivery claim.

Required command families for affected code: backend `bun run verify`, `bun run test:integration`, `bun run test:integration:native`, and `bun run test:integration:seed` when seeds change; identity/frontend `bun run verify`; the mobile repository's analysis, tests and generated-contract checks. Verify exact commands from each repository at execution time. Record device/provider evidence separately from unit/emulator evidence.

## Exit gate and evidence

- [x] Shared authorization, transactions, private files, jobs and notifications pass their required matrices.
- [x] Baseline checks pass for affected backend, identity, generated clients, web and mobile; unrelated launch prerequisites have explicit owners.
- [x] No future feature needs to recreate the shared mechanisms or weaken an existing permission boundary.
- [x] Record exact revisions, commands/results, migrations, fixtures, limitations and the completed dependency handoff.

Completed evidence: [Plan 00 implementation evidence](evidence/00-implementation.md), [baseline requirement ownership](evidence/00-baseline-reconciliation.md) and [private-file interface and remaining lifecycle work](../../reference/private-file-foundations.md). All Plan 00 requirements and exit conditions are verified in the [final matrix](evidence/00-exit.md), including [command reconciliation](evidence/00-command-reconciliation.md) and [client acceptance](evidence/00-client-acceptance.md).

## Handoff to Plan 01

Supply the verified identity-only boundary, atomic command/replay and outbox APIs, narrow private-file policy extension points, shared fixtures and client regeneration procedure. This plan and the index row are `done`. [Plan 01](01-guardian-pairing-and-invitations.md) is `on-going` on the existing invitation deep-link slice; Plans 02–06 remain planned.

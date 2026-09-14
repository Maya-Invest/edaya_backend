# Current authorization reconciliation

Owner: Codex. Scope: Plan 00 shared enforcement in the current working tree, before any feature plan starts. This review reconciles the completed [55-resource audit](../../authorization-surface-audit.md#complete-resource-inventory-reconciliation) with current source and the file changes. It does not use historical test counts as new verification.

## Resource and caller inventory

The current `entityRules` keys in `package/domain-authorization/src/access/entity-policies.ts` were compared with the resource inventory above: **55 unique keys, no missing or extra keys**. Existing family-specific action policies remain in authorization. Files additionally have purpose predicates and named upload/removal policies; their new tests supplement the original general-attachment matrix.

All paths below are relative to the backend root. The cited suites are included in the full backend verification; native integration adds independent PostgreSQL pools, concurrent receipt claims and current file access during I/O. PGlite policy tests exercise PostgreSQL SQL predicates locally; they are not evidence about deployed query plans or cache configuration.

| Caller / boundary | Current evidence |
|---|---|
| Human school owner and scoped staff | `package/adaptor-postgres/tests/authorization-policies-pglite.test.ts`: action-specific reads/writes, tenant/year, old/proposed placements, mixed batches, owner boundaries; `package/domain-service/tests/services/workflows/school-ownership-policy.test.ts`: current ownership and transfer invariants |
| Subject and homeroom teachers | Same Postgres suite: subject isolation, homeroom read versus subject input, assignment removal; `package/domain-service/tests/services/workflows/discipline-policy.test.ts` and `remaining-resource-policies.test.ts`: lesson/year, activities, shared curriculum and current assignment boundaries |
| Guardian and student selected profiles | Postgres suite: same-login staff isolation, inactive profiles and removed links; `package/domain-authorization/tests/unit-auth/portal-resource-policies.test.ts`; service `guardian-link-policy.test.ts` and `guardian-preferences-policy.test.ts`: no relationship creation or privilege inheritance through self-service |
| Service accounts | `package/domain-service/tests/services/workflows/service-account-entity-policy.test.ts`: dedicated lifecycle and generic bypass denials; `remaining-resource-policies.test.ts`: explicit health grants independent of owner login; API `test-service-accounts-routes.test.ts` |
| Platform and S2S | Postgres suite: current grant/key facts, delegation, school and selected-profile isolation; authorization `platform-user-provision.test.ts`, `s2s-client-provision.test.ts`; API `test-platform-and-s2s-routes.test.ts` |
| Named internal jobs and fixture caller | `package/domain-authorization/tests/unit-auth/system-action-boundaries.test.ts`: canonical action matrix and cross-school denial, including cleanup identities; cron, notification delivery and seed integration suites exercise actual composition |
| Identity-only admission | `apps/api/tests/lib/test-identity-only-entry.test.ts`: verified identity, operation-only surface and no school-selected authority; Plan 01 owns new credential/target pairing behavior |
| Direct command, REST and GraphQL | `apps/api/tests/routes/test-command-policy-parity.test.ts`, `test-commands-save-and-delete-behavior.test.ts`, and GraphQL entity tests: restricted machine commands, batch parity and command-only attachment exposure |
| Specialized reads and aggregates | `package/domain-service/tests/services/queries/query-services.test.ts`, Postgres overdue/count and timetable cases; API report-card/logbook tests: current source, publication, resource and selected-profile access |
| Private file metadata and bytes | Service `attachment-purposes.test.ts`, `attachment-command-journal.test.ts`, `load-attachment-asset.test.ts`; API content/upload/query registry tests; native `private-attachment-assets.test.ts`: purpose before pagination/counts, caller/owner integrity, actual proposed target, revocation during reads/signing and replay |

## Source contracts rechecked

`ManagedEntityService` constructs current read policies before every lookup/list/count. `PostgresStore.scopedWhere` combines caller filters with tenant/access SQL before rows, limits and counts. Proposed-row assertions compile the same scope against the proposal. Specialized query policies supply scoped repository sets before aggregates; they do not filter unauthorized totals afterward.

Managed writes require atomic execution. Saves authorize existing and proposed records before business gates and persistence. Batches authorize every proposal before any write; business validation then observes earlier writes within the transaction, preserving overlap/duplicate invariants. Deletes authorize every existing target before deletion. Direct workflow policies retain their distinct transition actions. Upload admission now authorizes the actual server-generated proposal before storing it; completion and removal recheck current owner/purpose in their journal transaction.

`AccessPolicies.scope` creates a fresh `AccessFacts` for each evaluation. Its memoization lives only within that evaluation. Actor validation reloads active staff/teacher/student state and guardian `hasAccess` plus subject linkage. Grants use current validity and year; staff assignments and teacher/family relationships are read from authoritative repositories. Teacher and family actor branches execute before staff owner/manual-grant logic. Consequently, selecting a guardian profile cannot inherit the same identity's staff authority. Existing revocation tests reuse service instances after changing these records.

`authorization-migration-guards.test.ts` and the internal-action tests keep canonical action selection in authorization and prohibit replaced cache/evaluator/transport-gate mechanisms. The file extension preserves this boundary: services call named policies; HTTP cannot submit a permission, scope or purpose policy callback.

## Limits and handoff

This matrix covers the current shared caller/resource model. It does not claim future pairing/photo/finance/document/survey actions are already authorized. Each owning plan extends the same policies and supplies its own old/proposed, lifecycle, selected-profile, unrelated-child, school and revoked-access tests. Actual deployment freshness and query performance belong to Plan 06.

Client retry/error presentation remains a separate Plan 00 acceptance item. The [shared family fixture](00-shared-fixture-contract.md) now expands the reusable graph with siblings and independent co-guardians. Private-delivery endpoints reject external-only attachments; metadata is preserved for the feature migration, and no external compatibility URL is counted as a private grant. The full plan stays on-going until those and the other remaining exit items are resolved. Verification outcomes and source digest are recorded in [implementation evidence](00-implementation.md#file-command-journal-and-current-authorization-checkpoint).

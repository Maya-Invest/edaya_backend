# Command contract reconciliation

Owner: Codex. Plan 00 supplies the shared execution contract and adopts it for the shared capabilities changed here. The plan explicitly excludes future business models; its interface table names all feature writes as consumers. A receipt implementation does not make every historical command automatically retryable.

## Shared execution and current adopters

`CommandExecution` and `PostgresCommandJournal` use the authoritative `(school, command, caller, request)` tuple. `schoolCommandScope` derives the school from the admitted actor and hashes selected-profile/linked-subject identity, independently of access-token renewal. Canonical accepted input is hashed; mutable generated defaults and secret response payloads are not stored. Current authorization runs before both execution and replay. A changed digest or result mode conflicts; another caller has a separate namespace and cannot obtain the previous caller's result.

| Current adopter | Logical request and result | Independent lifecycle rule |
|---|---|---|
| Upload admission | Attachment ID; secret-display projection contains only ID | Pending, current caller/owner/purpose, original expiry; lost URL recovery cannot extend admission |
| Upload completion | Admitted attachment ID; reference-only result | Actual bytes, immutable metadata and intent completion; changed or missing result is unavailable |
| Attachment removal | Attachment ID plus original authorized owner/purpose references | ID must remain absent on replay; a replacement cannot be removed |
| Private cleanup | Stored private-object identity and cleanup transition | Reference/tombstone/reservation checks and durable retry protect retained objects |
| Scheduled occurrence | Stored school/job/version and occurrence identity | Atomic occurrence uniqueness, schedule advancement and authoritative outbox reference |
| Fixture owner initialization | Selected school initialization, configured staff/subject | Ownerless or same owner, active linked human staff, no pending transfer, one owning school per subject |

All six use the existing shared transaction/journal infrastructure. Business writes, receipt completion, required audit and outbox share one SQL connection and roll back together. External delivery, signing, storage and rendering remain outside business SQL. No receipt/audit/outbox CRUD endpoint is exposed. See [reusable command interfaces](../../../reference/command-execution.md) for exact methods, stable failures and projection requirements.

## Existing domain constraints and feature ownership

The current named workflow catalog remains the admission boundary for historical commands. Generic entity write capability is separately declared and tested; it does not infer replay safety. Web and Dart transports never automatically repeat mutations after renewal or an uncertain result.

| Existing behavior preserved | Current proof | Future owner |
|---|---|---|
| Legacy payment ID uniqueness, serialized balance updates and reversal behavior | `tooling/integration-tests/src/native/finance-concurrency.test.ts`; competing identical payment IDs, distinct payments/repeated reversals and outer rollback pass | Plan 03 replaces the model and owns stable financial command keys, duplicate protection across different request IDs, account/charge/allocation reconciliation and every consumer |
| Account invitation contact/token/status, same-subject acceptance, expiration and revocation | `package/domain-service/tests/services/workflows/account-invitation-workflows.test.ts`; public invitation integration cases | Plan 01 owns new seven-day intended-link single-use pairing and its explicit secure lost-display/replay contract |
| Private intent ownership, purpose, expiry and immutable completion | `attachment-command-journal.test.ts`, upload/purpose service and API matrices, native private-file tests | Plans 02/04/05 supply their narrower feature policies and lifecycle models |
| Notification occurrence and channel identity/completion | Cron, notification identity, native notification and durable-work suites | Feature handlers preserve independent domain uniqueness; Plan 06 qualifies actual providers |

Idempotency never replaces these invariants. A new request ID cannot bypass a domain duplicate or lifecycle check. The shared framework requires the feature author to supply current authorization, an explicit non-secret result projection and replay logic; it does not replay by running arbitrary old workflows again.

## Qualification

The full backend gate includes `package/domain-service/tests/unit/command-execution.test.ts` (canonicalization, scope and result contract), `package/adaptor-postgres/tests/command-journal.test.ts` (school/command/caller isolation, changed input, current revocation, secret projection, atomic rollback and unfinished work), file command integration, and the unchanged invitation/finance lifecycle checks.

The native suite uses independent pools of size one for competing claims, one effect/receipt/audit/outbox, changed input and revoked replay, outbox rollback, lease recovery, stale/wrong-school completion and retry budgets. Final seed initialization adds two-pool competing same-school and cross-school ownership cases. Exact counts and source state are recorded in [implementation evidence](00-implementation.md).

This closes the shared scope/replay and domain-constraint preservation requirements in 00.3. It makes no blanket retry promise for unadopted historical workflows and does not begin Plans 01–05.

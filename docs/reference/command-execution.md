# Reliable named commands

`CommandExecution` wraps existing domain workflows with the application's `AtomicExecutionPort` and `CommandJournalPort`. Runtime composition supplies `PostgresCommandJournal`; there is no generic HTTP write surface for receipts, audit or outbox rows. Access it through `BaseSchoolService.commandExecution` or the application for an admitted identity-only capability. Missing persistence fails closed.

The command owner supplies:

- A scope containing the authoritative school, fixed command name, authenticated caller identity and stable logical request ID. Never accept school or caller authority from an unverified request. Human identity keys must remain stable across login renewal; profile/resource permissions are checked separately.
- Validated input. Canonicalization sorts object keys, omits undefined object properties and normalizes dates to ISO strings. Arrays retain order. Nonfinite numbers, undefined array elements, cycles and non-plain objects fail. Only the SHA-256 digest is stored, not the input. Hash the accepted logical client input before generating timestamps, IDs or other mutable server defaults, so an omitted field cannot acquire a different digest on retry.
- `authorize`, checking current permission and every existing/proposed resource inside the transaction, including on replay. `replay` additionally checks current access to the recorded result. Never replay by reading a receipt directly from a transport handler.
- `execute`, invoking the existing business workflow. Provider calls and file/network delivery must occur after commit, through durable work. Domain duplicate/lifecycle constraints still apply when a caller changes the request ID.
- `persistResult`, explicitly projecting non-secret JSON. `audit` returns minimal named event/resource references; at least one audit fact is required. `outbox` returns versioned handler/resource references, with stable work IDs. They contain no credential, private bytes or copied business payload.

The adapter serializes competing receipt claims with a transaction-scoped advisory lock, then inserts the claim, performs the effect, completes the receipt and inserts audit/outbox facts using that same transaction connection. A failure at any step rolls everything back. Nested business transactions reuse the connection. No committed partial receipt is an expected recovery state.

The `(school, command, caller, request)` tuple uniquely scopes replay. Same scope and normalized input return the originally recorded authorized result; changed input or result mode raises `COMMAND_REPLAY_CONFLICT` (HTTP 409 through the existing error mapper). Another caller has a separate namespace and cannot read the original result. `COMMAND_INCOMPLETE` fails closed on an unexpected partial receipt. `COMMAND_INPUT_INVALID`, `COMMAND_SCOPE_INVALID` and `COMMAND_AUDIT_REQUIRED` identify invalid internal contracts without echoing request values.

For `secret-display`, `execute` can return a credential once, but `persistResult` must retain only metadata (for example the grant ID). `replay` reconstructs the secret-free result after current authorization. Recovery of a lost display belongs to the capability, such as revoke/regenerate; generic replay cannot recover the secret. Ordinary commands also require an explicit projection rather than automatic response capture.

Persistence is installed by school migration `0014_command_journal`. The outbox table supplies atomic durable intent and the `DurableWorkPort` lease protocol described below. The existing scheduler adopts this infrastructure through migration `0015_cron_occurrences` and the [durable cron protocol](cron-runtimes.md); feature handlers belong to their owning plans. Existing workflows must opt into the wrapper with their actual authorization/replay policies before their HTTP contracts promise retry safety. Adding the shared component alone does not make existing mutations replay-safe.

Verification: `package/domain-service/tests/unit/command-execution.test.ts`, `package/adaptor-postgres/tests/command-journal.test.ts`, and `tooling/integration-tests/src/native/command-journal.test.ts`. The native suite uses two independent pools of size one and tests competing identical commands, changed input, revoked authorization, lost-result replay and atomic rollback on outbox failure.

## File command adoption

`schoolCommandScope(actor, command, logicalRequestId)` fixes school from the verified actor and hashes the selected profile kind, actor/system identity and linked subject into the caller namespace. Token renewal does not change this namespace; another profile or relinked subject does. The logical request identity is hashed independently. This helper does not grant authority: every command still runs its named current policy inside the transaction.

The file capabilities now adopt the journal explicitly:

| Command | Stable logical identity | Stored result and audit | Replay behavior |
|---|---|---|---|
| `createAttachmentUpload` | Attachment ID; caller must retain it for retry | Attachment ID only; `attachment.upload_intent_authorized`; secret-display mode | Reload the original caller-bound intent and current owner/purpose policy, then sign outside SQL without extending the original expiry |
| `registerAttachment` | Admitted attachment ID | Attachment ID only; `attachment.upload_completed`; ordinary mode | Return the unchanged, currently authorized completed attachment; no staging read or copy |
| `removeAttachment` | Attachment ID | Original attachment/owner/purpose references; `attachment.removed`; ordinary mode | Recheck current authority over the original owner and require the ID to remain absent |

Admission commits intent, private-object inventory, receipt and audit together. Completion commits the ready attachment, intent completion, receipt and audit together. Removal commits metadata deletion, cleanup eligibility, receipt and audit together. None persists private keys, signed URLs, filenames, file contents or provider diagnostics in journal records. File I/O stays outside SQL; removal schedules eligibility for the existing cleanup pipeline rather than deleting bytes itself. These commands do not enqueue immediate provider work.

Accepted upload metadata determines the request digest; generated storage keys, timestamps and credentials do not. Existing upload conflict/expiry/completed checks remain authoritative. The original actual proposal is passed to authorization before it is persisted. Completion refuses changed or removed results with `ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE`; removal refuses replacement IDs with `ATTACHMENT_REMOVAL_RESULT_UNAVAILABLE`. A retry never removes a replacement object. Lost upload-URL recovery is capability-specific and requires the original admission to remain pending, unexpired and authorized. An omitted admission ID creates a new operation, so generic automatic mutation retry remains inappropriate.

`attachment-command-journal.test.ts` injects failures after journal completion to prove rollback of admission, completion and removal; verifies secret-free persistence, current revocation, URL recovery and replacement protection. Native competing uploads across two one-connection pools prove one receipt/audit per phase. Later feature commands must provide their own explicit replay projections and lifecycle checks; this adoption does not change unrelated commands' retry contracts.

## Fixture owner initialization

`initializeFixtureSchoolOwner(base, { schoolId, staffId, subjectId })` is an internal onboarding capability, exported for the in-process seed adapter but absent from the public REST command catalog. It admits only the exact `fixture-seed` system identity in its selected school. The named authorization policy requires an active linked human staff target, an ownerless school (or the same owner on replay), no pending owner invitation and unchanged school settings. It cannot transfer ownership. Ordinary human, service and other job callers cannot use it.

Identifiers must be nonempty and have no surrounding whitespace before receipt or owner-lock identity is derived. The operation uses a school/caller-bound ordinary receipt and locks both the selected school initialization and the target subject's ownership namespace. The existing school ownership invariant prevents assigning an identity that owns another school. School update, receipt and the minimal `school.fixture_owner_initialized` audit commit together; the result stores only school/staff references. Replay rechecks the current linked active owner. No outbox or provider call is needed.

The minimal seed bootstrap separately wraps its admitted school/staff/guardian commands in one transaction with a selected-school lock. Failure to register the guardian rolls back the school and staff, so a retry cannot mistake a partial bootstrap for completion. Invitations are explicitly disabled for this fixture. Declarative fixture records remain separate from mutation orchestration.

Service and integration cases cover actor/tenant/target denial, settings preservation, pending/current owner protection, replay, audit rollback and complete bootstrap rollback. Native tests use independent pools of size one to prove one receipt/audit for competing identical initialization and one owning school for a subject claimed concurrently in two schools.

## Durable work delivery

`PostgresDurableWork` claims only committed rows for registered handler kinds, in batches of at most 100, using `FOR UPDATE SKIP LOCKED`. It forbids claiming inside a business transaction. `runDurableWorkBatch` invokes version-matched handlers outside the transaction and waits for every started handler before returning, including after persistence failures. A handler receives durable school/resource references, never a caller-selected authority payload, and must load current facts through its feature policy.

The lease is bounded between 1 second and 5 minutes; the runner defaults to 60 seconds. Long-running handlers must renew before expiry. Completion, failure and renewal compare school, work ID and the current unexpired lease. Losing a lease cannot be reversed by acknowledging or renewing an old claim. Handlers remain responsible for idempotent domain effects and for atomic finalization of their business result; a lease is not an exactly-once network-delivery guarantee.

Retryable failure backs off exponentially from 5 seconds to at most 15 minutes. Eight total claims exhaust the budget, including interrupted attempts. The last crashed attempt is moved to `dead` when its lease expires and the next claim scan runs. Unsupported handler versions fail permanently. Unknown provider exceptions become `WORK_HANDLER_FAILED`; persistence receives stable codes instead of provider exception messages, tokens or payloads. Already completed work is excluded from later claims.

The port is available as `SchoolApplication.durableWork`. A queue consumer can constrain a claim to one `jobId` and read its status/retry time using `getState`; neither is a public business read surface. No feature lifecycle handler is registered by these foundations. Native tests cover simultaneous claiming, lease expiry, wrong-school/stale completion, renewal, delayed retries and interruption at the attempt limit. The service/persistence tests cover partial batch success, version rejection, redaction and recovery of incomplete items only.

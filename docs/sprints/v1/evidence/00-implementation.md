# Plan 00 implementation evidence

Status: on-going. Owner: Codex. Started 2026-09-14. No plan exit is claimed.

## Starting state

All four repositories were clean at inspection. Backend implementation changes remain in the working tree until a coordinated candidate is recorded.

| Component | Starting revision | Client/build identity |
|---|---|---|
| Backend | `a5e1b1b18018437f52e61485ebc62a036e3ee91f` | API client package `0.0.0`, workspace source |
| Identity | `75edbd9d1bc49b25021b36fd540e839d1ae3f09a` | Identity client `0.0.0`, sibling file link |
| Frontend | `6d853f21fa32317d766954a66aaa13d78f4bc353` | Backend API client via sibling file link |
| Mobile | `4fcefe49398ea9cca91ff6e42c099aa47425c1d8` | Unpublished `edaya_api_client` workspace package, no package version field |

Environment: local macOS workspace, Bun 1.3.14, PostgreSQL 14.15 (Homebrew). Native verification creates a fresh `edaya-rc-postgres-*` cluster on loopback and removes it afterward. It never loads a project database URL. No deployed environment or real notification recipient was used. Flutter verification requires SDK cache writes outside the repository; rerunning with the environment's approved permission succeeded.

Seed HTTP diagnostics additionally ran against an isolated identity process on loopback port 9900 (`RUNTIME=test`, `AUTH_DATABASE_URL=pglite`, `EMAIL_TRANSPORT=log`, OTP logging disabled). Its temporary entry script loads explicit synthetic configuration and does not load repository environment files.

The finance reset is authorized for disposable data only. Current native test data is disposable by construction. No existing local/staging/production finance reset was performed or qualified. Plan 03 must inventory dependencies and select a specific disposable target before reset. Identities, school structure, students, guardians, relationships and academic records must survive its finance-only cutover.

## Baseline reconciliation and ownership

Historical authorization and RC checkmarks are reference evidence, not this sequence's exit evidence. Current source was inspected at the actor model, workflow policies, SQL scopes, transaction adapter, invitation routes, file upload routes, cron scheduler and notification persistence.

| Prior requirement | Current classification and destination | Owner / next action |
|---|---|---|
| Authorization caller replacement, typed grants, current relationships, scoped repositories | Implemented baseline; fresh full authorization matrix remains required in Plan 00 | Codex: run affected service/API/native checks, review uncovered paths |
| General receipt replay, audit and atomic outbox | Outstanding shared prerequisite; initial implementation in this checkpoint | Codex: complete integration and capability-specific replay policies |
| Native notification schema | Moved to migration `0013`; fresh/legacy persistence tests pass | Codex: retain native channel/lease evidence |
| Durable cron occurrences, queue authority, work leases and bounded recovery | Outstanding Plan 00 shared prerequisite | Codex: replace mutable queue authority with durable record references and atomic schedule advancement |
| Notification tenant keys, recipient/channel completion | Current channel recovery exists; tenant identity audit still required | Codex: test cross-school recipient/device/occurrence collisions |
| Identity-only admission | Invitation route currently resolves authenticated session plus credential-scoped system operation; reusable boundary still required | Codex: implement constrained admission in Plan 00; grant resolution belongs to Plan 01 |
| Private files | Upload intents and authenticated content routes exist; purpose restrictions, actual completion/byte validation and reference-aware cleanup remain | Codex: complete Plan 00 mechanisms; photo processing/publication belongs to Plan 02 |
| RC finance reliability/reconciliation | Existing legacy finance concurrency tests retained; model replacement belongs to Plan 03 | Codex: full account-funded model/client cutover after Plans 01–02 |
| First-party wrappers and generated contracts | Existing Bearer/renewal and private-image consumers; baseline web/mobile checks pass | Codex: preserve wrappers, verify coordinated contract drift and current-context invalidation |
| External parent OAuth DTOs, hosted consent/connected-app UI, discovery and partner example (RC WP5) | Cancelled / out of v1 (2026-09-15). Not a Plan 06 entry gate. | — |
| Deployed connection freshness, cookie topology, provider/device evidence, restore/load/soak and supported builds | Additional release prerequisites; local automated checks cannot qualify deployed controls | Release coordinator / infrastructure and mobile release owners (roles, individuals unassigned): identify candidate and controlled environment for Plan 06 |
| Shared adversarial fixtures and rendered-email evidence | Existing SQL and native synthetic fixtures are starting points; consolidated reusable coverage incomplete | Codex: Plan 00 fixture handoff; feature-specific scenarios in owning plans |

## Implemented mechanisms

Migration `0013_notification_schema` adopts existing `notify` tables and reliability columns/indexes or installs them on a fresh database. Runtime DDL helpers and their startup/deployment follow-up calls were removed. Tests use the migration; a historical schema fixture is retained only for upgrade tests. Job state, device tokens and per-channel completion survive adoption. The selected provider configuration is unchanged.

Migration `0014_command_journal` adds caller-scoped receipts, minimal audit and durable outbox references. Core defines the journal port, service wraps existing atomic execution, and the PostgreSQL adapter refuses access without an active transaction. API runtime composition supplies it. See the [command contract](../../../reference/command-execution.md). Normalized replay, secret-display metadata, current replay authorization and rollback were verified. Existing public commands have not yet all adopted this mechanism; no broad retry-safety claim is made.

## Verification ledger

Commands were run on 2026-09-14; detailed local output is under `/private/tmp/edaya-v1-baseline/`. This folder is diagnostic output, not a deployed release artifact.

| Command / scope | Result | Evidence limits |
|---|---|---|
| Frontend `bun run verify` | Passed, including 770 tests | Baseline; Turbo reused matching cached checks |
| Identity `bun run verify` | Passed; 4 client, 9 auth adapter, 6 migration and 38 identity tests | Local baseline, no deployed cookie/provider qualification |
| Mobile `melos run verify` | Passed: branding, generated drift, analysis, 106 unit/widget tests | SDK-cache permission rerun; no live API/device qualification |
| Initial backend `bun run verify` | Not accepted as baseline | The run overlapped the new migration; missing statement separators caused a PGlite failure. Separators were fixed and fresh checks launched |
| Notification focused suite | 48 passed, 0 failed | Fresh/legacy migrations, adapter delivery, delayed current recipient authorization |
| Command receipt focused suite | 13 passed, 0 failed | Canonicalization, replay namespaces, secret projection, resource recheck, rollback |
| Backend `bun run test:integration:native` after receipts | 14 passed, 0 failed; 49 assertions | Disposable PostgreSQL; two API pools of size one; receipt/finance/notification/access checks |
| Backend `bun run verify` after fixes | Passed: hygiene, contract drift, lint/types/build and 1,715 tests | Local-server permission rerun; 30 Turbo tasks successful |
| Backend `bun run test:integration:seed` | Passed: 8 tests, 0 failures, 83 assertions | Disposable identity and local file servers; both initial sandbox restrictions and missing identity were resolved |
| Backend `bun run test:integration` | Passed: 13 service/runtime/adapter and 28 HTTP tests | 41 tests, no failures; generated client, scoped mutations and SQL access paths included |

No API operation or public DTO changed in this checkpoint, so no generated client files were edited. Full drift verification remains part of the shared gate. No seed implementation changed; migration-based fixture initialization changed and seed integration will verify compatibility.

Verified checkpoint non-document change digest: `a2e0a0a232b5f1df3e53d07e3da1204810a9cf16011843020c9f2b55a8faa4ee`. It hashes sorted changed/untracked source paths and their SHA-256 content (deleted paths have a deletion marker), relative to the recorded backend starting revision. Later work requires a fresh checkpoint.

## Next work and gate state

Implement atomic cron occurrences and dispatcher integration, recipient/device tenant isolation, private-file completion/purpose/cleanup, reusable identity-only admission, command adoption and consolidated fixtures. Record exact checks for each. Plan 00 remains on-going and Plans 01–06 remain planned; none of their prerequisite or completion boxes is checked by this checkpoint.

## Durable-work checkpoint

The shared `DurableWorkPort`, PostgreSQL lease adapter and service batch runner are implemented and wired into application composition. Work is school-bound, versioned and reference-only. Claims are atomic, expired leases recover, stale/foreign completion fails, retries use bounded exponential backoff, and eight interrupted/failed attempts become terminal. Typed failure codes prevent raw provider exception persistence. No feature handler was added before its owning plan.

- Focused command/durable tests: 14 passed, 0 failed, 50 assertions.
- Native PostgreSQL suite: 16 passed, 0 failed, 64 assertions, including receipt, outbox, finance and authorization races.
- Full backend verification after this extension passed: hygiene, drift, lint/types/build and 1,716 tests; see `backend-durable-verify.log` in the diagnostic directory.
- Final review corrected receipt locking to use exactly the persisted identity tuple, ignoring incidental trace metadata on a structurally compatible request context. This happened after the full run started. The final native suite includes different trace IDs on all eight competing calls and passed 16 tests; focused tests, lint and integration types were rerun after that correction. The entire final Plan 00 gate still requires a fresh coordinated run after its remaining implementation.
- Final source change digest for this checkpoint: `394fd8196d17f03b9fbdb9c72680ec090cdb8125480bf987391299328283cbe3`, using the non-document hashing convention above.
- The temporary identity process exited cleanly after seed verification; its in-memory data was discarded. No test servers from this checkpoint are intentionally left running.

## Durable cron checkpoint

Migration `0015_cron_occurrences` persists school/schedule/time identity, handler version, execution window and internal request identity. The existing schedule store now joins the current transaction. A heartbeat locks and reloads each schedule, commits occurrences, command receipts, minimal audit and execution/dispatch outbox rows, and advances the schedule in that transaction. Dispatch begins after commit and still runs when no schedule is newly due.

The Worker transport carries only `{ jobId }`. Consumers load the persisted occurrence and current school, reject unsupported versions and mismatched school references, and acknowledge malformed, unknown or terminal deliveries. Existing cron effects and guarded execution completion commit together; an exception or lost lease rolls back both. The local inline adapter uses the same protocol. Missing Worker queue binding fails closed.

Transport and execution retain independent bounded budgets. Failed sends are retried after durable backoff. Heartbeats recover accepted-but-unexecuted deliveries by resending the same reference after eligibility returns; attempts are preserved and exhausted work remains terminal. Queue consumers use per-message acknowledgements/retries, with a 60-second retry delay and 20 configured transport retries. No exactly-once external notification delivery is claimed.

Verification for this checkpoint:

- Focused service/API cron suite: 18 passed, 0 failed, 75 assertions. Covers school isolation, malformed/legacy authority, duplicate/unknown references, version mismatch, transaction rollback, partial send failure, redacted errors and lost-message recovery without resetting budgets.
- Native PostgreSQL suite: 19 passed, 0 failed, 76 assertions. New cron cases use separate pools of size one, six competing heartbeats, concurrent duplicate deliveries and injected failure after job effects. The fixture initially collided with migration-seeded schedules; isolating the disposable schedule fixture resolved it. No runtime constraint was weakened.
- `bun run check`: all 19 package tasks passed. Full verification initially found export ordering and API-package formatting differences; both were corrected using each package's lint configuration. Final full verification and integration results are recorded below when complete.
- Cloudflare behavior was checked against the official [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Queues acknowledgement/retry documentation](https://developers.cloudflare.com/queues/configuration/batching-retries/). Latest published Workers types (`5.20260914.1`) were inspected in a temporary tarball; workspace dependencies were not upgraded.
- [Cron runtime documentation](../../../reference/cron-runtimes.md) records migration/queue cutover, coalesced heartbeat semantics, bounded recovery and terminal diagnostics. Legacy full-authority messages must be drained with the old matched worker before reference-only cutover. No deployed queue/provider qualification has occurred.

[Baseline requirement ownership](00-baseline-reconciliation.md) now maps the old authorization/RC requirements to shared foundations, owning features, deployed rehearsal or additional launch prerequisites. Plan 00 remains on-going. Recipient/device tenant isolation, private-file completion/purpose/cleanup, identity-only admission, shared command adoption and consolidated fixture/caller evidence remain outstanding.

- Integration verification for the cron checkpoint: `bun run test:integration` passed all 13 service/runtime/adaptor and 28 HTTP tests (41 total). The final source digest before documentation changes is `352cba9cf97c1b9adc187e0d8152443236f172fb0859d81a38e968f383001718`. No runtime/provider has been deployed.

- Final `bun run verify` passed on the recorded cron source digest: repository/contract checks, all quality and build tasks, and 1,723 tests with zero failures (including 617 service, 170 Postgres and 236 API tests). Diagnostic log: `/private/tmp/edaya-v1-baseline/cron-verify.log`. No source changes followed this run; documentation only was updated. The full Plan 00 exit gate remains unsatisfied by its outstanding items.


## Notification tenant checkpoint

Migration `0016_notification_tenants` gives transport jobs a kind/school/logical-ID namespace while retaining original application delivery IDs for policy resolution, callbacks and mobile links. It preserves per-channel history and provider message IDs, handles old IDs that resemble new keys, and aborts on orphan delivery history. Explicit auth/invitation destinations now have tenant-bound keys. Devices require school/login/provider; unscoped legacy tokens are preserved in a separate table that dispatch never reads. No deployed migration or token reassignment occurred.

School scope now reaches cancellation, invitation revocation, reconciliation and device removal through their ports and admitted workflows. The existing mobile session registration no longer suppresses a repeated Firebase token based only on its value, and no longer prints that token. Public command DTOs are unchanged; clients still obtain school authority from their authenticated context.

Notification jobs now persist a payload version, terminalize exhausted/interrupted attempts, and reject expired lease renewal/receipt/finalization. Provider failure logs and persistence use stable codes; adapter storage errors exclude raw SQL/provider exceptions and push tokens, and propagate to transactional callers. Authentication job keys no longer contain OTPs or addresses.

- Focused checkpoint before final additional migration/invitation cases: 148 tests passed, 0 failed, 387 assertions, covering notification/service/cron/current-authority and communications paths.
- Native PostgreSQL: 20 tests passed, 0 failed, 79 assertions, including independent workers with the same logical delivery/login in two schools and one-school device removal.
- Mobile `melos run verify`: passed brand/generated checks, analysis and existing local tests. Firebase/device tests are excluded by the repository's standard local test mode, so actual re-registration/delivery is still a release rehearsal requirement.
- Backend full verification is being completed after correcting test formatting and indexed-access typing. Final results and source digests follow below.

The [notification runtime contract](../../../architecture/notification-router.md) and [cutover procedure](../../../architecture/authorization-cutover.md) describe key migration, legacy device re-registration, history preservation and uncertain provider results. Plan 00 remains open for private files, identity-only admission, existing command adoption and remaining caller/fixture evidence.

- Additional source review corrected newly generated inbox delivery IDs to include school in the encoded tuple. Existing deliveries are still found by their persisted school/source/subject/profile identity and retain their IDs and read history. The focused ID/cron/communications suite passed 31 tests and 105 assertions.
- Novu sending and signed-receipt parsing now share the bounded SHA-256 channel identity and explicit correlation version 2. Unversioned signed pre-cutover receipts remain supported; explicit versions cannot fall back. Actual transport-to-parser tests cover school substitution and missing scope. The provider/notification suites passed 42 tests and 88 assertions before the final full gate.
- Seed integration passed 8 tests, 0 failures, 83 assertions using the inspected disposable in-memory identity fixture. Runtime/HTTP integration passed 41 tests. Final native verification passed 20 tests, 0 failures, 79 assertions after the provider correlation changes.
- Mobile verification passed 106 local tests, analysis, brand and generated checks. Its implementation diff only removes token logging and token-value-only registration suppression; real Firebase/device qualification remains outstanding.

- Final backend `bun run verify` passed on the notification checkpoint: hygiene and generated contracts, 32 quality tasks, 2 build tasks and 30 test/type tasks; 1,732 tests, zero failures. Log: `/private/tmp/edaya-v1-baseline/notify-tenant-final-verify.log`.
- Verified non-document source digests: backend `52b4c3306cfd0689447c60a96d1f53b0eaa0646e69254a84578bd0e24e872d14`; mobile `bc25ce4c988db7c9b1cc59cbfdbbacdf222b4e649a4725933d5a6ab42fd5a495`, using the hashing convention above. Later changes require their own verification checkpoint.
- The disposable identity fixture was stopped after seed verification; its process session is closed and an exact process-name check found no remaining fixture. The native PostgreSQL runner stopped its temporary cluster. No deployed migration, provider delivery or real device check was performed.

Plan 00.4 is locally verified. Plan 00 remains on-going; its other unchecked requirements and all six later plans are still outstanding.

## Bounded private-file read checkpoint

The existing `FileStoragePort` now requires a bounded private object read. Core, R2, local HTTP storage and API development memory/disk adapters implement it. The streaming helper checks actual bytes independently of metadata, cancels excess/failed reads, releases stream locks and returns owned bytes. Read failures use stable codes. The local internal content endpoint requires authentication and a valid byte bound; its client rejects redirects. API development disk keys reuse storage-root path validation.

The shared `loadAttachmentAsset` service helper resolves an attachment through current scoped reads, verifies an expected school/owner, ready state and constrained metadata, then reloads and reauthorizes after object I/O. It withholds bytes after revocation or record substitution and rejects arbitrary legacy URLs. [Private file foundations](../../../reference/private-file-foundations.md) records the port, current guarantees, errors, memory limits and feature handoff.

- Focused storage/service/API suite: 29 tests passed, 0 failed, 101 assertions. This includes forged/absent content lengths, stream cancellation, exact bounds, invalid limits, cross-school/wrong-owner references, ready-state checks and revocation during reads. Log: `/private/tmp/edaya-v1-baseline/bounded-file-focused.log`.
- Native PostgreSQL: 21 tests passed, 0 failed, 83 assertions. The new asset test borrows the same pool's sole connection during storage I/O and changes current authority before bytes return. The disposable cluster stopped cleanly. Log: `/private/tmp/edaya-v1-baseline/bounded-file-native.log`.
- Type verification identified one remaining test storage stub and differing DOM/Node stream reader types. The stub was extended, and the shared helper now depends only on the reader operations it uses. Full verification follows after these fixes.

This checkpoint does not complete upload-intent persistence, content signature validation, readiness/owner write enforcement, purpose policies, cleanup or renderer integration. Plan 00 remains on-going, and no file-lifecycle checkbox is checked on the basis of this read primitive alone. No production object was fetched or deleted.

- Broad backend `bun run verify` passed: hygiene/contracts, 32 quality tasks, 2 build tasks, 30 test/type tasks and 1,745 tests with zero failures. This run overlapped the final source review and is not represented as a single final-source release gate. Log: `/private/tmp/edaya-v1-baseline/bounded-file-verify.log`.
- Final review changed byte copying to `new Uint8Array(...)` so Node Buffers cannot retain mutable slice views, and hardened R2 classification of non-Error throws. The final focused suite passed 30 tests, 0 failures and 103 assertions. Logs: `bounded-file-focused-final.log` in the diagnostic directory.
- Final affected core and R2 `bun run quality && bun run test` checks passed: core 301 tests / 832 assertions, R2 18 tests / 34 assertions, no failures. Native integration types also passed after adding the pool-size-one asset test. The R2 provider integration fixture now exercises the bounded read but was not run against a remote bucket.
- `bun run test:integration` passed all 41 tests (13 service/runtime/adaptor, 28 HTTP), zero failures. No seed implementation, public DTO or generated-client schema changed in this read extension; the notification checkpoint's seed and mobile evidence remains separately recorded above.
- Final non-document source digest for the bounded-read checkpoint: `fc66c75905213d16e408aaacb8390b2ace73b2360ade2f1f89b09964e7283ad0`. No deployed provider, production attachment or finance data was used. A fresh coordinated gate remains required after the outstanding Plan 00 work.


## Persisted upload and scoped delivery checkpoint

Migration `0017_attachment_uploads` persists caller/school/owner-bound admission before issuing temporary credentials. The existing upload endpoint and `registerAttachment` workflow now use a shared service protocol: exact byte and MIME checks, bounded signature detection, immutable digest-derived accepted keys and atomic ready-record/completion publication. Generic attachment saves cannot bypass it. Concurrent callers, expired intents, changed metadata, forged uploader/time, unissued keys and changed authority are covered. Database/provider failures are sanitized. The local PUT adapter admits only issued random staging keys, enforces actual admitted size and cannot write accepted keys; R2 signs Content-Length. Mutation seeds use actual synthetic PDF/JPEG bytes through admitted upload commands.

The download helper now scopes metadata before reading, reauthorizes after signing and withholds grants if the record or access changes. The local byte route uses the bounded reauthorized loader. HTTP logs omit staging capabilities, authorization headers and signed download locations. Existing external fileUrl links remain compatibility links and are not claimed as private or expiring storage grants. The [file interface reference](../../../reference/private-file-foundations.md) records content identification limitations, semantics and remaining work.

- Broad `bun run verify` passed: hygiene/generated contracts, quality, build and 1,755 tests with zero failures. Log: `/private/tmp/edaya-v1-baseline/upload-verify-complete.log`. An earlier full run found a test accidentally completing with pending status; the test was corrected. No production rule was weakened.
- The broad run overlapped the final extraction of local PUT admission and storage-error sanitization. The final focused upload/download/API suite passed 14 tests and 63 assertions; separate service lint passed. Log: `upload-receive-final.log`. These are a local implementation checkpoint, not the coordinated Plan 00 exit gate.
- Additional local/R2 size tests passed 22 tests and 58 assertions (`upload-size-final.log`); final caller/metadata/provider-error/cross-school conflict regressions passed 5 tests and 23 assertions (`upload-admission-final.log`).
- Runtime/service/HTTP integration passed all 41 tests (`upload-integration-final.log`). An old direct-CRUD attachment fixture was replaced with repository setup for its legacy foreign record and an actual admitted-upload authorization probe; tenant protection remains enforced.
- Native PostgreSQL passed 22 tests and 115 assertions (`upload-native-final.log`), including six competing completions, rollback after attachment save and storage calls borrowing a one-connection pool outside SQL. Its runner shut down the disposable cluster. This precedes the final scoped-download helper and local PUT extraction; their focused evidence is listed above.
- Initial seed integration passed 8 tests and 83 assertions (`upload-seed.log`). Final seed rerun after the upload/download changes is being recorded separately below when terminal.
- Upload checkpoint source digest before the subsequent identity-only entry work: `b1132c68ed651880c9f5782c556d34b996f6529cb61127354f3f05b94cd31d43`, using the non-document convention above.

Plan 00.5's bounded asset-read interface is verified and checked. Purpose restrictions, the whole supported-format matrix, reference-safe cleanup/removal and command audit adoption remain open. No real provider upload, production migration, reset or document generation was performed. Plan 00 is still on-going; Plans 01–06 are still planned.


- Final upload seed rerun passed 8 tests, zero failures and 83 assertions (`upload-seed-final.log`). The inspected temporary identity fixture was stopped after completion; no provider or deployed identity was used.

## Identity-only entry checkpoint

`admitIdentityOnlyEntry` verifies the existing Central Identity access token and returns a frozen request-local capability exposing only `acceptInvitation(token)`. It exposes no school service, repository, subject mutation or caller-selected school authority. Credential lookup occurs only when that operation is invoked, and the persisted invitation selects the school. The existing workflow still validates contact/token/lifecycle and writes inside its transaction. The public handler now uses this boundary. Matching an actor ID in another school no longer satisfies the selected-profile compatibility check.

The entry does not authenticate session cookies, school service keys, S2S keys, expired access tokens or tokens for another audience. Forged school/profile headers cannot select its integration actor. HTTP logs now redact invitation token path segments as well as private upload capabilities and download credentials. No public DTO or generated client contract changed.

- Identity/session focused tests: 8 passed, zero failures, 28 assertions (`identity-entry-focused.log`).
- Final identity-entry/logger tests: 5 passed, zero failures, 27 assertions (`identity-entry-final-focused.log`).
- Existing public invitation integration journey: 5 passed, zero failures, 33 assertions (`identity-entry-integration.log`). This includes send/preview/accept, resend revocation, unknown tokens and missing authentication.
- API package lint and TypeScript passed (`identity-entry-api-quality-final.log`) after correcting test formatting.

This verifies the shared identity-only entry requirement, not Plan 01's pairing credentials, target resolution changes, acceptance concurrency, verified-contact policy, notification journey or client pending intent. Plan 01 remains planned until all of Plan 00 exits.


## Invitation outbox and attachment contract checkpoint

Invitation delivery now persists its job and explicit destination with the caller's business transaction. The existing school dispatcher polls both school notifications and invitations after commit. A named read-only `invitation-dispatch` policy loads the current school-bound invitation; only a pending, unexpired email invitation with a matching destination may send. Missing resolver configuration retries without sending, while revoked/accepted/expired or substituted targets cancel. Authentication emails retain awaited delivery and the selected providers are unchanged.

Automatic invitation scheduling previously swallowed all errors, including enqueue failures after invitation persistence. It now skips missing contact or unavailable caller authority before mutation, and propagates admitted enqueue failures so registration and invitation roll back together. Provider failures occur after commit and use the durable retry budget. [Notification delivery](../../../architecture/notification-router.md) documents queue acknowledgement and current-state resolution.

- Focused notification enqueue/gateway tests passed 9 tests and 23 assertions; final missing-resolver/school/credential/contact denial tests passed 5 tests and 19 assertions (`invitation-outbox-final-focused.log`).
- Invitation workflow and source-policy guard tests passed 23 tests and 56 assertions (`invitation-policy-final.log`). This includes registration rollback after enqueue failure and current invitation lifecycle resolution. The source guard caught a direct permission assembly; it was moved into the named authorization policy without weakening the guard.
- The exhaustive internal actor matrix passed 9 tests and 1,071 assertions (`invitation-action-matrix.log`), including the new dispatch actor's sole read action and foreign-school denials.
- Native PostgreSQL passed 23 tests and 124 assertions (`invitation-outbox-native-final.log`), including rollback of invitation plus queued intent, concurrent dispatch, expired invitation cancellation and provider I/O using a one-connection pool after commit. A fixture-only TypeScript access error was corrected to use its typed SQL adapter. The final combined native rerun is recorded below.

Attachment registry exposure now uses `COMMAND_ONLY`. REST and GraphQL no longer offer generic save/delete/batch operations, while reads, upload admission, `registerAttachment` and named removal remain. The service's existing save guard continues to prevent direct managed-write bypass. `bun repo openapi export` and `bun repo openapi generate` regenerated the TypeScript contract; the two OpenAPI copies match, exactly four generic attachment paths were removed, and no path was added. Dart bindings were generated from that local specification.

- REST/GraphQL contract tests passed 22 tests and 723 assertions (`attachment-contract-focused.log`).
- Mobile `melos run verify` passed generation/brand checks, analysis and all 106 local tests. The client regression confirms attachment writes fail before network access. Log: `attachment-contract-mobile-verify.log`; device/provider qualification remains separate.
- The initial web verification replayed cached results against a stale materialized Bun file dependency. `bun install --frozen-lockfile --force` refreshed that dependency without tracked frontend changes; installed bindings were inspected. Uncached Turbo quality, build and test runs then passed, including 775 web tests (`attachment-contract-web-fresh.log`). The [cross-repository workflow](../../../reference/cross-repo-workflow.md) now records that refresh and cache requirement.
- Full backend `bun run verify` passed hygiene/contracts, all quality/build tasks and 1,762 tests with zero failures (`foundations-contract-verify.log`). The independent internal-actor matrix also ran after its final test-case addition.
- Final non-document source digests for this checkpoint: backend `7a579d89d3101c735ee9c00de6ba1497d5dfdad2f03afa705fb64d87f90d469a`; mobile `7f0ff6c9ed214c67c6e2d71df0332b5bf9482e313984ff8d7e65477692aa4d8d`. Frontend tracked source is unchanged; its installed client now matches this backend contract.

The combined HTTP/runtime integration and final native reruns are recorded below when terminal. Earlier current-behavior integration passed 41 tests, and the upload checkpoint's final seed suite passed 8 tests/83 assertions. No deployed provider, real recipient, financial reset or production migration was used.

Plan 00 remains on-going. Identity-only admission and bounded asset reads are now individually verified. Remaining work includes purpose policies, complete supported-format qualification, reference-safe cleanup/removal, existing command receipt/audit adoption, report-card rendering and attachment deletion network calls still inside transactions, and consolidated authorization/caller/fixture handoff. Plans 01–06 have not started.


- Final combined native suite passed 23 tests, zero failures and 124 assertions on the recorded backend digest (`foundations-contract-native.log`). The temporary cluster stopped cleanly. Both webapp and webadmin installed binding files were byte-for-byte compared with the generated backend bindings and match. The prior disposable identity process exited with code 0.

- Final combined `bun run test:integration` passed all 41 tests (13 service/runtime/adaptor and 28 HTTP), zero failures (`foundations-contract-integration.log`). The final generated-contract and scoped-write scenarios passed on the recorded backend digest. All test processes started for this checkpoint have completed; no disposable identity or native PostgreSQL fixture is intentionally left running.

## Report rendering transaction checkpoint

Report-card orchestration now lives in `@edaya/service`; the API retains a thin re-export. Short database phases load the currently authorized published report and serialize publication by school/result. Both rendering and storage run outside SQL. Before upload and again before committing the attachment, the service reloads publication authority and compares the current rendered payload and report placement/publication identity with the initial source. Source changes fail with `REPORT_DOCUMENT_SOURCE_CHANGED` and allow a fresh rendering request. Provider diagnostics are sanitized to stable renderer/storage failure messages.

Concurrent renderers of the same current source return one winning attachment. Legacy tiny-PDF status changes occur only in the transaction that publishes the replacement, so renderer/storage failures, revocation, unpublication and final commit failure preserve the previous record. Empty published shells no longer mark existing stubs failed without a replacement. The current cache still lacks durable source/locale versions; Plan 04 retains that ownership. A losing upload or failed final commit can still leave an unreferenced private object until the shared cleanup foundation is implemented. See the [renderer architecture](../../../architecture/document-renderer.md).

Native `bun run test:integration:native` passed 26 tests, zero failures and 155 assertions (`/private/tmp/edaya-v1-baseline/report-render-native-final.log`). The new cases verify independent one-connection pools can be borrowed during rendering and storage, two concurrent uploads publish one attachment, storage-time revocation prevents publication, and final transaction failure rolls back both attachment writes. The disposable cluster stopped cleanly. The first native run found a missing required class-subject relationship in the test fixture; the corrected fixture passes without changing the domain rule.

The initial quality run used the root lint settings for API files and failed the API's own quote/semicolon rules. Files were reformatted using the API configuration. Initial failure tests also needed the new stable provider messages. Final backend and HTTP integration outcomes follow when terminal; initial failed logs are not exit evidence. No public contract, client, seed, deployed provider or production schema changed in this checkpoint.

- Final `bun run verify` passed repository/contract hygiene, all quality/build tasks and 1,773 tests, zero failures, including 632 service and 252 API tests (`report-render-verify-final.log`). This includes the corrected provider-failure cases and all source-change/revocation regressions.
- Final `bun run test:integration` passed all 41 tests (13 service/runtime/adaptor and 28 HTTP), zero failures (`report-render-integration.log`). Native evidence is recorded above; its 26 tests pass.
- Final non-document backend source digest: `99f95844b09e96d397e68ec819a21bc9b48da0d76f18a309a6968a15e8c2e17e` using the recorded changed-path/content hashing convention. It was checked again after all test processes completed. `git diff --check` passed. Generated contracts and sibling application source are unchanged by this checkpoint; their previous verified evidence remains applicable.
- All processes started for this checkpoint have completed. No disposable PostgreSQL or identity fixture is intentionally left running.

Plan 00 remains on-going, with 0/7 plans complete. Report rendering no longer contributes network work inside SQL. Reference-safe attachment removal/cleanup, purpose restrictions, supported-format qualification, command receipt/audit adoption and consolidated authorization/client/fixture handoff remain outstanding. The shared network-effects checkbox stays open until the remaining paths are verified; Plans 01–06 remain planned.


## Private-file lifecycle and external-effects checkpoint

Migration `0018_private_file_lifecycle` adds school-scoped object inventory and reference records, attachment/profile reference triggers, protected upload/grant windows and guarded deletion tombstones. Upload staging, accepted copies, report documents and logbook output are inventoried before storage I/O. Named attachment removal checks references and removes metadata in one transaction; it schedules eligibility without storage I/O. Cleanup preparation commits a tombstone, payload-minimal audit, command receipt and reference-only outbox together. The existing durable worker deletes outside SQL, binds completion to its stored school/object/job identity and retries stable failures. Deleted objects receive a daily sweep to catch late writes. Local filesystem deletion now reports non-missing failures instead of acknowledging unsuccessful deletion.

Migration backfill preserves business data. Known legacy opaque external aliases are held indefinitely, and removal rejects them with `ATTACHMENT_LEGACY_ALIAS` while retaining metadata. Ambiguous case/Unicode/path/metadata-sidecar key families are held conservatively; new conflicting reservations serialize and fail closed. Unknown historical bucket objects are not enumerated. Plans 02/04/05 retain feature-specific reference registration, retention and legacy cutover ownership. See the [private-file contract](../../../reference/private-file-foundations.md).

Native races cover two independent one-connection pools, competing cleanup preparation/dispatch, reference-versus-removal, tombstone-versus-publication and physical-key alias reservation. The external-call audit and native cases now cover upload signing/reading/copy, bounded assets, report rendering/storage, logbook rendering/storage/signing, attachment download signing, deletion and notification providers. Each provider call occurs outside the business transaction; current authority and lifecycle are checked in bounded SQL phases.

Final checks on backend non-document source digest `10543d72449238843b89030ea6cbc1ae26a7991775c652402b64f6dd580c0059`:

- `bun run verify`: 30/30 tasks successful; 1,788 tests, zero failures, including 643 service and 252 API tests. Log `/private/tmp/edaya-v1-baseline/file-cleanup-final-gate.log`.
- `bun run test:integration:native`: 31 tests, 180 assertions, zero failures; disposable cluster stopped cleanly. Log `file-cleanup-final-native.log` in the same directory.
- `bun run test:integration`: 41 tests (13 runtime/adaptor and 28 HTTP), zero failures. Log `file-cleanup-final-integration.log`.
- `bun run test:integration:seed`: 8 tests, 83 assertions, zero failures. Log `file-cleanup-final-seed.log`.

All four verification processes exited successfully. The disposable identity fixture was stopped and exited with code 0. Public DTOs and generated clients did not change in this checkpoint. No deployed provider, production migration or finance reset was performed.

Plan 00 remains on-going, with 0/7 plans complete. The cleanup and network-effects requirements are now individually checked. Purpose restrictions, complete supported-format qualification, existing command receipt/audit adoption, finance reset inventory and consolidated authorization/client/fixture handoff remain outstanding; Plans 01–06 remain planned.

## Upload format and disposable finance baseline checkpoint

Upload admission now accepts only identifiable supported formats: JPEG, PNG/APNG, WebP, GIF, PDF and DOCX under the existing owner-specific bounds. Legacy DOC is rejected immediately with `UPLOAD_MIME_TYPE_NOT_ALLOWED`: its generic CFB container was already rejected at completion, so an unusable upload capability is no longer issued. APNG bytes may use either `image/png` or `image/apng`; an ordinary PNG cannot claim APNG. Service byte limits now reject non-integer/non-finite values explicitly. Current web/mobile source has no separate DOC allowlist requiring a client change; public DTOs and generated contracts are unchanged.

Checked-in synthetic binary fixtures exercise the complete admitted-upload path with misleading/uninformative filenames. Cases cover each supported format, MIME mismatch, ordinary ZIP presented as DOCX, unidentifiable/truncated/ambiguous data, immutable copied bytes and no ready record after rejection. This verifies signature/type identification and existing size policy, not complete format parsing or malware safety; Plan 02 still owns decoded image, animation and dimension restrictions. The [file-type primary documentation](https://github.com/sindresorhus/file-type) explicitly describes the detector's signature-based limits.

Final verification:

- Focused format/owner policy suite: 19 tests, 61 assertions, zero failures (`/private/tmp/edaya-v1-baseline/upload-formats-owner-policy-final.log`). The report-card denial now uses DOCX, preserving an actual owner restriction test after DOC was removed globally.
- `bun run verify`: all 30 tasks passed; 1,803 tests, zero failures, including 658 service and 252 API tests (`upload-formats-verify.log`).
- `bun run test:integration:native`: 31 tests, 180 assertions, zero failures; cluster stopped (`upload-formats-native.log`).
- `bun run test:integration`: 41 tests (13 runtime/adaptor and 28 HTTP), zero failures (`upload-formats-integration.log`).
- Seed source, public contract and sibling application source are unchanged by this format-only checkpoint. The preceding cleanup checkpoint's 8 passing HTTP seed tests remain recorded separately.

The full backend/native/HTTP gates ran on non-document source digest `908ef38e668115fdc50c66df309b2ee4aa78b8bd04ad38657f82789f3eb3731c`. After their success, only the existing owner-policy test's rejected MIME was corrected from DOC to DOCX; the focused suite and lint passed again. Final non-document digest is `6c98c57e19ad03f22ada90856d916995abb7ab2572047832970125e5cace52ad`. Production source is identical between these digests. All verification processes completed successfully; no test fixture is intentionally left running.

The [finance reset boundary](00-finance-reset-boundary.md) now records the selected disposable implementation target, school-parent resolution, payment artifacts, pending uploads, stale replay/work identities and records that must survive. Current native evidence confirms the fresh loopback cluster lifecycle. No existing environment or data reset was selected. Plan 03 owns target-validated finance-only tooling and before/after preservation/reconciliation tests.

Plan 00 remains on-going, with 0/7 plans complete. The supported signature/MIME matrix and disposable-target baseline are now reconciled. Purpose restrictions, existing command receipt/audit adoption and consolidated authorization/client/fixture handoff remain outstanding; the combined upload owner/purpose checkbox remains open. Plans 01–06 have not started.


## Attachment purpose enforcement checkpoint

Migration `0019_attachment_purposes` preserves existing attachment content/owner fields with a `general` default and prevents purpose changes in persistence. The existing scoped repository contract now carries exact purpose selections. Generic scopes reach `general` only, including for school owners; unknown/private purposes remain concealed. SQL combines purpose with each alternative's owner, school, relationship and publication constraints before metadata reads, lists, counts and pagination.

Internal `AttachmentUploadPolicy` and `AttachmentReadPolicy` hooks let future named feature policies supply their current resource scope without opening a client-selected permission registry. Upload intent purpose is capability-fixed; all completion phases and replay reload authority, verify existing/proposed targets and require the original purpose. Bounded loading and download signing repeat the policy after I/O. Purpose-specific download grants require a private key and reject external URL compatibility links. Plans 02/04/05 own actual feature audiences, lifecycle transitions and public projections; no future business model was started here. See the [interface contract](../../../reference/private-file-foundations.md#purpose-scoped-metadata-uploads-and-delivery).

The response DTO includes purpose. `registerAttachment` keeps purpose optional for the existing `general` default, matching its runtime behavior; a forged different purpose cannot change admission. The generic upload-intent route rejects unknown fields, including purpose. TypeScript and Dart bindings were regenerated. Both installed web client schemas were compared byte-for-byte with the final backend schema and match; frontend tracked source is unchanged. The mobile binding representation did not require additional tracked changes beyond the preceding contract checkpoint.

Verified outcomes (logs under `/private/tmp/edaya-v1-baseline/`):

- `bun run verify`: 30/30 tasks successful; 1,815 tests, zero failures, including 667 service and 254 API tests (`purpose-verify-qualified.log`).
- `bun run test:integration:native`: 32 tests, 185 assertions, zero failures (`purpose-native-final.log`); disposable cluster stopped. Includes purpose-restricted byte loading and current revocation while storage borrows the pool's sole connection.
- `bun run test:integration`: 41 tests (13 runtime/adaptor and 28 HTTP), zero failures (`purpose-integration.log`).
- `bun run test:integration:seed`: 8 tests, 83 assertions, zero failures (`purpose-seed.log`); the memory-only, log-email identity fixture stopped with exit code 0 afterward.
- Frontend repository hygiene and uncached quality/build/test all passed (`purpose-web-*-final.log`), including 775 tests. `bun install --frozen-lockfile --force` refreshed the materialized local API dependency before verification.
- Mobile `melos run verify` passed generated/brand checks, analysis and all 106 local tests (`purpose-mobile-verify-final.log`). This is local consumer evidence, not device/provider release qualification.

The service matrix covers four selected profiles sharing a login, purpose filtering before pagination/count, foreign school/child, immutable purpose, generic bypass/replay, a synthetic owning policy and revocation after reads/signing. REST and GraphQL tests prove concealed metadata/counts and content responses. Migration tests prove legacy preservation and refusal to declassify records. The final service suite also rejects a legacy URL through a purpose-specific grant.

Initial failed runs are not exit evidence: two new test callbacks needed multiline formatting; HTTP test response assertions needed their actual unknown JSON type; the generated completion request initially made purpose required despite its runtime default, which was corrected to optional. The local file-storage server could not bind inside the sandbox, so the final backend suite ran with local test-server access and passed. No assertion or authorization boundary was weakened to fix these failures.

Final non-document backend digest: `827bb59936634d5b6fb310a0f49b3f0aa5e658181e6b24efeff8d4c78388d6a7`. The final full backend/native gates and consumer regeneration use this source state. HTTP/seed runs started before the last optional-request typing and explicit-policy legacy-grant safeguard; neither changes the generic seeded upload behavior, and the final API/service suites cover those changes. This checkpoint is working-tree evidence; Plan 06 still requires the exact coordinated candidate and deployed qualification.

Plan 00 remains on-going, with 0/7 plans complete. Its upload owner/purpose and purpose-scoped metadata/content requirements are now individually checked. General command receipt/audit adoption, the remaining shared authorization/client/fixture reconciliation and private-delivery legacy handoff remain outstanding. Plans 01–06 remain planned.


## File command journal and current authorization checkpoint

Upload admission, completion and removal now use the existing `CommandExecution` wrapper with an explicit caller-bound scope and projection. `schoolCommandScope` hashes the selected profile/identity and logical attachment ID while retaining the verified school. Token renewal preserves the namespace; another profile or relinked identity does not inherit it. Admission authorizes the actual server-generated attachment proposal before persisting it. Existing intent caller keys remain compatible.

Admission commits its intent, inventory, receipt and audit together, then signs outside SQL. Its secret-display receipt contains only the attachment ID; lost-URL recovery reloads the original unexpired pending intent and current owner/purpose policy without extending expiry. Completion commits ready metadata, intent completion, receipt and audit atomically. Replay requires the original unchanged authorized metadata and does not read mutable staging bytes. Removal commits deletion, cleanup eligibility, receipt and audit; replay reauthorizes the original owner and cannot delete a replacement using the same ID. No private keys, URLs, filenames, bytes or provider diagnostics enter these journal records. See the [file command contract](../../../reference/command-execution.md#file-command-adoption).

Four new service cases cover lost signing results, revocation, audit-completion failure and rollback at each transition, changed completion metadata, removal replay and replacement protection. Cleanup rollback assertions now preserve the legitimate preceding removal receipt rather than assuming an empty journal. Native competing calls assert exactly one admission and completion receipt/audit across two pools of size one. API, service and integration fixtures now supply the real transactional journal; production composition already did.

The [current authorization reconciliation](00-authorization-reconciliation.md) maps actor kinds and entry points to concrete policy tests and rechecks the shared read/write/fact lifecycle. Comparing the current entity policy catalog with the existing complete resource inventory yields 55 unique keys with no missing or extra keys. New file-specific tests supplement that unchanged catalog. This is local shared-boundary evidence; feature policies and deployed freshness still need their owning plans.

Final verification passed on backend non-document digest `e2174a218562340d3dd43b5b9a4a1d0134fa91a9ce8e297f7fc9438f21e3a03b`. Logs are under `/private/tmp/edaya-v1-baseline/`:

- Focused journal/purpose cases: 13 tests, 77 assertions, zero failures (`file-journal-target-tests.log`).
- Focused journal/cleanup rollback cases: 15 tests, 97 assertions, zero failures (`file-journal-audit-tests-final.log`); this preceded the final actual-proposal assertion, which the journal/purpose run covers.
- `bun run test:integration:native`: 32 tests, 187 assertions, zero failures (`file-journal-native-final.log`); disposable cluster stopped successfully.
- `bun run verify`: 30/30 tasks successful; 1,819 tests, zero failures, including 671 service, 98 authorization, 174 Postgres and 254 API tests (`file-journal-verify-qualified.log`).
- `bun run test:integration`: 41 tests (13 runtime/adaptor and 28 HTTP), zero failures (`file-journal-integration-final.log`).
- `bun run test:integration:seed`: 8 tests, 83 assertions, zero failures (`file-journal-seed.log`). The memory-only identity fixture stopped with exit code 0 afterward.
- Repository hygiene and generated-artifact drift checks pass (`file-journal-hygiene.log`). Public DTOs and sibling application source did not change in this checkpoint; the preceding coordinated web/mobile results remain separate evidence.

Initial failures were corrected without weakening assertions: service fixture imports/types and multiline formatting, cleanup expectations after journal adoption, a missing journal in the shared integration fixture, and the native database handle's SQL type. Failed attempts are not exit evidence.

The four existing-authorization enforcement items in 00.2 are now individually checked using the current matrix and passing gates. All verification processes completed successfully; no test fixture is intentionally left running.

Plan 00 remains on-going and Plans 01–06 remain planned. Client/fixture handoff, complete existing-command contract reconciliation and historical external-file delivery remain outstanding. No production migration, external-provider call, finance reset or deployment was performed.


## Private delivery and shared fixture checkpoint

Private download grants now require a ready attachment with a private storage key for every audience. External-only historical records no longer return an uncontrolled URL with a fabricated expiry. Both content/download-url endpoints conceal those records with 404 and no Location or external URL. Metadata is preserved for the owning migration; no remote import or destructive rewrite occurs. Required historical downloads must be migrated through admitted uploads before release. Existing private-key grants retain authorization before signing and after I/O. See the updated [private-file contract](../../../reference/private-file-foundations.md#private-delivery-and-compatibility).

The new `createAuthorizationScenario()` export in `@edaya/fixtures` supplies a fresh, reusable two-school graph: owner and scoped staff, assigned/unassigned teachers, two siblings, unrelated/foreign children, independent co-guardians and disabled access. Owner/teacher/guardian/student profiles intentionally share a subject to test separation. The scoped staff fixture uses the existing student-grain `QUERY_STUDENT_DETAIL_READ` permission. It does not widen `STUDENT_READ` or change runtime policies. The factory is declarative and does not provision identities, persist state or run providers. Attachment/profile mutation seeds use admitted commands. Final source reconciliation identified two remaining direct seed writes: the minimal bootstrap guardian and auth-link school-owner assignment. The general mutation-seed checklist remains open until those use admitted paths.

Three integration cases use real PGlite repositories and service policies to check all allowed profiles before list/count/pagination/single lookups, forbidden family writes, independent guardian unlinking, disabled access, current teaching removal and grant expiry. The final corrected cases pass in the full integration run's 16-test service/adaptor phase. Unassigned teachers correctly receive an empty scoped result; disabled guardians receive authorization denial. The [fixture handoff](00-shared-fixture-contract.md) records expected audiences and feature extensions. The [dependency handoff](00-dependency-handoff.md) records concrete shared APIs, feature ownership, verification commands and evidence requirements for all later plans.

Verification on backend non-document digest `9d90404d18ef70c51e376ea203c97891b2df1c0c274c64591fc8c725ec33708c` (logs under `/private/tmp/edaya-v1-baseline/`):

- `bun run verify`: 30/30 tasks successful, 1,821 tests and zero failures, including 672 service and 255 API tests (`private-delivery-scenario-verify-final.log`).
- Focused delivery/purpose service tests: 17 tests, 75 assertions, zero failures (`private-delivery-service.log`); API delivery tests: 4 tests, 24 assertions, zero failures (`private-delivery-api.log`).
- Shared scenario: 3 tests, 77 assertions, zero failures (`shared-scenario-integration-passing.log`); final full integration includes the subsequent readonly-contact input typing correction.
- `bun run test:integration:native`: 32 tests, 187 assertions, zero failures (`private-delivery-native.log`); disposable PostgreSQL stopped. This ran on the final production delivery change before the separate fixture factory/test additions; the native suite and its production dependencies did not change afterward.
- `bun run test:integration`: 44 tests (16 service/adaptor and 28 HTTP), zero failures (`private-delivery-scenario-integration-final.log`); process exited successfully.
- Repository hygiene, generated drift, affected fixture/integration lint and type checks pass. Public DTOs and existing seed datasets/orchestration are unchanged. The preceding 8 passing seed tests and coordinated 775 web/106 mobile tests remain separately recorded; no new consumer or deployed-provider qualification is claimed.

Initial fixture attempts used an invalid scope spelling/grain and expected an exception for an unassigned teacher where the existing policy correctly returns an empty scope. The fixture now uses the canonical student-detail grant and asserts exact empty list/count/concealed lookup behavior after teaching removal. A readonly guardian contact list also needed copying into its mutable constructor input. No production permission rule was relaxed.

Private delivery, the reusable two-school fixture and concrete dependency handoff are now individually checked. All final verification processes exited successfully; no test fixture was started or left running in this checkpoint.

Plan 00 remains on-going, with 0/7 plans complete. Shared client state/error/conflict presentation, the two direct seed writes, existing command-contract reconciliation and final exit acceptance remain open. No production migration, provider delivery, finance reset or deployment was performed.


## Seed admission and Plan 00 completion checkpoint

Minimal school bootstrap now runs admitted school/staff/guardian commands in one selected-school transaction and disables invitations for this synthetic fixture. Guardian failure rolls the bootstrap back. Auth-link owner assignment now uses `initializeFixtureSchoolOwner`, restricted to the exact fixture-seed system identity, current linked active human staff, ownerless/same-owner school, no pending invitation, unchanged settings and the existing one-owning-school invariant. Canonical identifiers prevent lock aliases. School mutation, receipt and reference-only audit commit together. The shared workflow refuses owner replacement before either adapter is called; no public fixture endpoint was added.

Final seed-admission verification passed: 30/30 backend tasks and 1,826 tests (`seed-admission-verify.log`), 46 service/adaptor/HTTP integration tests (`seed-admission-integration.log`), 8 seed tests/83 assertions (`seed-admission-seed.log`), and 34 native tests/193 assertions (`seed-admission-native.log`). The disposable identity fixture was stopped after seed completion and returned exit 0. Native PostgreSQL stopped successfully. Final seed source digest was `c4640b4c5f1160cc1f58d390762fb1e3b6b600bceab25e3d3730f5740d3e1dca`; final canonical-ID/owner-refusal edits received affected quality and workflow checks, then the final native/backend gates below. No direct bootstrap/auth-link repository mutation bypass remains.

Shared client review fixed confirmed saves being reported as failures when a later display refresh failed. Web route runners now share one tested executor with preserved family defaults, explicit request-only rollback, version invalidation after confirmed writes and FR/EN conflict/refresh guidance. Mobile profile and teacher mark reconciliation retain successful results; profile/attendance/mark/evaluation/logbook failure feedback uses the shared localized conflict contract. Auth wrappers continue to retry only reads once. No client permission or selected-profile fallback was introduced.

Three final public API acceptance tests verify oversized REST/GraphQL and streamed bodies are rejected before dependency/command execution. The final backend gate passes 1,829 tests (including 258 API), native passes 34/193, frontend passes 782, mobile passes 111, and unchanged identity passes 57. All final required processes exited 0. Source digests, exact logs, cache provenance, generated-client hashes, migrations, matrices and limitations are consolidated in [Plan 00 exit acceptance](00-exit.md).

Plan 00 is **done**, with **1/7 plans complete**. The current goal stops at Plan 00, so Plans 01–06 remain planned. Their predecessor gate is available, but their feature work has not started. No production migration, external-provider delivery, existing finance reset, commit or deployment was performed.

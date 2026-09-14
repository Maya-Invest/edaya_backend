# Plan 00 exit acceptance

Status: **done**. Owner: Codex. Date: 2026-09-14. The current goal is complete Plan 00; Plans 01–06 remain planned. This is local shared-foundation acceptance, not v1 release qualification.

## Requirement matrix

| Plan requirement | Acceptance and evidence |
|---|---|
| 00.1 baseline, ownership and disposable finance boundary | Four starting revisions/clean trees and environment recorded; final source state below. Baseline reconciliation assigns every later feature and unrelated launch prerequisite. Finance preservation inventory selects only a fresh disposable native cluster; no existing database reset. |
| 00.2 caller/action/resource, read scope, writes, current revocation, identity-only and consumers | Current 55-resource policy catalog matches its audited inventory. Service/SQL/REST/GraphQL matrices cover school and same-school unrelated targets, existing/proposed/batch writes and revocation. Identity-only admission is authenticated and operation-limited. Two-school fixtures and generated/auth client tests preserve selected-profile authority. |
| 00.3 normalized caller-bound replay, atomic effect/audit/outbox, secret-display, I/O and lifecycle guards | Shared command matrix qualifies school/command/caller/request namespaces, changed-input conflicts, current replay, explicit safe projections and real transaction rollback. Native independent pools of size one prove races and non-deadlocking I/O. Current invitation/payment/upload lifecycle constraints remain; new feature contracts retain their explicit owners. |
| 00.4 durable work and notifications | Migration-managed persistence, claim/lease/expiry/backoff/attempt limits, interruption/stale acknowledgement, versioned authoritative references and independently completed channels pass service/persistence/native tests. Existing provider configuration is preserved. |
| 00.5 private files | Caller/owner/purpose upload intent; supported signature/size/actual-byte checks; immutable completion; purpose restriction before metadata/count/pagination; bounded authorized asset loading; current signed/private delivery; safe reference-aware cleanup and concurrent reservation/tombstone protection all pass. |
| 00.6 clients, fixtures and handoff | Shared client state/conflict/retry acceptance passes. Declarative two-school fixtures remain side-effect-free; minimal guardian bootstrap and fixture owner assignment use admitted policy paths. Reusable interfaces, exact commands, limitations and owning feature work are documented. |
| Verification: unit/service | Permission and current-resource decisions, canonical digest/replay, explicit safe audit, durable work and domain guards are included in the final 1,829-test backend gate. |
| Verification: persistence | SQL scope before reads/count/pagination, same-school unrelated/foreign targets, guarded mixed writes and rollback pass in the real PGlite adapter and integration suites. |
| Verification: native PostgreSQL | 34 tests/193 assertions, independent one-connection pools; receipt claims, leases, current access, rollback, provider/storage I/O and fixture ownership races. Cluster stopped successfully. |
| Verification: public API | Generic-write bypass, REST/GraphQL policy parity, file delivery, identity-only admission, error mapping, redaction and bounded bodies pass in the 258 API tests and HTTP integration suite. |
| Verification: consumers | Generated/installed contract alignment, selected-profile grants, auth renewal/no mutation replay, route loading and localized conflict/confirmed-save feedback pass. Web 782 tests; mobile 111; identity 57. |
| Verification: notifications | Failed channel recovery preserves successful completion; recipient/device/occurrence identity is school-aware. Actual provider delivery remains at least once and requires Plan 06 qualification. |

Detailed matrices: [authorization](00-authorization-reconciliation.md), [command contracts](00-command-reconciliation.md), [clients](00-client-acceptance.md), [fixtures](00-shared-fixture-contract.md), [baseline owners](00-baseline-reconciliation.md), [finance preservation](00-finance-reset-boundary.md), and [dependency handoff](00-dependency-handoff.md).

## Final commands and outcomes

All logs are retained under `/private/tmp/edaya-v1-baseline/`. Every command below completed successfully. Final repository hygiene/generated drift and `git diff --check` also pass (`exit-hygiene-final.log`). Turbo cache hits are reported by the logs and are not represented as newly executed tests.

| Repository / command | Outcome | Log |
|---|---|---|
| Backend `bun run verify` | Hygiene/generated drift, quality/build/tests; 30/30 tasks, 1,829 tests, zero failures; final API tests/check ran uncached | `exit-backend-verify.log` |
| Backend `bun run test:integration` | 46 tests: 18 service/adaptor (197 assertions) + 28 HTTP (313 assertions) | `seed-admission-integration.log` |
| Backend `bun run test:integration:native` | 34 tests, 193 assertions; fresh loopback PostgreSQL 14.15 cluster stopped | `exit-native-final.log` |
| Backend `bun run test:integration:seed` | 8 tests, 83 assertions; synthetic/log-only identity fixture stopped, exit 0 | `seed-admission-seed.log` |
| Identity `bun run verify` | Unchanged source; all gates, 57 tests | `exit-identity-verify.log` |
| Frontend `bun run verify` | Hygiene, quality/build and 782 tests; changed webapp tasks uncached | `client-web-verify.log` |
| Mobile `melos run verify` | Brand/generated checks, analysis and 111 local tests (6 integration-config, 13 auth, 10 API, 19 shared, 21 Guardian, 42 Teacher) | `exit-mobile-verify.log` |
| Web production mutation/auth/i18n focused cases | 18 tests; one request, rejected-write rollback, confirmed-save preservation, localization and renewal rules | `client-mutation-focused.log` |
| Mobile production profile controller cases | 2 tests; guardian target, conflict draft retention, saved-result preservation, no repeat and busy-state reset | `client-mobile-profile.log` |
| Final fixture owner service cases | 4 tests, 24 assertions; canonical identifiers, current authority, ownership invariant and rollback | `exit-seed-owner-focused.log` |
| API request bounds | 3 tests, 5 assertions; REST/GraphQL and streamed input without Content-Length | `exit-body-bounds.log` |

The integration and seed suites qualify the seed-admission production changes. The only subsequent backend addition is the public body-bound acceptance test; the final full/native gates use the source digest below. The final canonical fixture-owner guard also has targeted service evidence. Earlier failed setup/formatting attempts are not exit evidence. Historical checkpoints and exact scope are retained in [implementation evidence](00-implementation.md).

## Source and contract provenance

These are uncommitted working-tree changes on the recorded initial revisions. No release commit, deployment or production migration is claimed. Identity remains clean. Changed-file digests exclude `docs/` and all Markdown, and hash sorted changed/untracked paths plus their file-content SHA-256 (or deletion marker), as in previous checkpoints.

| Repository | HEAD | Non-document changed-source digest | Changed non-document files |
|---|---|---|---|
| edaya_backend | `a5e1b1b18018437f52e61485ebc62a036e3ee91f` | `2e7d04f28e08fd0d80aca0250c2ae278da74f7252d8ff346266ab3272153691c` | 218 |
| edaya_identity | `75edbd9d1bc49b25021b36fd540e839d1ae3f09a` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 0 |
| edaya_frontend | `6d853f21fa32317d766954a66aaa13d78f4bc353` | `89ce105eb3fcc2eedcdbf5ba5e5ddd6cbfca9d9f16a6725b621a6135fa918132` | 29 |
| edaya_mobile | `4fcefe49398ea9cca91ff6e42c099aa47425c1d8` | `7d5ff5d6684cdb397641dbe407e5e136d322c7f0c95ee57cbecb1696bdce9403` | 16 |

Both webapp and webadmin resolve the same materialized local API client. Its `schema.d.ts` matches the backend byte-for-byte (SHA-256 `a92a9225ae098b911430e66e06d9c23ae9f5d419a71d51ccaead7b095be14682`); its OpenAPI snapshot also matches (`90ffaed8da204c314d2886821d85523bd77fdc8e5e6fa092ded9a09ccf8000f0`). Mobile generation/drift uses the canonical binding manifest and passes. The API/client versions remain those recorded in the starting inventory; no package publication occurred.

New school migrations are `0013_notification_schema`, `0014_command_journal`, `0015_cron_occurrences`, `0016_notification_tenants`, `0017_attachment_uploads`, `0018_private_file_lifecycle`, and `0019_attachment_purposes`. They are additive, exercised in disposable migration/integration/native databases; applied production history was not rewritten. Unscoped legacy notification devices are quarantined pending authenticated registration, and existing attachments receive the general purpose default.

## Limits and handoff

- Plan 00 implements shared mechanisms. Pairing, photo approval, replacement accounting, official-document issuance and surveys remain Plans 01–05; their commands must supply domain uniqueness, current policy, safe result projection and feature-specific replay. Existing unadopted mutations remain non-automatically-retryable.
- External-only historical attachment records now produce concealed 404 for private delivery; metadata is preserved. Plans 02/04 must migrate required assets through admitted uploads before release. This cannot revoke already external copies.
- Supported file signatures and byte bounds are verified, not full decoding or malware safety. Plan 02 owns decoded image/dimension/animation restrictions.
- Provider delivery can duplicate after an uncertain network result; per-channel completion is not an exactly-once network guarantee. No real messages were sent.
- Native PostgreSQL, PGlite, mocked transports and local widget/rendered-component checks do not qualify actual browsers/devices/providers, deployed cookies/queues, migrations or restore. Plan 06 owns those checks after features and the separately assigned RC launch prerequisites are implemented.
- No existing finance data was reset, no production objects were deleted, and no release or deployment was performed. Test fixtures started for this checkpoint were stopped.

All four Plan 00 exit conditions are satisfied: shared matrices pass, affected repositories/contracts pass, later plans have reusable mechanisms without weakening permissions, and exact evidence/migrations/fixtures/limitations/handoff are recorded. The predecessor gate is complete; no later plan has been started.

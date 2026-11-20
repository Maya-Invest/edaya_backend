# EDaya release candidate — coding-agent implementation handoff

> **Superseded for identity (2026-09-11):** Better Auth, opaque `edaya_at_` tokens, and in-process `/auth` now live in sibling `edaya_identity`. School authenticates users with identity JWTs. Ignore in-process auth instructions below.

> **V1 feature-sequence amendment (2026-09-13):** The approved [seven-plan sequence](v1/00-common-requirements.md) now governs the five added features and their release rehearsal. [Plan 03](v1/03-service-catalog-and-accounting.md) supersedes this document's finance-model freeze and “no new finance ledger” instruction; the existing backend and identity architecture remain the target. [Plan 00](v1/00-common-requirements.md) reconciles shared prerequisites with current authorization work, and [Plan 06](v1/06-final-release-rehearsal.md) owns final coordinated qualification. Other RC launch requirements remain in force and are not silently deferred by this amendment.

> **Partner OAuth cancelled (2026-09-15):** WP5 parent-authorized external applications and WP6 consent/connected-app client screens are out of v1. EDAYA does not act as an OAuth authorization server. First-party email/password, email OTP, and identity JWTs remain.

Date: 8 September 2026. Updated: 10 September 2026. Status: implementation in progress; not code-complete or RC-qualified.

## Implementation progress — 10 September 2026

**Implementation is partial. The release candidate is not yet complete.** Checked items below are implemented; unchecked items are still required.

Latest local validation: **the school-scoping slice is complete and verified: full backend verification passed (298 API tests), all 52 service/HTTP integration tests passed, and 11 seed tests plus 22 native PostgreSQL tests passed.** Next: actor-specific teacher/guardian/student SQL filtering and counts. The preceding slice passed web verification (761 webapp tests) and mobile generated-contract, analysis and tests; neither client changed in this slice. See [test evidence and limitations](../audits/2026-09-09-rc-implementation-evidence.md). Changes are in the working tree, not committed or deployed.

### WP0 — Baseline and regression coverage · In progress

- [x] Record baseline revisions and audit findings; add disposable native PostgreSQL tests for tenant isolation, finance, notification delivery and OAuth concurrency.
- [ ] Finish the shared adversarial fixture and rendered-email validation.

### WP1 — Immediate security and runtime fixes · In progress

- [x] Remove the seed-header verification bypass; implement strict flags/secrets, connection ownership, database-backed session authority and zero application authorization-cache TTL.
- [x] Persist guardian access status and enforce it during guardian authorization.
- [ ] Qualify deployed school/authorization connection cache freshness.

### WP2 — Data access and mutation boundaries · In progress

- [x] Apply direct-school SQL filters, strict query validation and stable ordering; deny command-owned generic deletes and require private-file authorization.
- [x] Require explicit create/update/delete and batch policies for every entity; omit forbidden REST/GraphQL mutations and propagate policies to generated TypeScript/Dart clients. Guard deletion of inherited or used class subjects.
- [x] Implement PostgreSQL school-scoped reads/writes for all 55 managed entities, including indirect ownership, guarded upserts, transactional batches and two scoped dashboard counts; full backend/integration/seed/native checks pass.
- [ ] Complete actor-specific SQL filtering/counts, related-writer concurrency and the remaining privileged-path/command-ownership review.

### WP3 — Reliable business operations · In progress

- [x] Serialize finance updates and handle repeated payments/reversals; enqueue notifications transactionally with delivery leases and retry only failed channels.
- [ ] Complete general command idempotency, durable audit/cron occurrences, tenant-specific notification keys, migration-only notification schema and reconciliation tools.

### WP4 — First-party Bearer authentication · In progress

- [x] Implement hashed five-minute access tokens, seven-day renewal, native login proof, cookie sanitization, origin checks, quotas and logout.
- [ ] Complete production cookie-topology checks and the full authentication lifecycle test matrix.

### WP5 — Parent-authorized external applications · Cancelled / out of v1

- [x] ~~Implement the pinned OAuth provider/schema, transactional grant binding, selected children/scopes, fourteen-scope registry, live guardian checks and operator client registry tooling.~~ Removed 2026-09-15.
- [x] ~~Expose first-party connected-app listing/revocation with ownership checks and OpenAPI contracts.~~ Removed 2026-09-15.
- [x] ~~Verify PKCE, consent denial, code/refresh replay, revocation, signed minimal identity and absolute expiry against native PostgreSQL.~~ Removed 2026-09-15.
- Partner OAuth is not a v1 launch requirement. Do not remount `/auth/oauth2/*`, connected-apps, or school integration stubs.

### WP6 — Web, mobile and client migration · In progress

- [x] Implement web memory-only Bearer transport/private images and mobile secure renewal storage/Bearer transport/private images; preceding web/mobile verification passed.
- [x] Migrate the seed client to Bearer, preserve tokens across temporary account provisioning and remove automatic write retries; full seed integration passed.
- [x] Align web/mobile clients with explicit operation policies; remove invoice hard deletion, block class cleanup with enrollment history/inherited curriculum, and preserve shared curriculum records.
- [x] Consent/connected-app client screens cancelled with WP5 (2026-09-15). Remaining first-party OpenAPI security and coordinated qualification stay with WP7 / Plan 06.

### WP7 — Cleanup and maintenance readiness · In progress

- [x] Require frozen installs and exact-revision verification before deployment; disable GraphQL by default and enforce body/batch limits.
- [ ] Complete the operations guide, health/restore/retention/repair qualification and staging checks.

### Final release gates · Not yet satisfied

- [ ] Final backend/web/mobile/native/external verification passes on recorded matching revisions.
- [ ] Staging migration/restore/failure-recovery/soak evidence collected; production inputs identified.
- [ ] No unresolved P0/P1 issue affecting a launch capability; coordinated cutover and rollback are reviewable.

## Assignment

Harden the existing `edaya_backend` for release and migrate first-party business API calls to Bearer authentication. Complete the corresponding web and mobile changes. Preserve existing working school workflows and the current finance model. Borrow the newer backend's useful implementation patterns without adopting its rewrite or governance process.

Work in these repositories:

| Repository | Scope |
|---|---|
| `/Users/atoumbre/SoftiLab/maya_invest/edaya_backend` | API, domains, adapters, migrations, generated contracts, tests, deployment tooling, operations documentation |
| `/Users/atoumbre/SoftiLab/maya_invest/edaya_frontend` | Existing web authentication and API consumers |
| `/Users/atoumbre/SoftiLab/maya_invest/edaya_mobile` | Shared auth/HTTP packages and guardian/teacher apps |
| `/Users/atoumbre/SoftiLab/maya_invest/edaya_backend_new` | Read-only architectural reference; preserve its existing uncommitted work |

Read each repository's applicable `AGENTS.md` before editing. The backend's `edaya_web` references are stale: the actual frontend is `edaya_frontend`. Follow existing package boundaries: service → authorization → core; adapters and domain packages must not import application/tooling code. Before frontend implementation, read its six referenced UI specifications.

Use the [audit](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/docs/audits/2026-09-08-launch-rc-audit.md) for findings F01–F14 and the [evidence](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/docs/audits/2026-09-08-launch-rc-evidence.md) for reproductions. Audit baseline: backend `98b7a136`; comparison repository `8b3e4d7` plus existing working changes. Recheck actual HEAD and working changes before starting. Do not overwrite unrelated changes.

This handoff supersedes the audit's tentative assumption that external access could follow launch. **External access, web migration, and mobile migration are all RC requirements.**

## Settled product decisions

1. Improve the existing backend incrementally. No replacement backend, new finance ledger, general policy language, or platform-wide membership remodel.
2. Keep existing first-party password and email-OTP login experiences.
3. First-party business APIs use `Authorization: Bearer …`. The browser may retain a secure cookie for authentication/session renewal and the hosted authorization flow. Cookie-only business API access ends at the coordinated RC cutover.
4. Trusted external applications use EDaya-hosted parent login and explicit consent. They never receive the parent's password, OTP, first-party session credential, or unrestricted first-party access token.
5. External consent can cover **all data the parent is currently authorized to read**, divided into granular scopes and selected children. External access is read-only for this RC. It does not expand existing parent permissions.
6. Deliver one coordinated backend/web/mobile cutover. A short, operator-controlled rollback switch is acceptable; there is no planned month-long old-client compatibility program. Mobile users may need to sign in again.

Keep progress in the checklist above and normal PR descriptions. Do not introduce approval packets, architecture manifests, owner ledgers, duplicate trackers, or a new governance framework. Implementation work and disposable-environment tests are in scope; prepare production deployment and data-repair operations for review, without executing them on production under this planning assignment.

## Target design and fixed contracts

### One trusted request context

Resolve credentials once, then derive an immutable context containing request ID, subject ID, credential kind, active actor/profile, school ID, and the applicable authorization scope. External contexts also carry client ID and delegation grant ID. School/profile headers are selectors validated against current membership; they are never authority supplied by the caller.

The credential kinds are `firstPartyAccess`, `delegatedOAuth`, and `serviceAccount`. Preserve existing `sk_live_` service keys and their existing permissions; do not use them to impersonate guardians. Classify before invoking a credential validator. An unknown/malformed/expired supplied Bearer token produces 401; never fall back to a cookie. On business routes with a valid Bearer token and an ambient cookie, use only the Bearer identity. Cookie-only business requests return 401 after cutover.

All exposed list, count, find, aggregate, attachment, and write paths apply immutable school and relationship predicates before querying or modifying data. Keep record-level authorization as defense in depth. Special cross-school bootstrap operations must use explicitly privileged internal ports and remain unavailable through generic business transports.

### First-party access and renewal

Keep Better Auth as the authentication/session authority. Add a small EDaya-owned opaque access-token adapter rather than exposing provider sessions as business tokens:

| Contract | Required behavior |
|---|---|
| `POST /auth/edaya/access-token` | Exchange an active first-party renewal session for `{ accessToken, tokenType: "Bearer", expiresAt }`; ISO-8601 UTC expiry; `Cache-Control: no-store` |
| Access token | Cryptographically random 256-bit value with `edaya_at_` prefix; five-minute lifetime; store SHA-256 digest, provider session ID, subject ID, created/expiry times, never the plaintext token |
| Request validation | Resolve the token digest and check the linked provider session remains active using authoritative database reads; resolve current actor/school permissions independently |
| Browser renewal | API-host-only HttpOnly, Secure cookie, SameSite=Lax; exact trusted-origin checks and CSRF protection on cookie-authenticated state-changing/exchange routes |
| Native renewal | Signed provider session credential, accepted only by narrowly defined auth lifecycle/exchange endpoints; store in Keychain/Keystore through a maintained Flutter secure-storage adapter |
| Session duration | Configure an explicit seven-day absolute first-party renewal lifetime for this RC; no indefinite sliding extension; preserve password/OTP reauthentication when expired |
| Logout | Revoke the current provider session and its access credentials; clear browser/native state; offer an authenticated logout-all operation that also invalidates all first-party sessions |

Expose EDaya facade endpoints `POST /auth/edaya/native/sign-in/email`, `POST /auth/edaya/native/sign-in/email-otp`, `POST /auth/edaya/sign-out`, and `POST /auth/edaya/sign-out-all`. Native sign-in returns `{ renewalCredential, renewalExpiresAt, user }` after provider credential verification; reuse existing provider validation and rate limits. Renewal is supplied as Bearer only to the exchange/lifecycle boundary. Sign-out accepts a first-party access token or its own renewal session under that boundary's admission/CSRF rules; sign-out-all requires recent password/OTP authentication. Keep existing browser login endpoint paths through the sanitized facade where compatible, and document any necessary client-path changes.

The web applications are static SPAs. Implement exchange/session protection on the backend; do not assume a Svelte server or introduce a BFF deployment. Deploy API and first-party browser origins on the same site for the SameSite=Lax design. Fail configuration checks with an actionable message if production topology does not support this; do not silently loosen cookies to fix cross-site deployment.

Use the provider's signed Bearer-session support only at the native auth boundary, with signature verification required. Audit both response bodies and headers: browser sign-in and session responses must not expose the raw renewal token or `set-auth-token`. Native credential issuance must follow successful password/OTP proof on an explicit native login flow. A cookie-authenticated caller adding a `native` flag must not obtain a readable long-lived credential. These are EDaya-specific boundary requirements; the [Better Auth Bearer plugin](https://better-auth.com/docs/plugins/bearer) supplies the signed session transport, not this complete access-token design.

Use a browser-safe auth facade where necessary, preserving the existing login UI. Document the exact allowed provider endpoints instead of forwarding every new plugin/admin endpoint indiscriminately. Disable auth KV/secondary-cache authority for the RC; request-local memoization is fine. Access revocation must not depend on a Worker isolate's cache expiring. Purge expired access-token records in bounded scheduled batches.

### Parent delegation and external identity

Use the maintained Better Auth OAuth provider, with a focused, exactly pinned compatible upgrade. The audit found Better Auth 1.6.25 installed; the package metadata inspected during planning identified OAuth provider 1.7.3 with Better Auth `^1.7.3` as a peer. Start with aligned 1.7.3 packages, inspect their installed API/migrations and current advisories, and select a newer compatible patch only when needed with recorded rationale. Do not broadly upgrade the monorepo.

The provider supplies authorization-code flow, S256 PKCE, discovery, token/revocation endpoints, OIDC when `openid` is requested, and signing-key integration. Wire the actual discovery routes through the existing router. Disable the JWT plugin's independent generic `/token` endpoint and unused registration/grant surfaces. Confirm these behaviors against the pinned implementation, using the [official provider documentation](https://better-auth.com/docs/plugins/oauth-provider).

Apply exact redirect URI matching, issuer/audience validation, short-lived access tokens, rotating refresh tokens with reuse detection, and no implicit or password grant for partners. Require PKCE for all external authorization-code clients. Public clients have no embedded secret; confidential clients authenticate at token exchange. These choices follow [OAuth security best current practice, RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700).

EDaya's additional delegation contract is:

- Operator-managed client registry only, with exact redirect URIs, allowed scopes, client type, status, and optional confidential-client credentials. No marketplace, self-service registration, or consent bypass. Add CLI commands to register, disable, and rotate credentials without logging secrets.
- Access lifetime five minutes; rotating refresh family absolute lifetime thirty days. Consent cannot outlive its refresh family; renewal after expiry requires consent again. Refresh replay revokes the family atomically. Use provider lifecycle hooks/storage integration; do not implement a second OAuth protocol stack.
- Persist an EDaya delegation grant bound to subject, guardian actor, exactly one school, registered client, selected children, scopes, creation/expiry/revocation, and provider authorization/refresh-family association. Link it to the authorization transaction and code server-side. A client-supplied grant ID is never proof of consent.
- Every external request and refresh checks current grant/client status and guardian relationships from authoritative storage. Never trust an access token's old relationship snapshot. Revocation applies to requests beginning after revocation commits; already transferred data cannot be recalled.
- Allow external tokens only on `/integrations/v1/*` and the provider's appropriate identity/lifecycle endpoints. Reject them on `/core/*`, GraphQL, internal auth exchange, admin routes, and business mutations, even if the same subject has staff permissions.
- Support `openid` with minimum identity claims so the study app can identify the signed-in EDaya account without maintaining passwords. Keep student data out of ID tokens. An external app may keep its own local login session keyed by issuer and subject; it does not become a new password authority.
- Ordinary first-party logout leaves explicitly granted partner access intact. Connected-app revoke stops that grant; account disable/security logout-all revokes all sessions and delegations. Clearly distinguish these actions in the UI.

Before building the full consent UI, prove provider hook support with one real code-exchange/refresh/revoke integration slice. In particular, demonstrate atomic grant-to-code association and refresh-family reuse handling. If a provider limitation prevents the required security properties, record the exact limitation and finish independent work; do not weaken consent or substitute shared parent tokens.

### External scope and route registry

Implement a fixed registry that maps every current guardian read capability to explicit read DTOs and domain queries. The capability enum is in `package/domain-authorization/src/capabilities/guardian-capability.ts`. Generate API documentation and completeness tests from this registry. These are the initial routes relative to `/integrations/v1`; collections use stable pagination with the same scoped count behavior as first-party reads.

| Scope | Existing guardian capability | Route family / permitted projection |
|---|---|---|
| `guardian.profile:read` | `ReadSelfProfile` | `GET /me` — own guardian profile |
| `students.profile:read` | `ReadStudentDetail` | `GET /students`, `/students/:studentId` — selected, currently linked children |
| `grades:read` | `ReadGrades` | `GET /students/:studentId/grades` — parent-readable results only |
| `report-cards:read` | `ReadReportCard` | `GET /students/:studentId/report-cards` and authorized item reads |
| `attendance:read` | `ReadAttendance` | `GET /students/:studentId/attendance` |
| `payments:read` | `ReadPayments` | `GET /students/:studentId/fees`, `/students/:studentId/payments` — parent-readable balances, payment history and receipt metadata |
| `enrollments:read` | `ReadEnrollmentHistory` | `GET /students/:studentId/enrollments` |
| `logbook:read` | `ReadLogbook` | `GET /students/:studentId/logbook` |
| `timetable:read` | `ReadTimetable` | `GET /students/:studentId/timetable` |
| `calendar:read` | `ReadCalendar` | `GET /students/:studentId/calendar` |
| `communications:read` | `ReadCommunications` | `GET /students/:studentId/communications` — messages visible to this parent, with restricted recipient metadata |
| `curriculum:read` | `ReadCurriculum` | `GET /students/:studentId/curriculum` |
| `school-context:read` | `ReadWorkspaceShell` | `GET /school-context` — minimum authorized school/academic context |
| `attachments:read` | `ReadAttachments` | `GET /attachments/:attachmentId` — metadata/content only if underlying resource scope also permits it |

Item paths must retain the same parent/child/domain checks as collections. Scope checks and field projections are mandatory; do not return arbitrary repository entity JSON.

The grant's selected children intersect current guardian links on every request. A parent cannot delegate a newly linked child without fresh consent. If one selected link disappears, deny that child's data immediately while retaining other valid selected children. If none remain, reject resource access and refresh pending new consent. Removing a scope requires a new narrowed grant or revocation, never broadening an existing grant in place.

Health, discipline, unpublished grades, private staff notes, and other parents' details are not automatically included. For example, the audited health operation is staff-only. Apply the corrected parent policy and an explicit field allowlist; where an existing portal response overexposes data, fix that policy rather than reproducing the overexposure. Shared-class communications and attachments require particular attention to other children's data.

### Persistence boundaries

Keep provider migrations and EDaya access/delegation tables in the authoritative auth database so code/grant/family association can commit atomically. Suggested EDaya tables are `auth.edaya_access_tokens` (unique token digest, session/subject references, expiry index), `auth.edaya_delegation_grants`, and normalized grant-child/scope relations. Use provider-owned tables for OAuth clients, keys and protocol tokens instead of duplicate registries. School/guardian/child references must be revalidated against the school database; do not invent cross-database foreign keys or distributed transactions. Grant activation must follow authoritative scope validation and resource access must recheck it.

Put command idempotency, business audit and outbox records in the same database/transaction as school mutations. Require unique `(school_id, command_type, idempotency_key)` and unique schedule-occurrence keys. Job records include status, attempts, next-attempt time, lease owner/expiry and last error classification. Use migration-managed tables; replace notification runtime table creation with schema migrations. Keep persisted payloads versioned and validate them when consuming older jobs during deployment.

## Ordered work packages

Implement in the order below, with small reviewable commits. Each package must include its regression tests and documentation changes. The dependency order is WP0 → WP1 → WP2 → WP3/WP4 → WP5 → WP6 → WP7; WP3 and WP4 are independent after WP2, but no parallel agents are required. Do not defer launch blockers to a cleanup tail.

### WP0 — Establish a reproducible baseline

**Change:** inspect current diffs and repository instructions; inventory public REST/GraphQL/manual routes, provider routes, web/mobile consumers, and generated-client workflows. Record the starting revisions in this document. Reproduce the audit's five probes using disposable data, then convert them into tests asserting corrected behavior as their fixes land.

Baseline evidence was 2,057 passing existing unit tests, two failing Novu template parity tests, and 44 passing integration tests. Native PostgreSQL concurrency and deployed Worker behavior were not verified. Do not label the baseline green or count the temporary defect-observation probes as safety tests.

Resolve the two template failures by confirming HTML rendering/escaping expectations and testing rendered output, not by blindly updating snapshots. Add a small native PostgreSQL integration harness with migrations and isolated test schemas/databases. Keep PGlite for fast tests. Create one shared two-school fixture with staff, teacher, two parents, linked/unlinked children, files, and finance records.

**Exit:** reproducible test commands, no unrelated baseline changes, real PostgreSQL harness available, and known failures either fixed or explicitly tied to the work package that fixes them.

### WP1 — Close immediate auth, configuration, and resource defects

**Primary files:** `apps/api/src/runtime/shared/adapters/better-auth.ts`, `seed-auth-provision.ts`, `auth-database.ts`, `env/schema.ts`, `apps/api/src/lib/authorization/auth-cache-invalidation-port.ts`, and the auth secondary-storage adapter.

1. Remove verification authority from `x-edaya-seed-provision` on public requests. Move verified fixture creation to an explicit local/test-only or authenticated internal provisioner. Reject production seed shortcuts regardless of header/body flags.
2. Require an explicit non-placeholder production `BETTER_AUTH_SECRET` of sufficient entropy/length. Replace inconsistent boolean coercion, especially `ALLOW_PUBLIC_SCHOOL_REGISTRATION`, with the shared strict parser. Test `"false"`, `"0"`, `"true"`, omitted, and invalid values.
3. Fix database ownership: owned auth pools dispose exactly once; borrowed pools are not closed by borrowers. Cover success, construction failure, request failure, and shutdown.
4. Correct guardian/student scope invalidation and both sides of relationship changes. Disable cross-request grants/relationship caches for the RC; allow configuration to express disabled caching. Preserve request-local memoization. Ensure permission checks, account activation, session validity, and delegation checks bypass database/query caches, including the deployed connection path.
5. Move required invalidation/notification intent after commit or into transaction-bound durable records as appropriate; never emit authority-changing events from a transaction that later rolls back.

**Exit tests:** production verification bypass rejected; real email/OTP/invitation paths work; string `false` disables registration; default production secret fails startup; owner/borrow disposal correct; revocation in runtime A denies the next request in independent runtime B; rollback leaves no false successful change event.

### WP2 — Enforce school/resource scope and command ownership

**Primary files:** `managed-entity-service.ts`, `entity-config/tenant.ts`, Postgres store/filter builder, school API registry/dispatch, GraphQL exposure, attachment routes, and manual routes using raw repositories.

1. Introduce a scoped repository/query boundary receiving trusted context separately from caller filters. Compose constraints with AND so nested OR, `$in`, or an empty filter cannot escape them. Validate unsupported fields/operators instead of silently ignoring them.
2. Apply SQL-level scope consistently to list, count, findOne, existence, aggregates, batch operations, update, and delete. Include indirect school relationships. Use deterministic ordering with an ID tie-breaker. Never implement non-elevated count by loading the entire collection.
3. Cover all exposed entities, not only the first student slice. Inspect raw repository calls in HTTP routes and jobs. Narrow intentionally privileged ports and keep them off generic transports.
4. Replace `allowDirectSave` as the sole exposure control with explicit public operation flags for create/update/delete/batch variants. Payments, fees, enrollment, results, invitations, and other command-owned transitions must reject generic mutation routes in REST and GraphQL. Retain legitimate named commands.
5. Make student, guardian, and staff images private by default. Keep an explicit allowlist for genuinely public assets such as school branding. Authorize attachment content against its owner/domain; knowing an attachment ID is insufficient. Migrate web/mobile images and downloads to authenticated fetch/blob or bounded signed downloads. External reads use the authenticated content endpoint, not durable public links.

**Exit tests:** empty/mixed-school/nested filters cannot escape scope; list/count agree across pages; scoped findOne cannot select a foreign row first; staff elevation is school-local; teacher/parent/student scope is correct; generic payment deletion and batch deletion are blocked; linked parent can fetch a permitted photo and unlinked/cross-school users cannot. Verify real HTTP paths as well as service tests.

### WP3 — Make money changes and delivery durable

**Primary files:** finance workflows, transaction adapter, notification store/operations/send-job, notification gateway composition, cron dispatch, background document jobs, school database composition.

1. Add command idempotency keyed by school, command type, and idempotency key. Store a normalized request digest and original result atomically with the effect. Same key/payload returns the original result; changed payload returns 409. Bind replay to the current authorized actor/resource rather than disclosing stored results blindly. Require stable keys on financial commands and retryable external-effect commands.
2. Make payment creation insert-only, serialize the affected fee updates with row locks or equivalent atomic SQL, and use consistent lock order. Preserve money representation and existing business rules. Add duplicate-payment protection even if a caller changes the idempotency key. Make reversal/cancellation equally atomic and replay-safe; no silent generic deletes.
3. Produce a read-only reconciliation command for fee totals versus valid payment/reversal records. Report anomalies and proposed repairs; do not auto-correct historical finance data. Add constraints/indexes only after a preflight integrity report; preserve existing migration history.
4. Commit business state, required audit records, and an outbox record in the same database transaction. Remove provider/network delivery from transactional hooks. Ensure all participating SQL uses the actual transaction client, including notification persistence. With the configured pool size of one, no transaction may wait on a second borrowed connection.
5. Queue messages carry only a validated durable `{ jobId }`. Load school, actor authority, payload, schedule and status from the durable record. Use atomic claim/lease, bounded attempts/backoff, lease expiry recovery, and dead-letter handling. Duplicate delivery must be harmless; terminal jobs acknowledge without repeating effects.
6. Persist per-recipient/per-channel delivery status. A partial success does not mark the whole job successful. Retry only incomplete deliveries. Make recipient/device keys school-aware. Pass stable idempotency identifiers to providers that support them; document residual duplicate risk for providers without idempotent delivery after an uncertain network result.
7. Make cron occurrence creation unique by schedule and occurrence time; advance the schedule with durable intent atomically. Recover undispatched outbox records. Persist document generation and other required work currently relying only on `waitUntil`. Missing required queue/provider bindings must fail configuration rather than run silently inline.
8. Introduce explicit notification-provider configuration, defaulting to the in-process implementation for the RC. `LOG_LEVEL=silent` must not disable delivery, and a stray Novu secret must not switch providers. Retain a tested explicit Novu option if still needed; do not delete it solely because the default changes.

**Exit tests on native PostgreSQL:** repeated and concurrent identical payment creates affect totals once; distinct concurrent payments both survive; changed-payload replay returns 409; reversal races preserve totals; transaction failure rolls back money/audit/outbox together; pool-size-one notification path completes without deadlock; worker crash/retry/lease expiry and scheduler replay recover; one failed channel retries while successful channels stay complete. Do not claim exactly-once network delivery.

### WP4 — Implement the first-party Bearer boundary

**Primary files:** Better Auth composition/schema/migrations, `session-actor.ts`, service-key parser, `app-router.ts`, `create-app.ts`, OpenAPI generation and API client transport.

Implement the first-party contracts above and the focused auth upgrade. Keep all provider objects, raw session credentials, and token persistence inside the auth adapter/composition. Share a provider-independent authenticated-subject type with domain code.

Add explicit endpoint admission rules for browser login/renewal, native login/renewal, first-party business tokens, and service accounts. The existing implementation treats every Bearer token as a service key and rejects a session combined with Bearer; replace that behavior deliberately. Limit the service parser to the established key format.

Return consistent 401/403 errors and a `WWW-Authenticate` Bearer challenge on protected-resource authentication failures. Never put credentials in URLs or logs. Configure exact CORS allowlists per surface, including preflight, required school/profile/idempotency headers, and safe exposed response headers. Keep browser root-token headers unexposed and absent from browser responses, not merely hidden by CORS. Test auth and CORS middleware ordering.

**Exit tests:** cookie-only business access denied in cutover mode; first-party and service tokens resolve correctly; malformed/expired/revoked Bearer never falls back; ambient cookie cannot alter bearer identity; signed native renewal credential cannot call business routes; raw unsigned provider token rejected; browser JS cannot retrieve renewal material from login/get-session/native switches; logout invalidates outstanding access; cross-origin exchange/CSRF rejected; OTP/invitations/account selection still work.

### WP5 — Deliver the full external parent-consent slice

**Cancelled / out of v1 (2026-09-15).** Do not implement this slice. The following historical instructions are retained for context only.

**Backend:** implement the OAuth/registry/grant contracts and all fourteen scope mappings above. Add `GET /auth/edaya/connected-apps` and `POST /auth/edaya/connected-apps/:grantId/revoke` for first-party authenticated users, with ownership checks and immediate durable revocation. Business access tokens authorize these EDaya management endpoints; external tokens do not. Use provider endpoints for protocol authorization/consent, augmented server-side with EDaya's selected-school/child grant binding.

**Web:** add standalone `/authorize` and `/connected-apps` pages in an auth-only layout outside the existing staff-workspace guard. Guardians can log in there without gaining access to staff routes. Preserve existing staff login behavior. Update the relevant frontend specification narrowly to describe this authorized new surface; reuse its shared components/design tokens.

The consent page shows verified client name, purpose, requested data categories, selected school, explicitly selected children, expiry, and allow/deny. Do not preselect all scopes or children. Allow only the intersection of requested scopes, registered client scopes, and current parent permissions. Recheck at submission to prevent stale consent. Connected apps shows active grants and a revoke action; the guardian mobile app exposes the same management capability or an authenticated route to it.

**Partner example:** provide a local runnable example using synthetic data that redirects to EDaya login/consent, receives a code, exchanges it with PKCE, reads consented student data, refreshes, and handles revocation. Document integration setup, scope meanings, errors, pagination, rate limits, and secure credential handling. Real partner URLs/client type are deployment inputs; do not invent production credentials or deploy an external application.

**Exit tests:** happy-path real provider flow; denial; wrong redirect/issuer/audience; missing/wrong PKCE; code replay; refresh replay revokes family; expired/disabled client; forged grant ID; guardian acting as staff cannot broaden the grant; unselected child; removed relationship; cross-school IDs; consent to one scope cannot read another; unpublished/private fields excluded; attachment requires both file and owner scope; external token cannot mutate or reach core/GraphQL; account disable and explicit revoke deny next requests across runtime instances. Exercise every scope with both allowed and denied data.

### WP6 — Migrate all first-party consumers and generated contracts

**Web:** start at `apps/webapp/src/lib/auth/client.ts` and shared HTTP/query/download wrappers. Store access tokens only in memory. Use credentials only for permitted auth/renewal calls and omit cookies for business API fetches. Centralize renewal with one in-flight exchange per client instance. Retry an authenticated request at most once after renewal; automatically replay reads and writes with a stable idempotency key only. Do not blindly retry arbitrary mutations after uncertain responses.

Keep current login forms and session/role/school selection behavior. Clear memory/query state on logout or subject/school change. Fetch protected images as authorized blobs with URL cleanup. Inspect `apps/webadmin`: the audit found a starter shell, not a finished admin product. Make any actual consumers use the shared boundary, but do not invent platform-admin features or permissions. The public website needs no authentication migration unless it has an actual protected consumer.

**Mobile:** update `packages/edaya_auth`, shared session storage/controller and all guardian/teacher API consumers. Remove renewal cookies from SharedPreferences, delete legacy credential keys on upgrade, and require a new login rather than importing weakly stored credentials. Keep signed renewal material in secure platform storage and access tokens in memory. Preserve push registration/logout behavior, school/profile headers, attachments, and role-specific navigation. Serialize exchange/refresh per session and ensure stale requests cannot repopulate a logged-out session.

**Contracts:** add OpenAPI security schemes and explicit security requirements per operation; document intentional public routes. Distinguish OAuth scopes and service/first-party admission in endpoint descriptions. Regenerate the TypeScript and Dart clients through the repositories' existing generators. Do not edit generated output manually. Remove stale cookie-only examples and require zero generation drift.

**Exit:** web password/OTP login, reload renewal, concurrent expired requests, logout, school switch, images/downloads and staff workflows pass; guardian and teacher apps pass login/restart/renewal/logout and core portal smoke tests; no first-party business request depends on cookies; no persisted browser access token or SharedPreferences renewal credential remains; generated clients can call the integration API using documented Bearer transport.

### WP7 — Finish RC cleanup, deployment checks, and maintenance

1. Remove unreachable duplicate implementations, unused dependencies/exports and obsolete experiments only after checking imports, package exports, dynamic registry references, scripts, and consumers. Preserve migrations and legitimate tests. Avoid mass renames/formatting or deleting functioning compatibility/provider code without evidence. Fix stale repository links and make the README's supported interfaces match reality.
2. Disable GraphQL by default in deployed environments for the RC because audited first-party production consumers use REST. Retain explicit local/test opt-in. If a real launch consumer is found, keep it only after equivalent auth, operation exposure, scope, depth/complexity and cost tests; do not leave an unbounded alternate interface.
3. Use one request ID from ingress through logs, audit and jobs. Add central redaction of Authorization, Cookie, passwords, OTPs, tokens, secrets, and sensitive payloads. Replace full notification-input logging with IDs and status. Durable audit events cover delegated consent/revocation, service/client changes, sensitive mutations and financial corrections without copying student payloads into logs.
4. Add bounded body/batch/page sizes and distributed enforcement for auth/partner abuse protection. Initial integration defaults: page size 50, maximum 100; ordinary JSON body maximum 1 MiB; business batch maximum 100; partner reads 120 requests/minute per client-and-grant plus a client-wide ceiling of 1,000/minute. Preserve existing stricter domain limits and separate validated upload limits. Return 429 with Retry-After. Treat these as initial configuration defaults, then validate with the staging workload. Never rely on per-isolate maps for a global quota.
5. Make production/staging migration targets explicit and fail closed when missing. Remove fallback to generic `DATABASE_URL` for an explicitly selected remote environment. Replace hostname-only destructive-reset protection with explicit environment/target identity and an intentional destructive operation flow. Default all test/repair scripts to disposable targets. Add migrations for auth, grants, idempotency/outbox/delivery and necessary constraints; never rewrite applied migrations.
6. Add preflight integrity/index checks and explain/latency checks for tenant/guardian queries. Detect existing duplicates/orphans before constraints; report repair steps separately. Bound backfills and cleanup batches. Review direct versus pooled/query-cached connections for fresh authorization reads and migrations.
7. Gate migrations and deployment on verification of the exact backend revision being deployed. Use frozen lockfile installs and a native PostgreSQL CI job. Record the matching frontend revision and mobile build version in the release checklist. Configure staging/production environments and available protection controls; do not claim repository-host protection is configured merely because workflow YAML references it.
8. Provide readiness/liveness checks without sensitive output, bounded external-service timeouts, and signals for API failures/latency, auth failure spikes, database saturation, outbox age, queue retry/dead-letter volume, provider delivery failures and finance reconciliation anomalies. Define alert thresholds from staging observations and include who receives each alert as a deployment input.
9. Write one concise operations guide: deploy/migrate/rollback; client and signing-key rotation; revoke compromised sessions/grants; pause partner access; retry/replay dead letters; reconcile payments; backup/restore; inspect audit events; patch dependencies. Explain which retries can cause uncertain provider duplicates. Keep logs/retention configurable and avoid inventing a legal retention policy.

**Exit:** clean verification, reproducible migrations, no unintended public interface, no secret-bearing logs, same-revision deploy checks, disposable restore drill and payment reconciliation, and a concrete staging/production runbook. Report actual infrastructure settings still requiring operator configuration; a document is not proof of a deployed control.

## Verification and cutover

Run package-focused checks while implementing. At the end, run the repository-required complete checks once on the final source, repeating only after relevant changes or failures:

| Repository / environment | Required check |
|---|---|
| Backend | `bun run verify`, `bun run test:integration`, and `bun run test:integration:seed` for the changed seed/auth paths |
| Backend native database | Add a documented CI script for PostgreSQL tenant, idempotency, transaction, outbox and concurrency tests; run it on an isolated migrated database |
| Frontend | `bun run verify` and automated browser tests for login, consent, Bearer renewal, private files and key school workflows |
| Mobile | `melos run verify`, `melos run test:integration` against the disposable API; guardian and teacher device/emulator smoke checks |
| External example | Automated full authorization → code exchange → each consented data category → refresh → revoke flow against the real local/test provider |
| Staging | Migrations, Worker/queue configuration, same-site browser auth, synthetic finance/concurrency, provider sandbox delivery, queue failure recovery, restore/reconciliation and load smoke |

Use synthetic users and sandbox providers. Do not send real notifications or read production student data to make tests pass. Record exact commands and outcomes; distinguish skipped, blocked, failed and passed checks.

Cutover sequence:

1. Take and verify a restorable backup, including required file references; run migration/integrity preflight. Rehearse on staging first.
2. Apply additive migrations, deploy Central Identity, and then deploy the school backend with Bearer support. Invalid supplied Bearer credentials never fall back. Keep all security and finance fixes active.
3. Deploy the matching web build and distribute the matching guardian/teacher mobile builds. Confirm real supported mobile builds are available before enforcing cutover; app-store availability is an external release dependency. Clear old mobile credential storage and guide reauthentication.
4. Verify cookie-only denial, first-party access, each partner scope, revoke, payment replay and private files. Register real partner clients only with their verified deployment inputs.
5. Observe a minimum 24-hour staging soak with exercised scheduled jobs and no unresolved launch-blocking failures before RC qualification. In production, follow the reviewed release/monitoring procedure. Prepare an urgent hotfix path for security issues independently of this soak.
6. Roll back application behavior only to a compatible hardened build; additive schemas remain. Disable partner access separately if its integration fails. Do not run destructive down migrations or restore a backup blindly over new financial writes.

Migration rollback and database disaster recovery are different operations. A restore drill must check attachment references, finance totals, authentication state and queued/delivered work. Prevent restored outbox records from blindly replaying previously delivered external effects; reconcile delivery state before resuming workers. Rotate/revoke recovered credentials when restoring an old auth snapshot could resurrect access.

At handoff, report changed repositories/revisions, migrations, public API changes, exact test results, remaining deployment inputs and any blocked checks. **Code-complete is not RC-qualified until the staging and client-availability checks pass.** If credentials, store distribution or infrastructure prevent a check, finish independent implementation and state the specific missing input; do not label it passed or silently remove external access from RC scope.

## Pasteable instruction to the coding agent

Implement `/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/docs/sprints/backend-release-candidate-plan.md` across the existing backend, frontend and mobile repositories. Read the linked audit/evidence and applicable repository instructions, preserve unrelated changes, and follow WP0–WP7 in dependency order. The settled choices and security invariants are part of the task: external parent-authorized read access is included in the RC, existing first-party login screens remain, browser cookies are limited to permitted authentication/renewal flows, and business APIs switch to Bearer through a coordinated client cutover. Deliver code, migrations, generated clients, behavioral tests and the operations guide. Maintain this single checklist, verify against disposable infrastructure, and prepare a concrete deploy/rollback handoff. Do not rewrite `edaya_backend_new`, weaken authorization to bypass a blocker, introduce governance ceremony, or execute production deployment/data repairs without separate authorization.

# Edaya backend: launch audit and release-candidate plan

Date: 8 September 2026. Audited baseline: `edaya_backend` commit `98b7a136`. Design comparison: `edaya_backend_new` commit `8b3e4d7` plus its visible working tree. The current backend was clean at the start; the newer repository already had substantial enrollment work in progress. No application changes, migrations, deployments, or production-data operations were performed.

Follow-up: the [coding-agent implementation handoff](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/docs/sprints/backend-release-candidate-plan.md) records the subsequent product decisions and supersedes the tentative scope assumptions below. External access, web, and mobile are included in the RC; this audit remains the findings/evidence baseline.

**Recommendation: release an incrementally hardened `edaya_backend`. Keep its working business features, adopt selected correctness patterns from the newer backend, introduce Bearer authentication behind one authentication boundary, and deliver external parent-authorized access as a separately gated OAuth capability. Do not attempt the replacement backend or its finance-model migration before launch.**

The existing backend is a viable base, but I would not designate this snapshot an RC. The audit reproduced defects involving email verification, tenant counts, parent-scope invalidation, payment replay, and connection disposal. Passing current tests does not cover these failure modes.

The launch date, engineering capacity, production topology, traffic expectations, and whether external integration is a launch requirement were not supplied. The sequence below remains usable without those answers. Planning assumption: core school launch takes priority; external access may follow. If an external app is required at launch, its complete consent/revocation slice joins the launch gate.

## Evidence and limits

The audit inventoried the repository and traced representative paths through HTTP, authentication, authorization, entity services, workflows, persistence, notifications, background jobs, client integration, and deployment tooling. It is a source audit with local behavioral checks, not a production penetration test or a line-by-line review of every file. [Reproduction source and test results](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/docs/audits/2026-09-08-launch-rc-evidence.md).

| Baseline measure | Observation |
|---|---|
| Tracked files / test files | 2,714 / 401 before audit artifacts |
| API source | 124 TypeScript files, approximately 11,937 lines |
| Domain / authorization / service source | Approximately 6,997 / 6,830 / 22,361 lines |
| Postgres adapter source | Approximately 3,813 lines |
| Generated REST contract | 585 paths, 587 operations; no declared security scheme or global security requirement |
| Locally resolved packages | Better Auth 1.6.25, Hono 4.12.32, Drizzle 0.39.3, Wrangler 4.116.0 |
| Standard verification | Failed: two Novu HTML-template parity tests; earlier quality/build stages passed using existing Turbo cache |
| Fresh unit/check run | 2,057 existing tests passed and 2 failed across the completed runs; includes the separately rerun local-files package, excludes temporary audit probes |
| Integration command | 44 passed, 0 failed: 13 API/runtime/adapter and 31 auth/HTTP tests |
| Targeted audit probes | Five observations reproduced; see evidence file |

The uncached all-package attempt initially could not bind the local-files test server inside the sandbox. Its isolated rerun with loopback networking permitted passed all 11 tests. The remaining packages were then run uncached to completion. The persistent failures were `tooling/novu-ops/bootstrap/tests/defaults-parity.test.ts` and the bootstrap catalog test: the template contains `{{payload.emailBody}}`, while tests expect the raw HTML placeholder.

The full unit run included the first three temporary audit probes, so its raw total is higher than the existing-test total above. These probes assert observed defects, not correct behavior; they were removed from the normal test tree after inspection.

Native PostgreSQL concurrency, deployed Worker behavior, actual Hyperdrive caching settings, production secrets/roles, backup retention, restore success, provider delivery, branch protection, and runtime traffic were not verified. The newer backend's tracker claims were inspected, not independently recertified. No dependency-advisory clearance is implied by passing builds or tests.

## What to preserve and borrow

The current backend already has meaningful separation: `core → authorization → service` responsibilities, adapters, an actor-bound school service, explicit business commands, shared REST/GraphQL dispatch, generated TypeScript clients, runtime boundaries, and useful rollback/authorization tests. A large structural rewrite would put established school workflows at risk.

The newer backend is materially further along than its stale AGENTS documentation suggests: the tracker describes completed foundations and reference slices through Phase 9, enrollment in progress, and scheduling, attendance, broader business families, and production readiness still outstanding. Its architecture still specifies Better Auth server sessions; it is not a completed Bearer/OAuth migration to copy.

| New-backend idea | Apply to the existing backend | Keep outside this launch |
|---|---|---|
| Trusted request context | Resolve subject, selected school/profile, origin, and request identity once; bind repositories and authorization to that context | Full principal/membership database remodel |
| Scope before pagination/count | Shared tenant and relationship predicates in persistence for public reads | General-purpose policy DSL rewrite |
| Command-owned transitions | Explicit public read/write/delete exposure; close alternative mutation paths | Rewriting every entity and workflow |
| Transaction-bound dependencies | Use the same transaction for business state, required audit, and durable delivery intent | Replacing every repository interface at once |
| Durable jobs/outbox | Persist intent before enqueue; workers consume durable record IDs; recover failed work | Separate API/jobs/docs deployments merely for organization |
| Stable provider boundary | Keep Better Auth/session/token objects inside auth composition | New adapter package taxonomy and vendor lifecycle framework |
| Behavioral tests | Two-school, relationship revocation, retry, rollback, and concurrency cases | Contract packets, owner ledgers, phase gates, and evidence bureaucracy |
| Native database tests | Add a small PostgreSQL suite for real transaction behavior | Replacing the fast PGlite loop |

A normal PR should say what behavior changed, compatibility/migration impact, tests, and rollback. One RC checklist and a short operations guide are sufficient process for this effort.

## Findings requiring action

Priority meanings: **P0** is an immediate security fix; **P1** blocks an RC for affected launch capabilities; **P2** is bounded cleanup or subsequent hardening. Evidence is distinguished from production impact that still needs validation.

### F01 — P0: public sign-up can bypass email verification

In [Better Auth configuration](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/runtime/shared/adapters/better-auth.ts:114), the user-create hook trusts `x-edaya-seed-provision` and sets `emailVerified: true`. The helper checks only the header value. The public `/auth/*` handler forwards incoming headers. The separate local seed endpoint's production guard does not protect this hook.

**Reproduced:** an in-process sign-up through the real Better Auth handler, using `NODE_ENV=production` and `REQUIRE_EMAIL_VERIFICATION=true`, returned a verified user when given that header. No email ownership proof occurred. This demonstrates the bypass locally; it does not demonstrate takeover of an existing account or a deployed exploit.

**Action:** remove seed authority from untrusted request headers. Provision verified fixtures through an explicit local/test-only or authenticated administrative operation. Guard every seed shortcut by deployment configuration, and add production-mode HTTP negative tests. Review invitation/email-based account linkage for implications of falsely verified new accounts.

### F02 — P1: elevated counts can disclose other schools' data

[ManagedEntityService.count](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/services/entities/managed-entity-service.ts:118) lets elevated staff call the raw repository count. Its filter check rejects an explicitly different school but does not impose the actor's school. [The filter helper](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/services/entities/entity-config/tenant.ts:54) also considers only the first `$in` value. [PostgresStore.count](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/adaptor-postgres/src/postgres-store.ts:96) counts whatever matches the supplied filter.

**Reproduced:** the real PostgresStore over a disposable PGlite table containing one row in each of two schools returned 2 for an elevated school-A service with `{}` or `$in: [schoolA, schoolB]`; explicit school A returned 1. This probe used the real managed-service and persistence implementations with a minimal authorization stub; the HTTP dispatcher passes count filters through to that service.

**Action:** inject immutable tenant constraints independently of caller filters. Include indirect entities whose school is reached through relationships. Test empty filters, logical operators, mixed-school `$in`, counts, existence checks, and aggregates. An elevated school actor must remain school-scoped.

### F03 — P1: collection authorization occurs after database pagination

[ManagedEntityService.list/findOne](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/services/entities/managed-entity-service.ts:99) reads rows before checking each row's tenant and access. Postgres applies limits/offsets first. Ordinary unauthorized collections are generally rejected rather than returned; this is not evidence that all entity lists leak data. It does mean broad valid requests can fail because an unrelated row happens to be in the selected page. Non-elevated counts load and authorize the entire matching collection.

**Action:** enforce school and allowed-resource predicates in SQL before ordering, pagination, and aggregation. Reuse the exact scope between list/count. Start with students, guardian links, enrollments, assessments/results, attendance, attachments, and exposed aggregate queries. Require stable ordering. Keep explicit record checks as additional defenses.

### F04 — P1: guardian/student revocation invalidates the wrong cache

[Cache invalidation](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/lib/authorization/auth-cache-invalidation-port.ts:14) sends guardian/student scope events to the effective-grants cache. [Session composition](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/http/dependencies/session-actor.ts:208) reads their relationship scope from the separate actor-scope cache. Teacher invalidation uses the latter correctly.

**Reproduced:** a populated guardian actor-scope entry survives a guardian-scope invalidation event. Existing tests validate invalidation of guardian grants rather than the cache actually used for portal access.

Both caches are process-local maps with a five-minute default TTL. Fixing the target alone does not propagate revocation across Worker isolates. Staff activation checks can also be avoided on a grants-cache hit. Cache invalidation currently runs in write hooks before commit, which leaves a stale-repopulation race.

**Action:** immediately fix guardian/student cache targets and affected old/new relationships. For the RC, prefer disabling cross-request permission/relationship caching until authoritative revision checks exist. Keep request-local memoization. Read security state over a cache-disabled database path and test revocation from another runtime instance. Later add commit-bound revisions and bounded caches only if measurements justify them.

### F05 — P1: payment retries can corrupt the paid balance

[recordPayment](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/services/workflows/finance.ts:110) saves a payment using the generic upsert and adds its amount to the current paid balance. An existing recorded payment can pass the save gates. There is no duplicate-command result or matching-payload replay check on this path.

**Reproduced using the existing finance workflow harness:** resubmitting the existing 400-unit `pay1` changed the fee's paid amount from 400 to 800. The harness uses test repositories, so native concurrency remains a separate required check. The Postgres implementation's upsert matches the replay concern.

**Action:** use atomic create/replay semantics: same key and same normalized payload returns the original result; same key with changed payload returns a conflict. Serialize or conditionally update the affected fee balance. Test concurrent different payments, same-payment replay, reversal races, and rollback on failure. Add reconciliation of fee paid totals against recorded payments. Preserve the existing finance model for launch.

### F06 — P1: command-owned entities still have generic deletion paths

The registry sets `allowDirectSave: false` for payments, student fees, enrollment, students, report-card results, and other workflow entities. [Generic delete dispatch](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/lib/school-api/entities/operations.ts:181) has no corresponding exposure check; GraphQL also constructs delete/batch-delete mutations for these entities.

For example, the payment delete gate permits a recorded payment with no attachments, while generic deletion does not recalculate the student fee's paid balance. This is a source-confirmed alternative mutation path; every entity's desired delete policy still needs classification.

**Action:** replace the single save flag with explicit permitted public operations. Enforce exposure in the application boundary as well as REST/GraphQL. For payments require cancellation/reversal; close generic deletion. Keep supported administrative deletion only where its business effects are complete.

### F07 — P1: external effects and notification persistence cross transaction boundaries

[Managed saves](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/services/entities/managed-entity-service.ts:135) run post-save hooks inside atomic execution. [Notification hooks](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/capabilities/notifications/notification-trigger-registry.ts:81) invoke delivery. [The in-process provider](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/adaptor-notify/src/operations.ts:54) writes a notification job and calls `sendJob` immediately. Its [SQL wrapper](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/adaptor-notify/src/store/sql.ts:46) uses the original database object, outside the school adapter's transaction context.

Consequences: a notification can describe business data that later rolls back, and notification rows need not roll back with the business write. There is also a **native-runtime hang risk**: the school pool has `max: 1`; a transaction can hold its only connection while a hook awaits an independent notification query on that pool. This last consequence is inferred from composition and requires native PostgreSQL reproduction; PGlite tests do not certify it.

**Action:** insert durable notification intent through the business transaction, then dispatch after commit. Reuse existing notification tables where their semantics are suitable; introduce a small outbox if needed. Do not solve the correctness problem merely by increasing pool size or moving delivery into `waitUntil`.

### F08 — P1: notification retries and cron recovery are incomplete

[enqueueSchoolNotification](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/adaptor-notify/src/operations.ts:76) returns when the job already exists, including a failed job. [sendJob](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/adaptor-notify/src/jobs/send-job.ts:156) marks the overall job sent if any delivery succeeds, potentially hiding other channel failures. Its sending transition is not an exclusive claim. The gateway catches some failures and returns success to callers.

[Cron dispatch](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/capabilities/scheduling-jobs/tick-cron-schedules.ts:28) sends before advancing the schedule; a partial failure/retry can duplicate dispatch. Queue payloads carry school/action authority directly, parsing is mostly a TypeScript cast plus date conversion, missing queue bindings fall back to inline execution, and Wrangler specifies retries without a dead-letter queue.

**Action:** durable IDs, validated payloads, exclusive leases, retryable per-recipient/channel state, retry backoff, dead-letter handling, expired-lease recovery, and an operator replay command. Required production queue bindings must fail configuration validation. Assume at-least-once execution and prove idempotency rather than promising exactly-once email delivery.

### F09 — P1: owned auth connections lose their disposal function

[createPostgresAuthDatabase](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/runtime/shared/auth-database.ts:30) creates a standalone pool but returns it through `attachAuthDatabase`, whose disposal function is a no-op. That is correct for a borrowed handle but incorrect for a newly owned handle. The PGlite standalone helper has the same ownership problem.

**Reproduced:** disposing the attached handle never invokes the supplied disposal callback. Worker runtime cleanup consequently cannot close the owned auth pool through this handle. Production connection growth was not measured.

**Action:** make ownership explicit, retain disposal for owned handles, and close independent resources even if another close fails. Add native pool-lifecycle tests and Worker smoke coverage.

### F10 — P1 for the auth migration: existing Bearer semantics conflict with human tokens

[parseBearerApiKey](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-authorization/src/service-accounts/api-key-crypto.ts:38) accepts any Bearer token, not only its `sk_live_` format. [Session middleware](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/apps/api/src/http/dependencies/session-actor.ts:378) rejects requests when both a Better Auth session and a parsed Bearer value exist. Simply enabling the Better Auth Bearer plugin would cause a human Bearer session to satisfy both branches and be rejected.

The newer backend's service-principal separation is a useful destination, but migrating existing service-account rows is unnecessary for first-party Bearer support.

**Action:** one credential parser with explicit credential classes, strict syntax, one authority decision, and no fallback from an invalid supplied credential to a cookie session. Preserve legacy service-key compatibility with an explicit namespace. Never use a school service account to impersonate a consenting parent.

### F11 — P1 privacy boundary: profile images are deliberately public by attachment ID

[Public inline policy](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/package/domain-service/src/capabilities/files/attachment-inline-access.ts:3) allows ready image attachments owned by staff, students, or guardians. The file-content route then bypasses authentication and returns a presigned redirect. This is intentional current behavior, but it is broader than a parent-authorized student-data boundary.

**Action:** make student/guardian images private by default unless explicitly approved as public product content. Use authenticated fetch/blob rendering or short-lived URLs obtained after access checks. An attachment ID must not be the only access control. Cover existing photo `<img>` requests and PDF/download flows in the Bearer migration; they do not automatically attach an Authorization header.

### F12 — P1 operational gap: deploy does not depend on same-revision verification

[Push deployment](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/.github/workflows/deploy_push.yml:99) migrates after the planning job and deploys after migration. It has no verify/integration dependency. PR checks exist, but protections ensuring they ran for the deployed revision were not inspected. The migration/deploy jobs do not declare a protected GitHub environment in the checked workflow files.

**Action:** validate/build/test the revision before migrations, validate binding/configuration, deploy to staging, run synthetic smoke, then promote that tested revision/artifact. Serialize by actual target environment. Use backward-compatible migrations so the previous application version still works during rollout. Make rollback/roll-forward explicit and record the applied migration set.

### F13 — P1 operational gap: migration/reset target safety relies on conventions

[Migration resolution](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/tooling/db-migrate/scripts/lib/resolve-migration-target.ts:59) allows production/staging to fall back to generic `DATABASE_URL`. [Reset safeguards](/Users/atoumbre/SoftiLab/maya_invest/edaya_backend/tooling/db-migrate/scripts/lib/assert-remote-reset-allowed.ts:34) infer environment from hostname/URL strings and accept a broad override. The production migration prompt is informational.

School schema/migration files inspected contain no foreign-key/RLS declarations. Application gates provide many relationship checks, but raw writes and races can bypass these checks. Existing database uniqueness/index coverage should be inventoried before adding constraints.

**Action:** explicit environment-to-database identity, no generic production fallback, separate destructive recovery tooling, and reviewed additive migration plans. Run an integrity report before enforcing critical relationship/uniqueness constraints. Preserve migration history; do not flatten it as an RC cleanup. Rehearse upgrade and restore against a disposable database. Actual production database constraints/roles must be checked separately.

### F14 — P1/P2: contract, observability, and surface-area gaps

- OpenAPI lacks authentication declarations. Add the Bearer scheme, per-operation security, public exceptions, stable 401/403 behavior, and token lifecycle examples. CORS must expose `set-auth-token` if that mechanism is used; an allowed Authorization request header alone is insufficient.
- The actor uses the incoming/generated request ID, while HTTP logging independently generates another. Use one bounded correlation ID and propagate it into jobs and audits. Start logging before dependency resolution so auth/runtime failures are included.
- Pino has no central credential/personal-data redaction configuration. Notification failure callbacks pass entire inputs/profiles and logging gateways emit payloads. This does not prove every HTTP header is currently logged; audit actual serializers and redact tokens, cookies, OTPs, signed URLs, student notes, and sensitive payloads.
- Authorization/request logs are not a durable business audit trail. Record parent delegation grants/revocations, identity links, permission changes, payment changes, and sensitive-data access with minimal safe metadata.
- `/graphql` is always mounted. I found no application-wide request budget or GraphQL complexity/alias cap in the inspected HTTP/GraphQL composition. Confirm consumers, then disable it in production if unused; otherwise apply equivalent authorization, rate, size, and execution limits.
- Better Auth's configured rate limiting is not a quota for business endpoints. Add bounded request/batch sizes, per-client/subject limits for expensive reads and public onboarding, deadlines, and stable 429 responses with retry guidance. Add `Idempotency-Key` to allowed request headers when introducing command replay protection.
- There are 587 documented REST operations. External applications need a small explicit surface with field allowlists, not blanket access to the generic entity API.
- Docs refer to a sibling `edaya_web` and historical auth D1/migration commands, while the present frontend is `edaya_frontend` and auth uses Postgres. Archive superseded docs and keep one accurate operational entry point.

## Bearer and parent delegation design

Bearer is a way to present a credential. It does not by itself add consent, restrict an application, or establish a refresh-token protocol. Better Auth supports Bearer-backed sessions, while its OAuth provider is a separate capability. Verify compatibility against the locally pinned release before adopting current examples. [Bearer documentation](https://better-auth.com/docs/plugins/bearer), [OAuth provider documentation](https://better-auth.com/docs/plugins/oauth-provider).

Use two explicit credential classes behind the same Edaya authentication boundary:

| Consumer | Credential and authority |
|---|---|
| Edaya web/mobile | Bearer session for the existing user, resolved through Better Auth and current school/profile authorization |
| Approved external app | OAuth access token issued for that registered client, parent subject, API audience, consent grant, school, selected children, and permitted actions |
| Existing automation | Namespaced service credential and existing scoped machine authority; no parent identity impersonation |

Suggested flow for the study app:

1. The app redirects the parent to Edaya sign-in using Authorization Code with S256 PKCE, exact registered redirects, and state. It never collects the parent's Edaya password.
2. Edaya identifies the parent and asks them to approve the app, school, selected children, and specific data uses.
3. Edaya issues an authorization code bound to that client and PKCE challenge; the app exchanges it for its own limited token.
4. The study app calls an allowlisted read API. The backend resolves the parent and current guardian links on each authorized operation.
5. The parent can disconnect the app. Consent revocation, account disablement, or guardian-link removal stops access within a documented and tested bound.

Effective access must be the intersection of **current parent authority ∩ client-approved actions ∩ granted scopes ∩ selected children/school ∩ endpoint policy**. Consent can narrow parent authority, never enlarge it. Token claims and `X-School-Id`/`X-Actor-Id` are not independent sources of authority.

Proposed initial scopes: `students.basic:read`, `learning.progress:read`, and `assessments.results:read`. Their exact projections require product agreement. Exclude health, disciplinary incidents, private notes, payment data, other guardians' details, and all writes from the first study integration. Return purpose-specific DTOs rather than entire student entities. Add `openid` only when the external app needs standardized login identity; ID tokens must not be accepted as API access tokens.

Start with manually registered approved clients and one pilot. Do not enable dynamic client registration or a developer marketplace for launch. The external app needs to handle an OAuth redirect and its own app session, but it does not need a separate user-password system.

Use Authorization Code + PKCE; avoid implicit/password grants. For public clients, protect refresh tokens with rotation/reuse detection or sender constraint; validate issuer, audience, expiry, client/grant state, and the intended resource. These recommendations follow [OAuth security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html). Proposed initial delegated access-token lifetime: 5–10 minutes, with refresh lifetime and consent retention explicitly decided rather than inherited accidentally.

For launch, favor authoritative grant/revocation checks instead of relying solely on JWT expiry. Store long-lived credentials in platform Keychain/Keystore on native clients. The current mobile code persists cookie material in SharedPreferences; do not carry that storage approach over to Bearer tokens. In browsers, prefer in-memory access tokens with a carefully designed renewal path. If persistent browser sessions are required, use a protected same-origin session/renewal mechanism; do not casually persist broad long-lived tokens in localStorage. Bearer-authenticated business APIs can coexist with a secure Edaya login cookie for browser sign-in/SSO. A completely cookie-free browser requirement needs an explicit persistence/reauthentication decision.

Cloudflare KV is eventually consistent; it cannot by itself guarantee immediate global token revocation. Hyperdrive also does not invalidate cached query results on writes. Use a fresh authoritative path for session/grant/relationship revocation checks, and separately verify the actual deployed cache settings. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Hyperdrive caching](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/).

## Implementation sequence

These are bounded delivery slices, not a replacement-backend program. Effort is a planning allowance in focused engineer-days, not a calendar commitment; recalibrate after the first defect-fix slice. Estimates assume developers familiar with these repositories and access to staging.

| Slice | Concrete deliverable | Exit condition | Allowance |
|---|---|---|---|
| 1. Establish a safe baseline | Fix seed verification bypass, tenant count, wrong scope invalidation, auth disposal, payment replay, unsafe generic deletes; resolve template failures | New negative/replay tests pass; existing verification is green | 4–7 days |
| 2. Bound reads and authority | Server-enforced school predicates, relationship scopes before paging/count, no stale cross-request authorization for RC, private sensitive attachments | Two-school and related/unrelated portal matrix passes over real persistence | 5–9 days |
| 3. Migrate first-party auth | Credential parser, Better Auth Bearer adapter, session lifecycle wrapper, TypeScript/Dart transport updates, OpenAPI and CORS | Webapp, webadmin, guardian, teacher, logout/revocation and downloads pass | 3–6 days, including client work |
| 4. Make effects recoverable | Transactional intent, commit-after dispatch, per-recipient retries, durable job references, binding validation, native transaction tests | Rollback sends nothing; restart/retry recovers work; no double business mutation | 4–7 days |
| 5. Establish RC operations | Verified deployment promotion, migration identity, restore rehearsal, smoke probes, safe logs, alarms and runbooks | Staging drill plus agreed soak passes on the release revision | 3–5 days |
| 6. External study-app pilot | Registered OAuth client, parent/child consent, narrow read API, token renewal/revocation and access audit | End-to-end parent grant/read/disconnect and abuse matrix passes | Additional 6–12 days |

Slices 1–5 imply roughly **19–34 engineer-days**, before discovery contingency. Some client and operations work can overlap after the authentication contract and database behavior are settled. They should not be compressed into an unsupported launch promise. If the deadline is shorter, reduce launch scope or defer external access and broad cleanup; do not waive tenant isolation, identity verification, payment correctness, or rollback safety.

Implement inside the current package boundaries. Introduce small context/authentication and transaction/outbox interfaces where needed. Keep current IDs, core entities, business URLs, and generated-client contracts stable except for deliberate security fixes and explicitly versioned auth changes. Do not rename folders or change database drivers to imitate the new repository.

### Bearer rollout and rollback

1. Add the new credential boundary and token lifecycle tests before enabling the plugin. Reserve credential namespaces; define behavior when both credential sources are present. Reject ambiguity and do not fall back after invalid Bearer authentication.
2. Add first-party support while retaining cookie compatibility for known clients during a time-limited transition. Add metrics by auth mode and client version without recording credentials.
3. Update webapp and webadmin auth wrappers, their API transports, mobile `edaya_auth`/transport/session storage, seeding and smoke clients, and approved direct-download flows. Existing REST types alone do not perform authentication.
4. Test password sign-in, OTP, verification, invitations, multiple schools/profiles, expiry/renewal, sign-out, revoked sessions, invalid tokens, legacy service keys, and mixed credentials.
5. Pilot against staging, deploy compatible backend support, then release clients. Keep the compatibility mode until deployed mobile/client versions and telemetry justify ending it.
6. Disable cookie authentication on protected business routes after the cutoff. Keep only explicitly chosen login/renewal/consent cookie behavior. Remove stale cookie helpers later.

Rollback first-party migration by restoring the previous verified backend/client-compatible auth mode, while retaining all security fixes. Do not grant broader access or accept revoked tokens to make rollback easier. Keep migration schemas additive so old application code can still run. External delegation gets a separate client/grant kill switch and must fail closed if disabled.

### Effective cleanup boundaries

**Do now:** close unsafe API operations; fix misleading tests; remove secret-triggered provider selection in favor of an explicit notification provider; decouple `LOG_LEVEL=silent` from disabling notification behavior; redact logging; generate Worker binding types from configuration; consolidate auth wrappers; make migrations deterministic; correct stale operational docs; cap request/batch/query work; archive obsolete operational instructions.

**After caller inventory and telemetry:** disable unused production GraphQL; retire Novu fallback only after choosing and validating the replacement; remove legacy scope formats and old client helpers after the compatibility window; remove old environment names and deprecated routes with a recorded cutoff.

**Defer:** comprehensive domain flattening, package renaming, new finance accounting concepts, microservices, all-purpose authorization engines, broad schema rewrites, wholesale dependency upgrades, and copying the newer repository's governance machinery. Upgrade individual dependencies when a verified compatibility/security need requires it, with lockfile review and tests.

## RC acceptance and maintenance

An RC is an exact tested revision plus its migration set, compatible clients, supported configuration, known limitations, and recovery procedure. It is not simply a green build or a cleaner folder tree.

Release acceptance:

- No unresolved P0 or P1 defect affecting enabled launch features.
- All intended quality/build/unit/integration gates pass from a frozen install; the two template failures are resolved rather than hidden by cache or test exclusion.
- Native PostgreSQL proves rollback, duplicate-payment handling, concurrent balance updates, transaction-bound notification intent, connection cleanup, and critical constraints.
- Authorization matrix covers anonymous, school owner, limited staff, teacher, parent with linked child, same-school unrelated child, another school, inactive account, removed link, and service credential. Apply the matrix to list/count/detail/download and permitted mutations.
- First-party clients pass complete auth journeys and Bearer migration compatibility tests. External scopes do not unlock generic endpoints or sensitive fields.
- Provider failure/retry, missing bindings, database outage, expired job leases, and partial notification delivery have bounded, observable outcomes.
- Verified revision deploys to staging with upgrade/rollback compatibility and post-deploy smoke. Restore is rehearsed on disposable resources, with measured recovery time and integrity checks.
- A representative-load soak is completed with agreed API latency/error, queue-age, and connection-budget thresholds. A proposed 24–48 hour soak is a starting point, not evidence already obtained.

Keep operations to one concise runbook and one deployment checklist. Assign a primary and backup owner for release, database recovery, authentication incidents, and notification/job recovery.

| Cadence / event | Maintenance operation |
|---|---|
| Every deployment | Verify revision and migrations; stage; smoke login/parent read/denial/payment replay/delivery; promote; record rollback revision |
| Continuous | Monitor API failures/latency, auth failures, queue age, expired leases, delivery failures, connection pressure, and database health |
| Daily during launch | Inspect error trends and failed jobs; reconcile payment totals; check backup/PITR coverage and provider delivery |
| Weekly | Review dependencies/advisories, slow queries, capacity, active external clients, abnormal access and failed recovery work |
| Monthly initially | Rehearse disposable restore and token/client revocation; review access and secret ownership; test a controlled rollback |
| Security incident | Disable affected client/grant/account, invalidate authoritative access, preserve minimal audit evidence, verify denial from a second runtime |
| Job incident | Diagnose by durable job/request ID; repair the cause; retry only failed work; verify business state and recipient status |

Set recovery objectives against the actual hosting configuration. A candidate starting discussion is a 15-minute data-loss objective and two-hour recovery objective; neither is established by this audit. Database recovery must account for attachments, outstanding jobs, and external notifications already delivered, not only restore rows.

Recommended immediate next work: one small fix series for F01, F02/F04, F05/F06, and F09 with durable regression tests, followed by a native transaction probe for F07. This resolves the most concrete launch risks before architectural cleanup or public integration work expands the surface.

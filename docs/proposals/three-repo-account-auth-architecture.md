# Provider-independent Accounts and three product repositories

Status: implemented locally; deployment and initial data cutover remain explicit release operations. Replaces the September 26 password/backfill proposal.

## Decisions

- Product source lives in `edaya_backend` (TypeScript), `edaya_frontend` (SvelteKit), and `edaya_mobile` (Flutter). Identity remains a separate service and database, maintained in the backend workspace.
- Immutable EDaya Account IDs own human identity. Existing business `subjectId` fields carry Account IDs, never provider IDs. Academic subject IDs and machine identities retain their separate meanings.
- Accounts own multiple normalized email and E.164 phone identifiers, unique among active login identifiers. First identifier is recovery eligible; additional identifiers opt in explicitly. Notification contacts are independent.
- Email OTP and phone OTP are required provider capabilities. Phone delivery uses Meta WhatsApp authentication templates first, with user-selected Africa’s Talking SMS after cooldown. Launch is limited to Côte d’Ivoire. Telegram, Twilio, passwords, Apple and Google are outside this release.
- Account use cases enforce linking, account status, MFA, recovery, and identity continuity. Better Auth owns only primary credential verification and its disposable implementation data. Delivery is a separate port.
- Durable `identity` storage holds Accounts, identifiers, security events, encrypted TOTP secrets and hashed recovery codes. Ephemeral challenges and EDaya session metadata also live there, separately from disposable provider users in `auth`. Signing keys belong to EDaya.
- No usable session is issued before required factors complete. Six-digit OTP expires after five minutes, at most five guesses, and recipient-wide phone resend cooldowns of 60, 120 and then 300 seconds (reset after an hour without an accepted request). Email retains its 60-second cooldown. Delivery channel switching supersedes old challenges and preserves the attempt budget. No automatic retry of ambiguous sends or simultaneous channel delivery.
- TOTP is account-wide and optional for ordinary accounts. `REQUIRE_PRIVILEGED_TOTP` defaults off; when enabled it gates owners, platform operators and staff with access-management/lifecycle grants from authoritative business data. Voluntarily enabled TOTP is always enforced.
- TOTP uses six digits, 30-second periods, one-step clock tolerance, and atomic replay prevention. Ten single-use recovery codes are displayed once. Recovery requires fresh eligible-contact OTP plus a recovery code, revokes sessions, and permits only authenticator replacement until enrollment is confirmed.
- Support-assisted recovery is deferred to SaaS administration. Reassigning a school profile through unlink/reinvite is not global Account recovery; the same identifier cannot bypass existing MFA.
- Keep current invitation tokens, lifecycle and acceptance model. No verification on link opening. Match invitation contacts against active verified Account identifiers. Invitation tokens continue to be invitation capabilities, not authentication evidence.
- Browser renewal credentials use HttpOnly host cookies; Flutter stores opaque credentials securely. Audience-limited access tokens use Account ID as `sub`, true authentication timestamps and authentication methods. Refresh does not advance authentication time. Revocation blocks renewal immediately; existing access tokens last at most five minutes, including default validation tolerance.
- Framework replacement changes the provider generation, invalidates old sessions, and resolves Accounts through verified recovery-eligible identifiers without resetting authenticators or business state. Provider assertions alone never merge Accounts.
- Future social authentication is an extension with additive issuer/subject links; no mandatory email or phone columns on Account and no contact requirement on token verification. No social endpoints or tables are required now.

## Delivery sequence and release gates

1. Validate the pinned Better Auth implementation with real email and phone OTP, multiple identifiers, concurrent consumption, MFA and replacement tests.
2. Consolidate source, tooling and CI; retain the old checkout until the replacement is verified.
3. Introduce Account/security persistence and public EDaya contracts, then migrate both clients and business identity resolution.
4. Validate invitations, authorization across all actor kinds, recovery, transport failures, and independent builds. Update generated/released client artifacts and contract fingerprints together.
5. Use an explicit initial clean-reset cutover; no legacy backfill. Do not reset or deploy an environment as part of local implementation. Once customer data exists, all changes require additive migrations.
6. Production launch requires configured email delivery, Telegram Gateway credentials, WhatsApp sender/template approval, a pinned Graph API version, durable encryption-key backups, and successful privileged MFA enrollment/recovery checks.

## Operational notes

`ACCOUNT_SECURITY_KEYS` is a JSON keyring of version to base64 32-byte AES keys; `ACCOUNT_SECURITY_KEY_VERSION` selects the active key. Retain previous versions when rotating. These keys are independent of the provider secret and must survive provider replacement. Local-only development may derive a key from its test provider secret; production requires an explicit keyring.

When privileged MFA is enabled, identity uses `ACCOUNT_POLICY_URL` and the shared internal directory credential to query current business policy; the business API independently enforces it. This dependency fails closed.

The initial Postgres adapter serializes account authentication mutations with a transaction advisory lock, including cross-identifier linking and replay checks. This favors correctness for the initial rollout; measure contention before scaling authentication throughput. No credential or OTP may appear in production logs.


## Implementation map

- `package/domain-account`: provider-neutral contracts and Account authentication/security use cases.
- `package/adaptor-account`: durable Account schema, migrations, transaction coordination and cryptography.
- `package/adaptor-auth-better-auth`: private email/phone primary-authentication implementation.
- `apps/identity`: stable HTTP contract, opaque browser/native sessions, JWT issuance and delivery adapters.
- `tooling/repo/db/identity`: Account and provider migrations, explicit guarded reset tools.
- SvelteKit and Flutter: passwordless login, verified contact linking, authenticator enrollment and recovery. The web Account security route is available before school onboarding.

The previous identity checkout is retained as a reference; builds and deployment workflows no longer depend on it. The web client contains a pinned generated API artifact so its checkout builds independently. All three repositories share a release-contract fingerprint.

## Validation and release limits

Validation covers real Better Auth email/phone verification, hashed OTP storage, failed-attempt persistence, concurrent OTP consumption, provider replacement, Account continuity, MFA replay, restricted recovery, cookie/native sessions, JWT assurance and invitation alias matching. A local Chromium journey exercises email OTP, alias linking, authenticator enrollment, ten recovery codes and persisted security state.

Telegram and WhatsApp delivery use mocked transport tests locally. Live delivery, template approval, secret provisioning, production migrations and the initial clean reset still require the deployment environment. Production CI now expects `PRODUCTION_AUTH_DATABASE_URL` and deploys both backend Workers. Keep the privileged-MFA flag off until enrollment/recovery and the internal policy endpoint are verified in that environment.


Verified locally on September 28, 2026:

- Backend `bun repo verify --full`: all repository checks, quality, builds, unit suites and 50 API/HTTP integration tests passed (including 761 service tests).

- Identity integration tests: 46 passed, using the pinned Better Auth adapter.
- School API tests: 286 passed, including verified aliases and cross-school invitations.
- Native Postgres seed integration: 8 passed with an owned temporary identity server; temporary cluster removed afterward.
- Frontend `bun run verify`: quality, build and 875 webapp tests passed.
- Mobile `melos run verify`: analysis and all package/app tests passed; integration harness analysis also passed.
- Identity Worker bundle dry-run and workflow YAML parsing passed. No deployment was performed.

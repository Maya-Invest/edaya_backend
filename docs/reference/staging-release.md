# Coordinated staging release

This release qualifies the current three-repository stack for staging. Production, store publication, and completion of the v1 feature plans are separate work.

## Candidate and deployment ownership

The backend `release-staging.yml` workflow checks out backend at the triggering SHA and resolves the web and mobile inputs once. Identity lives in `edaya_backend/apps/api/src/identity`, and one API client belongs to the backend. All verification, generated clients, builds, migrations, and deployments use those checkouts. Its `edaya-full-stack-staging` concurrency group serializes the complete release, including observation and recovery.

Staging pushes verify code. Staging client publication happens only in the coordinator after qualification. Individual staging deploy workflows reject the target. The existing backend **Push / Merge deploy** workflow can dispatch the coordinator from its staging ref, which also works before the new workflow is present on the repository's default branch.

Inputs: `web_ref`, `mobile_ref`, `reset_data` (default **false**) and `validate_only` (default **false**). The later first fresh-data rollout must explicitly use `reset_data=true`; retries after successful bootstrap use `reset_data=false`. Preparation uses `validate_only=true`. The coordinator has no production target and rejects database endpoints/databases/accounts that differ from `.github/scripts/staging-target.mjs`.

## Required configuration

Configure the backend repository's `staging` Actions environment. Never put credentials in workflow inputs or release artifacts.

| Secret or variable | Purpose |
|---|---|
| `IDENTITY_CHECKOUT_TOKEN` secret | Fine-grained token with Contents: read for the three private repositories. Also needed in web and mobile for their own integration workflows. Deploy keys are disabled on these repositories. |
| `CLOUDFLARE_API_TOKEN` secret | Staging Worker/domain, Hyperdrive, KV, queue, R2 metadata, and Worker-tail access on the recorded Cloudflare account. |
| `STAGING_DATABASE_URL` secret | Direct TLS connection to the existing staging `neondb` school database. |
| `STAGING_AUTH_DATABASE_URL` secret | Direct TLS connection to `edaya_identity`, owned by role `edaya_identity`, on the same confirmed staging Neon branch. |
| `STAGING_API_SECRETS` secret | JSON containing staging R2, Firebase, notification, and shared directory credentials. |
| `STAGING_IDENTITY_SECRETS` secret | JSON containing `BETTER_AUTH_SECRET`, durable versioned `ACCOUNT_SECURITY_KEYS` (base64 32-byte keys; active `ACCOUNT_SECURITY_KEY_VERSION` defaults to `v1`). Phone-provider credentials are optional while disabled. |
| `STAGING_ANDROID_SIGNING_BUNDLE` secret | JSON with base64 `keystore` and `apps.guardian` / `apps.teacher` objects containing `keyAlias`, `keyPassword`, `storePassword`, and parsed `firebase` configuration. |
| `STAGING_NEON_TARGET_CONFIRMED` variable | Set to the recorded direct endpoint only after matching it to the intended Neon project and staging branch. |

The coordinator's `GITHUB_TOKEN` publishes or reuses only `@maya-invest/edaya-api-client` after local qualification. Grant this backend repository package read/write access. Its version uses `0.0.0-staging.<backend-SHA>` and record `edayaSourceCommit`; an immutable version with another source commit stops the release. Only one publication record is retained.

`validate_only=true` runs the read-only infrastructure preflight, qualification, disposable bootstrap rehearsal, staging web/Worker builds and deployment dry runs, and both signed APK checks. It does not publish packages, deploy Workers, migrate/reset live databases or provision live fixtures. Validation builds use the checked-in matching client contracts; publication and testing web against the exact registry version occur in the later rollout. Direct publication/deployment commands also reject `VALIDATE_ONLY=true`. A successful local test run alone does not establish infrastructure readiness.

The reusable preflight (`node .github/scripts/staging-preflight.mjs`) checks credential presence, JSON payloads, matching directory secrets, Account encryption keys, direct TLS database targets and identities, existing Cloudflare resources, cross-repository checkout access, Firebase application/project IDs and both Android signing aliases/passwords. It writes only redacted field/resource diagnostics to `release/preflight.json`. Endpoint confirmation must come from verified Neon project/branch ownership, never from the endpoint string alone.

### Infrastructure discrepancy found on 2026-09-13

The live staging Hyperdrives both use `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech/neondb`. The connected Neon account instead lists the Edaya staging branch `br-flat-union-ahedlz5i` in project `calm-brook-83532792` at `ep-ancient-darkness-ahtbz5cm.c-3.us-east-1.aws.neon.tech`. These are different endpoints. Identify the project/branch owning the live endpoint before creating the identity database or enabling reset. Do not silently switch staging to the older account/branch.

Create the dedicated identity database and role on the confirmed branch and configure its direct URL. The coordinator checks both connections before entering maintenance, changes only the staging auth Hyperdrive, and preserves disabled query caching. It retains the existing queue, KV namespace, bucket, and Android signing configuration.

Verify the `noreply@edayaplus.com` sender, Browser Rendering account capability, Firebase project/application IDs, and controlled test recipients/devices before live acceptance. Administrative fixture creation sends no email. School email/push uses the same unrestricted recipient resolution as production; there is no staging recipient allowlist. Use designated test accounts and devices. Live delivery evidence still requires designated accounts/devices; generated fixture addresses are not delivery authorization.

## Verification availability

Staging keeps `PHONE_AUTH_MODE=disabled`: phone login/linking, SMS and WhatsApp resend attempts are rejected without provider sends. Web, guardian and teacher forms trust Identity's advertised availability; failed discovery falls back to email-only labels, hides phone controls/hints, and rejects pasted phones locally in English/French. Email OTP, authenticators and recovery remain available.

Full phone-enabled OTP-capture and clock-driven journeys remain in **local** qualification. Deployment runs `melos run test:staging`, with six registered smoke cases, real native API clients and private fixture sessions. It rejects OTP test access, captured OTP files and test clock configuration; deployed apps never enable test OTP access.

## Release order

1. Verify all three repositories; check generated contracts; run backend integration, seed, native PostgreSQL, browser, and mobile integration checks. Rehearse an empty bootstrap on two disposable PostgreSQL databases with verified identity accounts, private attachments, and document fixtures.
2. Publish/reuse the exact API client. Verify web against the exact published backend client and build staging staff/admin assets. Build APKs with Flutter 3.44.8 and verify signatures/application IDs against the existing keystore. JavaScript repositories use Bun 1.3.14; Actions uses Node 22 and Java 17.
3. Recheck database and infrastructure identities. Set `PAUSE_API`, `PAUSE_SCHEDULER`, and `PAUSE_JOBS` to true, deploy the unified API once, confirm HTTP 503, pause queue delivery, and allow old requests to finish.
4. Configure secrets and the separate identity Hyperdrive. Only when `reset_data=true`, purge obsolete staging queue messages and auth KV, reset school/notification schemas, and clear identity users/credentials. Identity reset retains signing keys.
5. Migrate, provision verified fixture accounts through the identity-owned CLI, and set `PAUSE_API=false` while `PAUSE_SCHEDULER` and `PAUSE_JOBS` remain true. For a reset, run the complete school seed. A release without reset migrates and validates existing fixtures without reseeding school data.
6. Run API smoke and the dedicated native mobile staging smoke, deploy the prepared staff/admin web assets, resume jobs, and observe for 65 minutes. Observation records HTTP health plus redacted Worker event summaries, requires scheduled executions, and rejects errors, stream gaps, and unexplained warnings.

Identity fixtures are exported by backend tooling to a private temporary JSON file, then consumed by the backend Identity fixture entry (`apps/api/src/identity/entries/staging-fixtures.ts`). Provider packages import no school-domain code; composition resolves privileged policy through typed school repositories. Staging HTTP seeding only signs in provisioned accounts; `/dev/seed/mark-email-verified` remains local-only. The local rehearsal uses `SEED_PROVISIONED_IDENTITY=true` and private `SEED_AUTH_SESSIONS_FILE` credentials to exercise that same session-only path.

## Evidence and acceptance

Actions uploads a release manifest/evidence artifact and separate guardian/teacher APK artifacts after successful automation. The schema-version-4 manifest records exactly backend/frontend/mobile commits, one API client source/version record, one unified OpenAPI hash and one backend Worker configuration, exact toolchain versions, Worker deployments, and APK SHA-256 checksums. It contains no credential values. Worker event summaries omit request URLs, log text, exceptions, and private response data.

Automated success is not a substitute for installed-device acceptance. Record the actual device/OS/build coverage and complete fresh login, renewal, logout, guardian child/profile switching, staff grants, assigned teacher access, attendance, grading, finance, inbox isolation, private downloads, and real Browser Rendering checks. Exercise email/push only with designated test destinations. Confirm no stuck delivery retries or duplicate notifications during observation. Stub PDFs from local rehearsal do not qualify the real renderer.

## Failure and recovery

The coordinator stops at the first failed phase. After maintenance starts, its failure handler uses settings-only updates to enable all three pause controls and pauses queue delivery; it does not redeploy code. If Cloudflare itself is unavailable, the progress artifact identifies the failure and an operator must confirm maintenance through the dashboard/API.

Use `release/deployment-progress.json` to identify the last completed phase and `worker-versions.json` plus the manifest for compatible versions. Keep data-dependent services in maintenance during recovery. Redeploy a previously recorded compatible set of API, web, and mobile artifacts. If the database schema is incompatible, rebuild **staging only** with the matching source revisions and explicit reset, then reseed. A Worker rollback does not restore database state.

Do not blindly rerun a destructive workflow attempt after successful bootstrap: its original `reset_data=true` input would reset again. Dispatch a new attempt with the same SHAs and `reset_data=false` when preserving the successfully bootstrapped data. Reuse the exact published API client; package version/source mismatches fail closed. A rerun of the same Actions run also restores prepared APKs only when all three SHAs, Flutter version, the single API URL, Firebase configuration hashes, and APK checksums match; signatures are verified again against the current signing keys. Web assets are rebuilt against the exact published client before deployment.

Related guidance: [Neon direct versus pooled connections](https://neon.com/docs/connect/connection-pooling), [Cloudflare Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Remaining product work is tracked separately in [the v1 work list](staging-remaining-v1.md).

## Unified endpoint cutover

The API Worker retains its existing name and both database bindings, with `staging.api.edayaplus.com` and `api.edayaplus.com` configured as Custom Domains. Read-only preflight verifies zone account ownership and hostname conflicts; an absent hostname is eligible for later creation. Secrets are validated and combined for one Worker; conflicting duplicate fields fail and retired directory fields are discarded. APK provenance is schema 3 with one API URL; older provenance is a cache miss. All candidates require committed backend/frontend/mobile revisions. Fresh web/mobile builds and login are mandatory. Retire old domains and the Identity Worker only after a later rollout passes unified smoke and observation, without compatibility aliases.

Operational controls are shared with production; deployment workflows remain separate. See [configuration migration and rollback](api-configuration.md#one-time-operational-control-migration) before the first release using the new names.

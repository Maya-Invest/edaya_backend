# Coordinated staging release

This release qualifies the current four-repository stack for staging. Production, store publication, and completion of the v1 feature plans are separate work.

## Candidate and deployment ownership

The backend `release-staging.yml` workflow checks out backend at the triggering SHA and resolves the identity, web, and mobile inputs once. All verification, generated clients, builds, migrations, and deployments use those checkouts. Its `edaya-full-stack-staging` concurrency group serializes the complete release, including observation and recovery.

Staging pushes verify and publish clients. They do not deploy or migrate. Individual staging deploy workflows reject the target. The existing backend **Push / Merge deploy** workflow can dispatch the coordinator from its staging ref, which also works before the new workflow is present on the repository's default branch.

Inputs: `identity_ref`, `web_ref`, `mobile_ref`, and `reset_data` (default **false**). Use **true** for the first fresh-data release. The coordinator has no production target and rejects database endpoints/databases/accounts that differ from `.github/scripts/staging-target.mjs`.

## Required configuration

Configure the backend repository's `staging` Actions environment. Never put credentials in workflow inputs or release artifacts.

| Secret or variable | Purpose |
|---|---|
| `IDENTITY_CHECKOUT_TOKEN` secret | Fine-grained token with Contents: read for the four private repositories. Also needed in web and mobile for their own integration workflows. Deploy keys are disabled on these repositories. |
| `CLOUDFLARE_API_TOKEN` secret | Staging Worker/domain, Hyperdrive, KV, queue, R2 metadata, and Worker-tail access on the recorded Cloudflare account. |
| `STAGING_DATABASE_URL` secret | Direct TLS connection to the existing staging `neondb` school database. |
| `STAGING_AUTH_DATABASE_URL` secret | Direct TLS connection to `edaya_identity`, owned by role `edaya_identity`, on the same confirmed staging Neon branch. |
| `STAGING_API_SECRETS` secret | JSON containing staging R2, Firebase, notification, and shared directory credentials. |
| `STAGING_IDENTITY_SECRETS` secret | JSON containing `BETTER_AUTH_SECRET` and matching `IDENTITY_DIRECTORY_SECRET`. |
| `STAGING_ANDROID_SIGNING_BUNDLE` secret | JSON with base64 `keystore` and `apps.guardian` / `apps.teacher` objects containing `keyAlias`, `keyPassword`, `storePassword`, and parsed `firebase` configuration. |
| `STAGING_NEON_TARGET_CONFIRMED` variable | Set to the recorded direct endpoint only after matching it to the intended Neon project and staging branch. |

The coordinator's `GITHUB_TOKEN` publishes the backend client. Grant the backend repository read access to the identity client package in GitHub Packages. Publish the matching identity client from the identity repository's staging workflow before dispatching the coordinator. Both client versions use `0.0.0-staging.<full-source-SHA>` and record `edayaSourceCommit`; retries reuse only the matching immutable version.

### Infrastructure discrepancy found on 2026-09-13

The live staging Hyperdrives both use `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech/neondb`. The connected Neon account instead lists the Edaya staging branch `br-flat-union-ahedlz5i` in project `calm-brook-83532792` at `ep-ancient-darkness-ahtbz5cm.c-3.us-east-1.aws.neon.tech`. These are different endpoints. Identify the project/branch owning the live endpoint before creating the identity database or enabling reset. Do not silently switch staging to the older account/branch.

Create the dedicated identity database and role on the confirmed branch and configure its direct URL. The coordinator checks both connections before entering maintenance, changes only the staging auth Hyperdrive, and preserves disabled query caching. It retains the existing queue, KV namespace, bucket, and Android signing configuration.

Verify the `noreply@edayaplus.com` sender, Browser Rendering account capability, Firebase project/application IDs, and controlled test recipients/devices before live acceptance. Administrative fixture creation sends no email. Set the optional `STAGING_NOTIFICATION_EMAILS` field in `STAGING_API_SECRETS` to the designated account emails for school email/push delivery. An empty allowlist cancels school delivery channels before providers are called. Live delivery evidence still requires designated accounts/devices; generated fixture addresses are not delivery authorization.

## Release order

1. Verify all four repositories; check generated contracts; run backend integration, seed, native PostgreSQL, browser, and mobile integration checks. Rehearse an empty bootstrap on two disposable PostgreSQL databases with verified identity accounts, private attachments, and document fixtures.
2. Publish/reuse the exact clients. Verify web against the exact published backend client and build staging staff/admin assets. Build APKs with Flutter 3.44.8 and verify signatures/application IDs against the existing keystore. JavaScript repositories use Bun 1.3.14; Actions uses Node 22 and Java 17.
3. Validate database and infrastructure identities. Deploy identity/API maintenance responses, confirm HTTP 503, pause queue delivery, and allow old requests to finish.
4. Configure secrets and the separate identity Hyperdrive. Only when `reset_data=true`, purge obsolete staging queue messages and auth KV, reset school/notification schemas, and clear identity users/credentials. Identity reset retains signing keys.
5. Migrate, enable identity, provision verified fixture accounts through the identity-owned CLI, and enable API HTTP while jobs remain paused. For a reset, run the complete school seed. A release without reset migrates and validates existing fixtures without reseeding school data.
6. Run API/mobile integration, deploy the prepared staff/admin web assets, resume jobs, and observe for 30 minutes. Observation records HTTP health plus redacted Worker event summaries, requires scheduled executions, and rejects errors, stream gaps, and unexplained warnings.

Identity fixtures are exported by backend tooling to a private temporary JSON file, then consumed by `bun repo seed staging <file>` in identity. Identity imports no school-domain code. Staging HTTP seeding only signs in provisioned accounts; `/dev/seed/mark-email-verified` remains local-only. The local rehearsal uses `SEED_PROVISIONED_IDENTITY=true` to exercise that same login-only path.

## Evidence and acceptance

Actions uploads a release manifest/evidence artifact and separate guardian/teacher APK artifacts after successful automation. The manifest records exact repository/client/toolchain versions, Worker deployments, and APK SHA-256 checksums. It contains no credential values. Worker event summaries omit request URLs, log text, exceptions, and private response data.

Automated success is not a substitute for installed-device acceptance. Record the actual device/OS/build coverage and complete fresh login, renewal, logout, guardian child/profile switching, staff grants, assigned teacher access, attendance, grading, finance, inbox isolation, private downloads, and real Browser Rendering checks. Exercise email/push only with designated test destinations. Confirm no stuck delivery retries or duplicate notifications during observation. Stub PDFs from local rehearsal do not qualify the real renderer.

## Failure and recovery

The coordinator stops at the first failed phase. After maintenance starts, its failure handler attempts to restore maintenance on both API services and pause the queue. If Cloudflare itself is unavailable, the progress artifact identifies the failure and an operator must confirm maintenance through the dashboard/API.

Use `release/deployment-progress.json` to identify the last completed phase and `worker-versions.json` plus the manifest for compatible versions. Keep data-dependent services in maintenance during recovery. Redeploy a previously recorded compatible set of identity, API, web, and mobile artifacts. If the database schema is incompatible, rebuild **staging only** with the matching source revisions and explicit reset, then reseed. A Worker rollback does not restore database state.

Do not blindly rerun a destructive workflow attempt after successful bootstrap: its original `reset_data=true` input would reset again. Dispatch a new attempt with the same SHAs and `reset_data=false` when preserving the successfully bootstrapped data. Reuse exact published clients; package version/source mismatches fail closed. A rerun of the same Actions run also restores prepared APKs only when all four SHAs, Flutter version, staging URLs, Firebase configuration hashes, and APK checksums match; signatures are verified again against the current signing keys. Web assets are rebuilt against the exact published client before deployment.

Related guidance: [Neon direct versus pooled connections](https://neon.com/docs/connect/connection-pooling), [Cloudflare Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Remaining product work is tracked separately in [the v1 work list](staging-remaining-v1.md).

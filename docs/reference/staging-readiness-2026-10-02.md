# Staging readiness validation — 2026-10-02

**Readiness: blocked. Local code validation: passed.** No packages were published, Workers deployed, live data changed, or rollout dispatched. Phone, SMS and WhatsApp stay disabled in staging; email, authenticators and recovery remain available.

## Completed validation

| Area | Evidence |
|---|---|
| Backend | Verification passed: 2,015 package unit tests and 35 release-tooling tests; 57 service/HTTP, 63 native PostgreSQL and 8 seed HTTP integration tests passed. |
| Disposable staging rehearsal | Fresh bootstrap and preserving-data retry passed using separate school/Identity databases and the dedicated Identity role. |
| Frontend | Verification passed: 904 webapp, 2 webadmin and 3 repo unit tests, plus 3 root tooling checks. All 520 browser scenes passed: availability 6, onboarding 29, provisioned matrix 398, webadmin 4 and demo 83; coverage passed. |
| Mobile | Verification passed: 155 unit/widget, 19 Python tooling and 3 APK tooling tests. All 118 local integrations and coverage passed. |
| Staging builds | API, Identity, staff web and admin web deployment dry runs passed. Both signed APKs built with Flutter 3.44.8, staging URLs and OTP test access disabled. |
| APK verification | Checksums, guardian/teacher application IDs and certificates matched the existing signing keys. No keys were replaced. |

The teacher batch-grading integration test originally timed out after saving four of six marks while builds and browser suites ran concurrently. Its bounded deadline now accounts for the number of sequential saves; persistence and duplicate checks remain intact. The final full mobile run passed. Late mark-batch responses after route disposal are covered by four dedicated lifecycle tests.

## Blocking checks

1. Match `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech` to its actual Neon project and staging branch. The accessible information did not establish ownership. Do not substitute another endpoint or set the confirmation variable based only on its hostname.
2. After ownership is established, verify/create `edaya_identity` and its dedicated role on that branch, then configure its direct TLS `STAGING_AUTH_DATABASE_URL`.
3. Pass the reusable read-only infrastructure/credential preflight with real configuration. Local credentials were unavailable. Repository/environment inspection did not expose `STAGING_AUTH_DATABASE_URL`, `IDENTITY_CHECKOUT_TOKEN` or `STAGING_NEON_TARGET_CONFIRMED`; organization-level inheritance remains unverified. Existing API/Identity/signing secret names are visible, but their payloads and checkout permissions cannot be inferred from names. Local signing/Firebase material successfully built both APKs; the Actions bundle still needs preflight verification.
4. Commit the intended changes in all three repositories and validate those exact revisions. The current workspaces are dirty and include changes from earlier audits. The base HEADs below do **not** contain the implementation, and the local APKs must not be reused as artifacts of those HEADs.

## Tested workspace snapshots

| Repository | Base HEAD (not deployable) | Workspace SHA-256 |
|---|---|---|
| backend | `d17cdc7221981ce03bcd6d1087d3483e23e1257e` | `36b3f7d11465d625eaa5715ae2fccc965868af50d4b10ea0ff47830dab2844eb` |
| frontend | `78a57fa27b1551632e282fafcee2c59bf3d24938` | `c45ed90e15e821370bc4c9f94636806ebd53f1779534a226eb68ff0fe41eb7f5` |
| mobile | `d5bdeaafb5a0ea4baf135edd50aec4424f9f9404` | `a9cf1796f573ef847356d7ccf61a3a1813b205f3b7a1076bfbabb2848902ffa6` |

The JSON record describes the snapshot algorithm, dependency/OpenAPI hashes, toolchains and APK SHA-256/certificate evidence. Ignored credentials and build outputs are excluded from workspace hashes. The local release manifest uses schema 3 and exactly three base repositories, and is explicitly marked blocked. Both client versions derive from the backend commit. A deployable candidate still needs committed revisions and successful Actions validation; local Node differs from the coordinator's pinned Node 22.

## Rollout boundary

Use `validate_only=true` to validate the committed candidate. It cannot publish clients, deploy Workers, migrate/reset live databases or seed live fixtures. Both clients publish/reuse independently only after qualification in a later rollout. Full phone-enabled capture tests stay local; the deployed native smoke uses existing private sessions and rejects OTP test access. That deployed smoke was not executed during this preparation.

The later first fresh bootstrap must explicitly use `reset_data=true` while retaining existing signing keys and infrastructure. After successful bootstrap, retries use `reset_data=false`.

See [the redacted evidence record](staging-readiness-2026-10-02.json) and [the release procedure](staging-release.md). Local raw logs and disposable fixture data remain in `/private/tmp/edaya-staging-readiness-20261002-ftim739g`; do not upload the entire directory as a public artifact.

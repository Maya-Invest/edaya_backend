# Unified API staging readiness — 2026-10-03

**Readiness: blocked. Local code validation: passed.** Authentication and school operations now share one API Worker, one public contract and `@maya-invest/edaya-api-client`. No packages were published, Workers deployed, live data changed, or rollout dispatched.

## Implemented candidate

The candidate targets `https://api.edayaplus.com` in production, `https://staging.api.edayaplus.com` in staging, and port `9999` locally. These hostnames have not been deployed during preparation. The API retains its existing Worker names, separate Account/school databases, signing keys and infrastructure bindings. Auth routes run before school context, while school requests continue to use JWTs. JWT verification, directory resolution and privileged MFA policy run in process. The separate Identity app, Worker configuration and client package are removed.

Generated TypeScript and Dart auth contracts serve web and mobile. Session-cookie auth transport does not request school access tokens; token exchange cannot recurse. Known mobile endpoint presets migrate to the unified origin, custom URLs survive, and stored credentials/access-token caches clear when their origin changes. GraphiQL uses explicit Authorization headers and links to supported web login.

Staging keeps phone/SMS/WhatsApp disabled. Email OTP, authenticator verification, recovery and linking remain available. Local qualification retains phone-enabled captured-provider tests; deployed smoke uses private fixture sessions and disables OTP capture.

Release manifest schema 4 records three revisions, one matching API-client publication record, one OpenAPI hash and one backend Worker configuration. APK provenance schema 3 records one API URL and rejects older caches. `validate_only=true` prevents publication, deployment and live migrations/resets. The existing API/Identity secret inputs are validated and combined; conflicting duplicates fail and retired directory fields are discarded.

## Validation evidence

| Area | Result |
|---|---|
| Backend | 2,021 package unit tests and 41 release-tooling tests passed; 57 service/HTTP, 60 native PostgreSQL and 8 seed HTTP integrations passed. Three optional native PostgreSQL benchmarks remain skipped. |
| Disposable bootstrap | Separate school/Account databases and dedicated Account role; fresh reset/bootstrap and preserving-data retry passed, with fixture idempotency and signing-key preservation guards. |
| Frontend | 904 webapp, 2 webadmin and 3 repo unit tests, plus 3 root tooling checks, passed. All 520 browser scenes passed: availability 6, onboarding 29, provisioned matrix 398, webadmin 4 and demo 83. Coverage and execution freshness passed. |
| Mobile | 156 unit/widget, 19 Python tooling and 3 APK tooling tests passed. All 118 local integrations passed: native API 47, guardian 42 and teacher 29; coverage and execution freshness passed. |
| Staging artifacts | API, staff web and admin web deployment dry runs passed. Both APKs rebuilt with Flutter 3.44.8, the unified staging URL and OTP test access disabled. |
| Signing | Both application IDs, checksums and certificates match the existing keystores. No signing keys were replaced. |

The browser marks-entry assertion now waits for one matching visible element; persisted marks were already present in its failure screenshot. Teacher synchronization/grading tests use bounded per-roster deadlines for sequential writes and retain full-roster and duplicate assertions. Runs invalidated by fixture edits were discarded; the final evidence passed freshness checks against unchanged sources.

The exact committed backend/frontend/mobile revisions are recorded in the [schema-4 candidate manifest](../../../release-validation/unified-api-2026-10-03/manifest.json). APK checksums, certificates and the release-contract fingerprint appear in [the redacted validation record](staging-readiness-2026-10-03.json). APK schema-3 provenance is stored in `edaya_mobile/release-apks/apk-source.json`.

## Infrastructure blockers

1. Verify the actual Neon project and staging branch owning `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech`. Ownership remains unverified; no other endpoint was substituted and the confirmation variable was not set.
2. Verify/create the dedicated `edaya_identity` database and role only on that confirmed branch, then provide its direct TLS `STAGING_AUTH_DATABASE_URL`.
3. Pass read-only preflight using real validated credentials/payloads, checkout permissions, database identities, Cloudflare resources, Android signing configuration and zone/hostname ownership. Local credentials were unavailable, so live resource checks were not reached. Domain-check tests cover eligible absent domains and conflicting owners/routes; actual new-hostname ownership is still unverified.
4. Repository/staging-environment inspection did not expose `STAGING_AUTH_DATABASE_URL`, `IDENTITY_CHECKOUT_TOKEN` or `STAGING_NEON_TARGET_CONFIRMED`. Organization inheritance remains unverified. Visible secret names do not establish valid payloads or permissions. Local signing/Firebase material passed; the Actions bundle still requires preflight.

Actions validation was not dispatched, and local Node differs from the workflow's pinned Node 22. Installed-device behavior, real delivery/Browser Rendering, deployed smoke and observation remain later rollout checks.

## Rollout boundary

Validate these committed revisions with `validate_only=true` after the infrastructure blockers are resolved. The later first fresh staging bootstrap explicitly uses `reset_data=true`, retaining existing keys and infrastructure; retries after successful bootstrap use `reset_data=false`.

Fresh web/mobile builds and login are required. Retire the old domains and separate Identity Worker only after unified-endpoint smoke and observation pass, with no compatibility aliases. Production rollout is outside this preparation.

See [the release procedure](staging-release.md). Sanitized local evidence is retained in `release-validation/unified-api-2026-10-03`; raw logs and private fixture state remain under `/private/tmp/edaya-unified-readiness-20261003` and must not be uploaded wholesale.

# Staging validation and later rollout

The candidate uses one backend Worker named `edaya-api-staging`, with the Cloudflare Custom Domain `staging.api.edayaplus.com`. Production’s corresponding hostname is `api.edayaplus.com`; production rollout is outside this work. Staff and admin web Workers remain separate.

Prepare through the backend coordinator with `validate_only=true`. This runs qualification, staging builds, Worker deployment dry runs and both signed APK checks. It cannot publish packages, deploy Workers, migrate/reset live databases or dispatch rollout. The default remains `validate_only=false` for a separately authorized later release. Detailed sequencing and required fields are in [staging-release.md](staging-release.md).

Retain `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech`. Verify the actual owning Neon project and staging branch before setting `STAGING_NEON_TARGET_CONFIRMED`. The dedicated `edaya_identity` database and role must exist on that confirmed branch. Both direct URLs require TLS; pooled or substituted targets fail preflight. Unresolved ownership or missing credentials block readiness.

Keep `STAGING_API_SECRETS` and `STAGING_IDENTITY_SECRETS` as inputs. Preflight validates their fields and merges them for the unified Worker, dropping retired directory configuration and rejecting conflicting duplicates without printing values. Preserve existing signing and Account encryption keys, Hyperdrive bindings, auth KV, queue, R2, email and rendering resources. Domain preflight verifies zone account ownership and conflicting Custom Domains, DNS records and Worker routes. An absent unclaimed hostname may be created only during later rollout.

Staging remains `PHONE_AUTH_MODE=disabled`. Do not enable deployed OTP test access. Dedicated staging smoke uses private fixture sessions and the real native API client. Full phone-enabled journeys run locally.

The later fresh bootstrap explicitly uses `reset_data=true` once, preserving signing keys and infrastructure. After success, new retries use `reset_data=false`. Maintenance and queue pause cover the single API Worker. Apply Account and school migrations separately, provision verified Account fixtures, bootstrap school data through the unified API, then smoke-test and observe. After unified endpoint acceptance, retire old school/Identity domains and the separate Identity Worker without aliases. Preparation performs none of those live actions.

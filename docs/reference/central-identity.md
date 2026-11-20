# Account authentication in the EDaya API

One API owns authentication and school HTTP operations. Production uses `https://api.edayaplus.com`, staging `https://staging.api.edayaplus.com`, and local development `http://localhost:9999`. Updated clients and fresh login are required at cutover. There are no compatibility aliases for old issuers or audiences.

`apps/api/src/identity` composes the existing Account domain, Account persistence and replaceable Better Auth provider. Account and school data remain in separate databases. Public `/auth/edaya/*` contracts and `/.well-known/jwks.json` are documented in the main OpenAPI reference. Directory resolution, JWT verification and privileged-account MFA policy use typed in-process ports; private HTTP directory/policy routes and the Identity service binding are removed.

Auth dispatch runs before school dependencies. Login and ordinary session operations do not open the school database. Privileged MFA policy opens school repositories only when required. Browser auth uses credentialed fetch and host-only HttpOnly cookies; native auth uses the opaque renewal credential. School requests require an access JWT or the existing machine key, never session cookies. JWT issuer and audience are the canonical API origin. Local loopback/emulator aliases normalize to that origin; foreign and retired origins fail verification.

Only `@maya-invest/edaya-api-client` is published. Its generated `auth` namespace and `createAuthClient(transport)` use a session transport independent of token exchange. The package contains no server signing or provider dependencies. Dart contracts live in `edaya_api_client`; `edaya_auth` consumes them as the session/renewal adapter. The API client does not depend on the auth adapter.

Staging advertises phone verification unavailable. Failed availability discovery also yields email-only forms. Email OTP, authenticators, recovery and email account linking remain available. OTP capture is enabled in local development and isolated tests, never in Workers.

Run `bun run repo dev` for the API and local files. It captures OTPs using persistent local data; isolated CI fixtures use an internal testing entrypoint. Account migrations and guarded wipes remain in `tooling/repo/db/identity`; school migrations remain in `tooling/repo/db/school`. See [staging-release.md](staging-release.md) for validation and the later rollout boundary.

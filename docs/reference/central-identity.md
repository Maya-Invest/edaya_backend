# Central identity (v1)

School API authenticates **users** with a signed JWT from the `edaya_identity` service and **machines** with school `sk_live_` keys. This repo does not run Better Auth.

## Hosts

| Surface | Production | Staging | Local |
|---|---|---|---|
| Identity | `https://identity.edayaplus.com` | `https://staging.identity.edayaplus.com` | `http://localhost:9900` |
| School API | `https://api.school.edayaplus.com` | `https://staging.api.school.edayaplus.com` | `http://localhost:9999` |
| Staff webapp | `https://app.school.edayaplus.com` | `https://staging.app.school.edayaplus.com` | Vite |
| Operator admin | `https://admin.edayaplus.com` | `https://staging.admin.edayaplus.com` | Vite |

Auth cookies are host-only on the identity host. Web `credentials: 'include'` only to identity. School fetches use Bearer and omit cookies.

## Credentials (XOR)

1. `Authorization: Bearer <JWT>` — identity assertion. School verifies JWKS (`iss`, `aud`, `exp`, `sub`, at least one of `email` | `phone`).
2. `Authorization: Bearer sk_live_…` — school service account.
3. Cookie on `/core`, both credentials, or unknown prefix → 401.

JWT `aud` is this API's `API_ORIGIN`. Identity mints that value only when the caller requests `{ "resource": "<API origin>" }` from an allowlisted first-party origin. Callers cannot invent a different audience.

## School package

`@maya-invest/edaya-identity-client` (file-link `../edaya_identity/package/identity-client` or GitHub Packages). School does not import `@edaya/adaptor-auth` or Better Auth.

- `verifyIdentityToken(jwt)` — handwritten JWKS verify
- Directory HTTP — `GET /internal/directory/by-contact?channel=email|phone&value=` and `GET /internal/directory/by-id/:subjectId`

Login, OTP, cookies, and native sign-in stay on identity `/auth/*` (Better Auth client / mobile `edaya_auth`).

## Invitation accept

Match the invite `contactChannel` to the JWT claim (`email` or `phone`). Missing or mismatched claim fails. Phone claims are empty until phone OTP ships. Preview uses the directory for both channels (`hasAccountForPhone` returns `exists: false` until identity stores phones).

## Local topology

`bun repo dev` in this repo starts the school API (`:9999`) and local files (`:9200`) only. Start identity separately:

```sh
cd ../edaya_identity && bun repo dev   # :9900
```

Share `IDENTITY_DIRECTORY_SECRET=local-directory-secret` with identity. School `bun repo seed clean` wipes school `.data` only; wipe identity users from `edaya_identity` with `bun repo db wipe local --yes`.

## CI

Backend CI checks out `Maya-Invest/edaya_identity` as a sibling before `bun install` (secret `IDENTITY_CHECKOUT_TOKEN`). School `_migrate.yml` applies the school schema only.

## Deploy

Deploy identity (Worker + migrations + published or file-linked client) **before** school/frontend/mobile. Runbook: [edaya_identity/docs/deploy.md](../../edaya_identity/docs/deploy.md). Rollback is revert; there is no compatibility flag.

Removed from this repo: `ALLOW_LEGACY_COOKIE_BUSINESS_AUTH`, `COOKIE_DOMAIN`, school `AUTH_KV` / `HYPERDRIVE_AUTH` / `BETTER_AUTH_*`, `/auth` routes, opaque `edaya_at_` tokens.

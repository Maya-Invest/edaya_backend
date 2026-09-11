# Connected-app access during RC implementation

The first-party management API is implemented. External OAuth authorization and identity components are still internal: the public partner routes, hosted consent flow, restricted student-data DTOs and partner example must be finished together before partner access is enabled. This is not a production enablement guide.

## First-party management API

Authenticate with `Authorization: Bearer <edaya_at_…>`. Cookies, signed renewal credentials, external OAuth access tokens and ID tokens cannot authorize these endpoints, even with the temporary cookie rollback flag enabled. Responses use `Cache-Control: no-store`.

- `GET /auth/edaya/connected-apps`: returns `{ items, nextCursor }`. Each item includes the grant ID, verified registry client name/purpose, school ID, selected student IDs, scopes and creation/expiry dates. Lists only the current subject's unrevoked, unexpired grants for enabled clients. Pages contain at most 50 grants in stable ID order; pass `?cursor=<nextCursor>` to continue.
- `POST /auth/edaya/connected-apps/{grantId}/revoke`: returns `{ success: true }` for an owned grant, including a repeated revocation. Unknown and other users' grants return the same 404. Revocation is one database statement with an ownership predicate. The next external token resolution and refresh are rejected across runtime instances.

A listed grant may have lost a school relationship since consent. Listing it does not authorize student access: resource access and refresh must recheck current guardian access and intersect selected children with current school relationships. Parents can still revoke these grants.

Ordinary first-party logout preserves partner consent. Security logout-all, which requires a recent first-party login, revokes all of the subject's delegations along with first-party sessions. Operator client disablement and confidential-secret rotation revoke that client's grants.

The API document includes the management endpoints and their `FirstPartyAccess` security scheme. Web and guardian-mobile management screens remain to be implemented.

## Internal protocol boundary

The pinned provider handles code/S256 PKCE, signed consent queries, rotation/replay and token signing. Edaya binds its own server-created grant inside the same auth transaction. The HTTP boundary admits explicit content types and methods, strips ambient cookies from token requests, requires exact-origin cookie proof for consent, and applies database-backed quotas. Silent authorization returns an interaction-required error instead of reusing a child selection; an explicit login prompt remains effective.

Access and ID tokens last at most five minutes. Access and refresh expiry cannot exceed the grant's absolute thirty-day expiry. The token response reports the capped access expiry. The internal UserInfo boundary accepts only external opaque Bearer access, rechecks the live grant and guardian relationship, requires `openid`, and returns only `sub`. Discovery advertises the admitted features; issuer/audience/signature and nonce are verified in native integration tests.

Before public mounting, finish signed login continuation and hosted consent details, wire authoritative school access without deadlocking a shared single-connection database, add every restricted read DTO and scope check, and test the full user flow through the actual app router. The internal provider factory alone does not establish those properties.

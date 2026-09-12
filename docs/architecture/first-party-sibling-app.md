# First-party sibling apps

| Field | Value |
|-------|-------|
| Status | Implemented (Children AI bootstrap notes) |
| Date | 12 September 2026 |
| Repo | `edaya_backend` |
| Owner | Platform |

## Summary

A first-party sibling API (Children AI today) is an audience on identity (`FIRST_PARTY_API_ORIGINS`) and a **machine caller** of the school API. It does not import school packages. School never treats a parent or staff JWT as a sibling-app credential.

## School API access

Machines authenticate with a per-school `s2s_live_` key minted by a platform operator:

```http
Authorization: Bearer s2s_live_…
```

Do **not** forward a parent, guardian, or staff identity JWT to school routes. Those JWTs are human sessions (`X-Actor-Kind` staff / guardian / student / teacher / platform). Sibling backends are `kind: s2s`.

Mint keys with `POST /core/s2s-clients` (`schoolId`, `clientId` such as `children-ai`, `accessClass: read | write`). See [platform-actors-and-s2s-keys.md](./platform-actors-and-s2s-keys.md).

`sk_live_` remains the staff service-account family used by seeding and internal school automation. Do not reuse it for sibling products.

## Identity

Identity JWTs keep `sub = auth.user.id` and `aud` as an opaque API origin. Adding a sibling app is a vars change on identity (`FIRST_PARTY_API_ORIGINS`), not a school registry. School verifies JWTs and calls the directory through `@maya-invest/edaya-identity-client`.

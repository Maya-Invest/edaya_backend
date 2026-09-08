# Repository TODO

Tracked follow-up work across the monorepo. Check items off as they ship.

---

## Production Readiness

### 1. Better Auth — production hardening

Deferred until deploying auth to production or exposing the API to external clients.

- [ ] Configure `trustedOrigins` when browser clients call the API directly
- [ ] Add rate limiting on `/auth/*` (Cloudflare or Hono middleware)

# Repository TODO

Tracked follow-up work across the monorepo. Check items off as they ship.

---

## Production Readiness

### 1. Better Auth — production hardening

Deferred until deploying auth to production or exposing the API to external clients. See [better-auth-integration-plan.md](docs/sprints/archive/better-auth-integration-plan.md) (Phase 5).

- [ ] Configure `trustedOrigins` when browser clients call the API directly
- [ ] Document `BETTER_AUTH_SECRET` rotation in an ops runbook
- [ ] Confirm auth migrations run on Worker cold start with the `postgres-js` driver
- [ ] Add rate limiting on `/auth/*` (Cloudflare or Hono middleware)

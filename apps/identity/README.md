# @edaya/identity

Edaya Account authentication service, maintained in the TypeScript backend. The Account domain owns identifiers, sessions, TOTP and recovery. Better Auth is a private primary-authentication adapter.

From the backend root, copy `apps/identity/.env.example` to `apps/identity/.env`, install with `bun install`, then run `bun repo dev` for identity, school API and local files. Use `bun --filter @edaya/identity dev` for identity alone.

Browser and mobile clients use `/auth/edaya/*`; provider endpoints are unavailable. Email OTP and phone OTP through Telegram Gateway / WhatsApp are supported. Public methods describe configured channels. Invitation links never verify a contact.

Local startup migrates its configured identity database. Workers require explicit migrations: `AUTH_DATABASE_URL=... bun --filter @edaya/identity-migrate migrate`. Durable Account tables use the `identity` schema; disposable Better Auth tables use `auth`.

Production requires `ACCOUNT_SECURITY_KEYS` (versioned base64 32-byte encryption keys), an active `ACCOUNT_SECURITY_KEY_VERSION`, email delivery and phone delivery credentials. Keep encryption keys during provider changes. Change `AUTH_PROVIDER_GENERATION` to revoke old renewal sessions when replacing an adapter. Access tokens expire within five minutes. `REQUIRE_PRIVILEGED_TOTP=true` additionally requires the school API policy URL and shared directory secret on both services.

Production CI requires `PRODUCTION_AUTH_DATABASE_URL` alongside the school database secret. Worker secrets and approved WhatsApp templates must be configured before deployment. No data reset is implicit in a migration or deployment.

See [architecture and cutover](../../docs/proposals/three-repo-account-auth-architecture.md).

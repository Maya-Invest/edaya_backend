# Runtime boundaries

The API worker wires adapters from **`RUNTIME` only**. Scheduled cron jobs run on the same worker (`scheduled()` handler). Each profile has a fixed adapter matrix; bootstrap code does not upgrade adaptors when unrelated vendor env vars are present.

**Configuration:** `bun repo dev` loads `apps/api/config.local.jsonc` plus secrets from `.env`. Wrangler smoke and R2 tools load `config.staging.jsonc` plus `.dev.vars` secrets. Deployed variables are updated explicitly with `bun repo vars push api <staging|production>`; code deployment preserves them. See [API configuration](api-configuration.md).

See also [api-runtimes.md](./api-runtimes.md) and [cron-runtimes.md](./cron-runtimes.md) for commands and env loading.

## Profiles

| Profile | Purpose | Command |
|---------|---------|---------|
| **`local`** | Day-to-day development | `bun repo dev` |
| **`in-memory`** | Fast automated tests | `bun test` (harness sets env) |
| **`worker`** | Staging / production deploy; optional local smoke | `bun repo deploy api production`, `bun repo deploy api staging`, `bun --filter @edaya/api dev:worker` |

**worker** is not a separate `RUNTIME` value. It means `RUNTIME=worker` executed through `wrangler dev` (Miniflare) with `.dev.vars` and Cloudflare bindings — same adapter wiring as a deployed Worker.

## Adapter matrix (API)

| Concern | `in-memory` | `local` | `worker` |
|---------|-------------|---------|----------|
| School DB | PGlite ephemeral (`pglite`) | PGlite persisted (`pglite:.data/school`) | Postgres (Hyperdrive binding or `DATABASE_URL`) |
| Account | Ephemeral fixtures | Separate Account PGlite, in-process ports | Separate Account Hyperdrive, request-scoped in-process ports |
| File storage | in-memory `FileStoragePort` | `@edaya/adaptor-local-fs` + `tooling/repo/dev/local-files.ts` | R2 (`@edaya/adaptor-r2`) |
| Notifications | no-op | in-process notify (API injects log email + log SMS) | in-process notify (API injects Cloudflare email + unimplemented SMS) + FCM |
| Invitation delivery | no-op | in-process notify | in-process notify |
| Document rendering | not configured | Chrome, Gotenberg (`GOTENBERG_URL`), or stub | Browser Run (`BROWSER`) or Gotenberg |

\* **Notify** — `RUNTIME=local` or `worker` uses in-process `@edaya/adaptor-notify`. Email and SMS transports are selected in `apps/api`, not inside notify. `in-memory` never calls notify.

\* **Documents** — in-process `@edaya/adaptor-docs`. `in-memory` never calls Gotenberg, Chrome, or Browser Run. Worker prefers the `BROWSER` binding; without it (and without `GOTENBERG_URL`) rendering is not configured. Local prefers Gotenberg, then Chrome `--print-to-pdf`, then a stub. Stub PDFs are local-only.

## Bootstrap rule

```
RUNTIME → adaptor resolver (profile-specific) → port implementation
```

Resolvers must not branch on vendor env before checking `RUNTIME`. Foreign env vars are inert on the wrong profile — not validated, not rejected.

Positive requirements only (fail when the profile cannot boot):

| Profile | Required shape |
|---------|----------------|
| `local` | `DATABASE_URL=pglite:<path>` with a persisted data directory (e.g. `pglite:.data/school`) |
| `in-memory` | Ephemeral URLs set by the test harness |
| `worker` | Postgres `DATABASE_URL` (from Hyperdrive or env); R2 credentials for file storage |

## Local development stack

`bun repo dev` starts:

1. `@edaya/api` — `RUNTIME=local`, PGlite + local-fs client
2. `bun tooling/repo/dev/local-files.ts` — HTTP file service on port 9200

Vendor smoke (Postgres via Hyperdrive, R2) uses **`bun --filter @edaya/api dev:worker`** with `apps/api/.dev.vars` — not `bun repo dev`.

## Cron

Cron follows the same boundary idea:

| Profile | School DB |
|---------|-----------|
| `local` | Persisted PGlite only |
| `worker` | Postgres via Hyperdrive |

Cron does not use file storage (`noOpFileStorage`).

## CI guardrails

`bun repo doctor` runs structural checks from `tooling/repo/lib/runtime-boundaries.ts` to prevent regressions (flat file-storage resolver, persisted PGlite in `config.local.jsonc`, local-files always started by `bun repo dev`, in-memory notify/docs gates, no separate `@edaya/notify` or docs/Gotenberg process, single heartbeat cron + `CRON_JOBS` queue and `BROWSER` binding in `wrangler.jsonc`, no legacy `apps/cron` or `apps/notify` packages).

## Related packages

| Package | Role |
|---------|------|
| `@edaya/adaptor-postgres` | School persistence (PGlite + Postgres drivers) |
| typed in-process Account ports | In-process JWT verification and Account directory access |
| `@edaya/adaptor-local-fs` | Local dev `FileStoragePort` + Hono upload app |
| `bun tooling/repo/dev/local-files.ts` | Dev-only file HTTP service (`tooling/repo/dev/local-files.ts`) |
| `@edaya/adaptor-r2` | Worker `FileStoragePort` |
| `@edaya/adaptor-notify` | In-process email/push adapters on the school API |
| `@edaya/adaptor-docs` | In-process PDF rendering (templates + inner PdfRenderer) |

Staging and production share the Worker entrypoint, adapters, build settings, binding names/types, schedules, and queue behavior. Repository verification compares effective Wrangler profiles and allows only resource identities to differ. Application behavior is selected by configuration, including independent `PAUSE_API`, `PAUSE_SCHEDULER`, and `PAUSE_JOBS` controls, never by staging hostnames. Staging fixture/reset safeguards remain tooling-only.

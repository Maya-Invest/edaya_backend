# Runtime boundaries

The API worker wires adapters from **`RUNTIME` only**. Scheduled cron jobs run on the same worker (`scheduled()` handler). Each profile has a fixed adapter matrix; bootstrap code does not upgrade adaptors when unrelated vendor env vars are present.

**Env files:** `bun repo dev` loads `apps/api/.env` only. `.dev.vars` is Wrangler-only (`wrangler dev`, deploy, R2 ops scripts) and is never read by the local process runtime.

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
| Identity | fixture client | HTTP identity client | issuer JWKS + HTTP/service-binding directory |
| File storage | in-memory `FileStoragePort` | `@edaya/adaptor-local-fs` + `tooling/local-files-server` | R2 (`@edaya/adaptor-r2`) |
| Notifications | no-op | notify* or Novu* or log/no-op | notify* or Novu* or no-op |
| Invitation delivery | no-op | notify* or Novu* or no-op | notify* or Novu* or no-op |
| Document rendering | not configured | stub or Gotenberg (`GOTENBERG_URL`) | Browser Run (`BROWSER`) or Gotenberg |

\* **Notify / Novu** — `NOVU_SECRET_KEY` selects Novu (legacy fallback). Otherwise `RUNTIME=local` or `worker` uses in-process `@edaya/adaptor-notify`. When neither applies, notifications fall back to structured logging (or no-op in silent test mode). `in-memory` never calls notify or Novu.

\* **Documents** — in-process `@edaya/adaptor-docs`. `in-memory` never calls Gotenberg or Browser Run. Worker prefers the `BROWSER` binding; without it (and without `GOTENBERG_URL`) rendering is not configured. Stub PDFs are local-only.

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
2. `@edaya/local-files-server` — HTTP file service on port 9200

Vendor smoke (Postgres via Hyperdrive, R2) uses **`bun --filter @edaya/api dev:worker`** with `apps/api/.dev.vars` — not `bun repo dev`.

## Cron

Cron follows the same boundary idea:

| Profile | School DB |
|---------|-----------|
| `local` | Persisted PGlite only |
| `worker` | Postgres via Hyperdrive |

Cron does not use file storage (`noOpFileStorage`).

## CI guardrails

`bun repo doctor` runs structural checks from `tooling/repo/lib/runtime-boundaries.ts` to prevent regressions (flat file-storage resolver, persisted PGlite in `.env.example`, local-files always started by `bun repo dev`, in-memory Novu/notify/docs gates, no separate `@edaya/notify` or docs/Gotenberg process, single heartbeat cron + `CRON_JOBS` queue and `BROWSER` binding in `wrangler.jsonc`, no legacy `apps/cron` or `apps/notify` packages).

## Related packages

| Package | Role |
|---------|------|
| `@edaya/adaptor-postgres` | School persistence (PGlite + Postgres drivers) |
| `@maya-invest/edaya-identity-client` | Central Identity JWT verification and directory access |
| `@edaya/adaptor-local-fs` | Local dev `FileStoragePort` + Hono upload app |
| `@edaya/local-files-server` | Dev-only file HTTP service (`tooling/local-files-server`) |
| `@edaya/adaptor-r2` | Worker `FileStoragePort` |
| `@edaya/adaptor-novu` | Notifications (Novu env fallback) |
| `@edaya/adaptor-notify` | In-process email/push adapters on the school API |
| `@edaya/adaptor-docs` | In-process PDF rendering (templates + inner PdfRenderer) |

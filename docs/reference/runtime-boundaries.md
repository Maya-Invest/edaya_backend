# Runtime boundaries

The API worker wires adapters from **`RUNTIME` only**. Scheduled cron jobs run on the same worker (`scheduled()` handler). Each profile has a fixed adapter matrix; bootstrap code does not upgrade adaptors when unrelated vendor env vars are present (for example, `R2_*` in `.dev.vars` is ignored by `bun dev`).

See also [api-runtimes.md](./api-runtimes.md) and [cron-runtimes.md](./cron-runtimes.md) for commands and env loading.

## Profiles

| Profile | Purpose | Command |
|---------|---------|---------|
| **`local`** | Day-to-day development | `bun dev` |
| **`in-memory`** | Fast automated tests | `bun test` (harness sets env) |
| **`worker`** | Staging / production deploy, and local Worker smoke via Miniflare | `bun run deploy:api*`, `bun dev:worker-local` |

**Worker-local** is not a separate `RUNTIME` value. It means `RUNTIME=worker` executed through `wrangler dev` (Miniflare) with `.dev.vars` and Cloudflare bindings — same adapter wiring as a deployed Worker.

## Adapter matrix (API)

| Concern | `in-memory` | `local` | `worker` |
|---------|-------------|---------|----------|
| School DB | PGlite ephemeral (`pglite`) | PGlite persisted (`pglite:.data/school`) | Postgres (Hyperdrive binding or `DATABASE_URL`) |
| Auth DB | PGlite `auth` schema | PGlite `auth` schema (same DB as school) | Postgres `auth` schema via Hyperdrive |
| File storage | in-memory `FileStoragePort` | `@edaya/adaptor-local-fs` + `tooling/local-files` | R2 (`@edaya/adaptor-r2`) |
| Notifications | no-op | Novu* or log/no-op | Novu* or no-op |
| Invitation delivery | no-op | Novu* or no-op | Novu* or no-op |

\* **Novu exception** — the only vendor adaptor intentionally allowed on `local`. When `NOVU_SECRET_KEY` is unset, notifications fall back to structured logging (or no-op in silent test mode). `in-memory` never uses Novu, even if the key is present in the environment.

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

`bun dev` starts:

1. `@edaya/api` — `RUNTIME=local`, PGlite + SQLite + local-fs client
2. `@edaya/local-files` — HTTP file service on port 9200

Vendor smoke (Postgres via Hyperdrive, R2) uses **`bun dev:worker-local`** with `apps/api/.dev.vars` — not `bun dev`.

## Cron

Cron follows the same boundary idea:

| Profile | School DB |
|---------|-----------|
| `local` | Persisted PGlite only |
| `worker` | Postgres via Hyperdrive |

Cron does not use file storage (`noOpFileStorage`).

## CI guardrails

`bun run doctor` runs structural checks from `tooling/repo/lib/runtime-boundaries.ts` to prevent regressions (flat file-storage resolver, persisted PGlite in `.env.example`, local-files always started by `bun dev`, in-memory Novu gates, single heartbeat cron + `CRON_JOBS` queue in `wrangler.jsonc`, no legacy `apps/cron` package).

## Related packages

| Package | Role |
|---------|------|
| `@edaya/adaptor-postgres` | School persistence (PGlite + Postgres drivers) |
| `@edaya/adaptor-auth` | Better Auth persistence (Postgres `auth` schema) |
| `@edaya/adaptor-local-fs` | Local dev `FileStoragePort` + Hono upload app |
| `@edaya/local-files` | Dev-only file HTTP service (`tooling/local-files`) |
| `@edaya/adaptor-r2` | Worker `FileStoragePort` |
| `@edaya/adaptor-novu` | Notifications (non-`in-memory` profiles) |

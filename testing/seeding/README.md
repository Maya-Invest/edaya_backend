# @edaya/seeding

HTTP seed orchestration for local dev, staging, and integration tests.

## Commands

| Script | Purpose |
|--------|---------|
| `bun seed:all` / `bun seed:init` | Full demo seed through `/core/*` (same entry point) |
| `bun seed:auth` | Better Auth accounts only |
| `bun seed:auth:link` | Re-link auth subjects to staff/guardian records |
| `bun seed:smoke` | Sign-in + `/core/authorization/effective-grants` |
| `bun seed:validate` | Manifest entity counts + dashboard queries |
| `bun seed:remote` | Full seed against `SEED_API_URL` |
| `bun seed:clean` | Wipe local `.data/` (stop `bun dev` first) |
| `bun seed:clean:staging` | Wipe Neon staging + Better Auth D1 (destructive) |

From the repo root: `bun seed`, `bun seed:init`, etc.

Optional wipe before seeding:

```sh
bun seed:clean --yes && bun seed:init          # local
bun seed:clean:staging --yes && bun seed:remote   # staging
# or
bun seed:init --clean
bun seed:remote --clean
```

## Local dev flow

1. Start the API: `bun dev`
2. Seed: `bun seed` (or `bun seed:init` — identical)
3. Log in at http://localhost:5173/login

After `rm -rf .data`, **stop `bun dev` first**, then restart before seeding. See [docs/local-dev.md](../../docs/local-dev.md).

## Architecture

- **HTTP adapters** (`src/*/http.ts`) — call `/core/*` routes; used by CLI and staging.
- **In-process adapters** (`src/*/in-process.ts`) — used only when tests pass a `SeedApplication` directly (faster/isolated integration tests). Not used for local dev CLI.
- **Ports** (`src/*/port.ts`) — shared workflow contracts between HTTP and in-process adapters.
- **Bootstrap** (`src/http/bootstrap-http-core-session.ts`) — signs in as the school owner, calls `register-school` when needed, then provisions the seeding service account.

Seeding API keys come from `@edaya/dev-fixtures` school profiles (`seedingApiKey`). No `.env` secret required for local dev.

## Notifications

Seeding does not import or configure a notification provider. Published announcements (`publishAnnouncement`) go through normal domain workflows.

If the API has a provider configured (e.g. `NOVU_SECRET_KEY` in `apps/api/.env`), seeding **can enqueue real outbound notifications** for published fixture announcements. For local dev without provider side effects, leave notification env vars unset — the API falls back to logging/no-op gateways.

Novu-specific smoke testing lives outside this package: `bun novu:smoke` from the repo root.

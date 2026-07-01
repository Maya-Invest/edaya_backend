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

After `rm -rf .data`, **stop `bun dev` first**, then restart before seeding. See [docs/reference/local-dev.md](../../docs/reference/local-dev.md).

## Architecture

```text
src/
  domains/<vertical>/   port.ts, workflow.ts, http.ts, in-process.ts
  orchestration/        Scope routing (auth → access → school)
  bootstrap/            Minimal school, auth provision/link
  http/                 Client, catalog, bootstrap session, validation
  cleanup/              Local and staging wipe
  support/              Types, env, errors
```

- **HTTP adapters** (`domains/*/http.ts`) — call `/core/*` routes; used by CLI and staging.
- **In-process adapters** (`domains/*/in-process.ts`) — used only when tests pass a `SeedApplication` directly (faster/isolated integration tests). Not used for local dev CLI.
- **Ports** (`domains/*/port.ts`) — shared workflow contracts between HTTP and in-process adapters.
- **Bootstrap** (`http/bootstrap-http-core-session.ts`) — signs in as the school owner, calls `register-school` when needed, then provisions the seeding service account.

Seeding API keys come from `@edaya/dev-fixtures` school profiles (`seedingApiKey`). No `.env` secret required for local dev.

See [src/README.md](src/README.md) for layer rules and [seed-contract.md](seed-contract.md) for the operation inventory.

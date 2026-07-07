# Repo CLI (`bun repo`)

Canonical entry point for **development and operations** in the `edaya_backend` monorepo. **Turbo quality tasks** (`lint`, `check`, `test`, `build`, `quality`) run from the **repo root only** — never through `bun repo`.

```sh
bun repo --help
```

Implementation: `tooling/repo/cli/` — thin subprocess dispatch, no domain imports.

## Quick start

| Task | Command |
|------|---------|
| Start API + local files | `bun repo dev` |
| Full local seed | `bun repo seed` |
| Pre-PR check | `bun run verify` |
| Repo hygiene only | `bun repo verify` |
| Staging smoke | `bun repo smoke-test staging` |

## Command tree

```text
bun repo
├── dev
├── dev-container [up|build|down|logs]
├── seed [--staging] [--scope <name>] [--clean] [--repair]
│   └── clean [--staging] [--school|--auth]
├── db
│   ├── migrate <local|staging|production> [--school|--auth]
│   ├── generate [--auth]
│   └── browser <school|auth>
├── check
│   ├── openapi
│   ├── boundaries
│   └── test-naming
├── smoke-test <staging|novu|r2>
├── openapi <export|generate>
├── novu <bootstrap|cleanup> [plan|apply|validate]
├── deploy api <staging|production>
├── doctor
└── verify
```

## Development

### `bun repo dev`

Starts `@edaya/api` and `@edaya/local-files-server` (watch mode). Loads `apps/api/.env`.

### `bun repo dev-container`

Apple Container dev image for API + local-files (macOS 26, Apple silicon). Forwards to `tooling/api-dev-container/run.sh`.

```sh
bun repo dev-container          # up (default)
bun repo dev-container build
bun repo dev-container down
bun repo dev-container logs
```

Root alias: `bun run api-dev-container`.

### `bun repo seed`

Forwards argv to `tooling/seeding/scripts/seed.ts` — single parser in `@edaya/seeding`.

```sh
bun repo seed                          # local full demo seed
bun repo seed --staging                 # staging API
bun repo seed clean                    # wipe local .data
bun repo seed clean --staging          # wipe staging DB
bun repo seed clean --staging --school # school tables only
bun repo seed --scope doctor --repair  # diagnose + repair drift
bun repo seed --scope auth:link        # granular scope
```

Env: repo root `.env` — see `.env.example`. API runtime stays in `apps/api/.env`.

## Database

```sh
bun repo db migrate local
bun repo db migrate staging --auth
bun repo db migrate staging --school
bun repo db generate
bun repo db generate --auth
bun repo db browser school    # stop bun repo dev first
bun repo db browser auth
```

Migrate implementation: `tooling/db-migrate/scripts/migrate-target.ts`.

## Validation

### `bun repo check`

| Target | What it checks |
|--------|----------------|
| `openapi` | OpenAPI / generated client drift vs committed fixture |
| `boundaries` | Runtime import boundary rules |
| `test-naming` | Unit test filename conventions |

Ad-hoc: `bun repo check openapi`, `bun repo check boundaries`, `bun repo check test-naming`.

### `bun repo doctor`

Repo hygiene: tracked env files, required `.env.example` files, secret examples.

### `bun repo verify`

Repo hygiene only — **no Turbo**. Runs `doctor` and all `repo check *` targets.

1. `repo doctor`
2. `repo check openapi`
3. `repo check boundaries`
4. `repo check test-naming`

**Not included:** `lint`, `check`, `build`, `test`, `quality` (root Turbo scripts), `test:integration*`, `smoke-test *`.

### Pre-PR (`bun run verify`)

Full gate from repo root — Turbo quality + build + unit tests, then repo hygiene:

```sh
bun run verify
# = bun run quality && bun run build && turbo run test -- --dots && bun repo verify
```

CI uses `bun run verify`. For integration coverage, also run `bun run test:integration` (see [test-pyramid-plan.md](../sprints/test-pyramid-plan.md)).

## Operations

### `bun repo smoke-test`

Live environment / provider checks (not Turbo tests).

| Target | Description |
|--------|-------------|
| `staging` | Tier-1 HTTP vs deployed staging API |
| `novu` | Novu outbound + webhook e2e |
| `r2` | R2 credentials smoke |

Ad-hoc: `bun repo smoke-test staging`, `bun repo smoke-test novu`, `bun repo smoke-test r2`.

### `bun repo deploy`

```sh
bun repo deploy api staging
bun repo deploy api production
```

Runs `wrangler deploy` from `apps/api/`.

### `bun repo novu`

```sh
bun repo novu bootstrap              # plan (default)
bun repo novu bootstrap apply
bun repo novu bootstrap validate
bun repo novu cleanup
bun repo novu cleanup apply --yes
```

Implementation: `tooling/novu-ops/`. Smoke: use `bun repo smoke-test novu`.

### `bun repo openapi`

Mutating OpenAPI workflows (contrast with `repo check openapi`).

```sh
bun repo openapi export
bun repo openapi generate
```

## Turbo quality scripts

**Rule:** Turbo tasks are root-only. Do not add `lint`, `check`, `test`, `build`, `quality`, or `lint:fix` to `bun repo`.

Run across the monorepo from root:

```sh
bun run lint
bun run check
bun run test
bun run build
bun run quality
```

Package-scoped iteration:

```sh
bun --filter @edaya/core test
bun --filter @edaya/api lint
```

## Root `package.json` scripts

Turbo quality and integration slices only — no Turbo tasks in `bun repo`:

```sh
bun run verify                # quality + build + test + bun repo verify
bun run lint | check | test | build | quality | lint:fix
bun run test:coverage
bun run test:integration          # api + http
bun run test:integration:api
bun run test:integration:http
bun run test:integration:seed     # slow, opt-in
bun run api-dev-container         # alias: bun repo dev-container
```

Everything else: **`bun repo <command>`** (`bun repo --help`).

## Contributing a command

1. Add script path in `tooling/repo/cli/lib/paths.ts` (if spawning a file).
2. Add parser + dispatch under `tooling/repo/cli/`.
3. Register in `parse-repo-cli.ts` / `dispatch.ts`.
4. Add a line to this doc and `bun repo --help`.
5. Optional root alias shim in root `package.json` — **avoid**; use `bun repo` only.

**Rule:** subprocess dispatch only — no domain logic, **no Turbo shortcuts**, in `@edaya/repo` CLI.

## Related docs

- [local-dev.md](./local-dev.md) — first-time setup, seeding, troubleshooting
- [cross-repo-workflow.md](./cross-repo-workflow.md) — OpenAPI across backend + edaya_web
- [repo-cli-proposal.md](../sprints/repo-cli-proposal.md) — design rationale and migration phases

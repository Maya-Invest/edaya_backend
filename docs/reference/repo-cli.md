# Repo CLI (`bun repo`)

Canonical entry point for **development and operations** in the `edaya_backend` monorepo. Domain packages keep **Turbo quality scripts only** (`lint`, `check`, `test`, `build`, `quality`); ops commands live here.

```sh
bun repo --help
```

Implementation: `tooling/repo/cli/` — thin subprocess dispatch, no domain imports.

## Quick start

| Task | Command |
|------|---------|
| Start API + local files | `bun repo dev` (alias: `bun dev`) |
| Full local seed | `bun repo seed` |
| Pre-PR check | `bun repo verify` |
| Staging smoke | `bun repo smoke-test staging` |

## Command tree

```text
bun repo
├── dev
├── seed [--staging] [--scope <name>] [--clean] [--repair]
│   └── clean [--staging] [--school|--auth]
├── db
│   ├── migrate <local|staging|production> [--school|--auth]
│   ├── generate [--auth]
│   └── browser <school|auth>
├── check
│   ├── openapi
│   └── boundaries
├── smoke-test <staging|novu|r2>
├── openapi <export|generate>
├── novu <bootstrap|cleanup> [plan|apply|validate]
├── deploy api <staging|production>
├── doctor
└── verify
```

## Development

### `bun repo dev`

Starts `@edaya/api` and `@edaya/local-files` (watch mode). Loads `apps/api/.env`.

Alias: `bun dev`

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

Aliases: `bun seed`, `bun seed:staging`, `bun seed:doctor`, `bun seed:clean`, `bun seed:clean:staging`

Env: repo root `.env` — see `.env.example`. API runtime stays in `apps/api/.env`.

## Database

```sh
bun repo db migrate local
bun repo db migrate staging --auth
bun repo db migrate staging --school
bun repo db generate
bun repo db generate --auth
bun repo db browser school    # stop bun dev first
bun repo db browser auth
```

Aliases: `bun db:migrate:local`, `bun db:migrate:staging:auth`, `bun db:generate`, `bun db:browser:school`, etc.

Migrate implementation: `tooling/db-migrate/scripts/migrate-target.ts`.

## Validation

### `bun repo check`

| Target | What it checks |
|--------|----------------|
| `openapi` | OpenAPI / generated client drift vs committed fixture |
| `boundaries` | Runtime import boundary rules |

Aliases: `bun openapi:check`, `bun generated:check`, `bun check:boundaries`

### `bun repo doctor`

Repo hygiene: tracked env files, required `.env.example` files, secret examples.

Alias: `bun doctor`

### `bun repo verify`

Pre-PR pipeline (also used in CI):

1. `repo doctor`
2. `turbo run lint`
3. `turbo run check`
4. `turbo run build`
5. `repo check openapi`
6. `repo check boundaries`
7. `@edaya/repo` test
8. `turbo run test`

**Not included:** full HTTP demo seed (`scope: all`), `smoke-test *`.

Alias: `bun run verify`

## Operations

### `bun repo smoke-test`

Live environment / provider checks (not Turbo tests).

| Target | Description |
|--------|-------------|
| `staging` | Tier-1 HTTP vs deployed staging API |
| `novu` | Novu outbound + webhook e2e |
| `r2` | R2 credentials smoke |

Aliases: `bun smoke:staging`, `bun novu:smoke`, `bun test:r2`

### `bun repo deploy`

```sh
bun repo deploy api staging
bun repo deploy api production
```

Runs `wrangler deploy` from `apps/api/`.

Aliases: `bun deploy:api:staging`, `bun deploy:api:production`

### `bun repo novu`

```sh
bun repo novu bootstrap              # plan (default)
bun repo novu bootstrap apply
bun repo novu bootstrap validate
bun repo novu cleanup
bun repo novu cleanup apply --yes
```

Implementation: `tooling/novu-ops/`. Smoke: use `bun repo smoke-test novu`.

Aliases: `bun novu:bootstrap`, `bun novu:bootstrap:apply`, etc.

### `bun repo openapi`

Mutating OpenAPI workflows (contrast with `repo check openapi`).

```sh
bun repo openapi export
bun repo openapi generate
```

Aliases: `bun export-openapi`, `bun openapi:generate`, `bun generated:update`

## Turbo quality scripts

Workspace packages expose quality tasks only. Run across the monorepo from root:

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

## Root alias reference

| Root alias | `bun repo` equivalent |
|------------|------------------------|
| `bun dev` | `bun repo dev` |
| `bun seed` | `bun repo seed` |
| `bun seed:staging` | `bun repo seed --staging` |
| `bun seed:clean` | `bun repo seed clean` |
| `bun seed:clean:staging` | `bun repo seed clean --staging` |
| `bun doctor` | `bun repo doctor` |
| `bun run verify` | `bun repo verify` |
| `bun openapi:check` | `bun repo check openapi` |
| `bun check:boundaries` | `bun repo check boundaries` |
| `bun smoke:staging` | `bun repo smoke-test staging` |
| `bun db:migrate:local` | `bun repo db migrate local` |
| `bun deploy:api:staging` | `bun repo deploy api staging` |

Full inventory: [repo-cli-proposal.md](../sprints/repo-cli-proposal.md) appendix A.

## Contributing a command

1. Add script path in `tooling/repo/cli/lib/paths.ts` (if spawning a file).
2. Add parser + dispatch under `tooling/repo/cli/`.
3. Register in `parse-repo-cli.ts` / `dispatch.ts`.
4. Add a line to this doc and `bun repo --help`.
5. Optional root alias shim in root `package.json`.

**Rule:** subprocess dispatch only — no domain logic in `@edaya/repo` CLI.

## Related docs

- [local-dev.md](./local-dev.md) — first-time setup, seeding, troubleshooting
- [cross-repo-workflow.md](./cross-repo-workflow.md) — OpenAPI across backend + edaya_web
- [repo-cli-proposal.md](../sprints/repo-cli-proposal.md) — design rationale and migration phases

# Repo CLI (`bun repo`)

Canonical entry point for **development and operations** in the `edaya_backend` monorepo. **Turbo quality tasks** (`lint`, `check`, `test`, `build`, `quality`) run from the **repo root only** — never through `bun repo`.

```sh
bun repo --help
```

Implementation: `tooling/repo/cli/` — thin subprocess dispatch, no domain imports.

## Quick start

| Task | Command |
|------|---------|
| Start identity + API + local files | `bun repo dev` |
| Full local seed | `bun repo seed` |
| Pre-PR check (verify job) | `bun run verify` |
| PR CI locally (verify + integration) | `bun repo verify --full` |
| Repo hygiene only | `bun repo verify` |
| Staging smoke | `bun repo smoke-test staging` |

## Command tree

```text
bun repo
├── dev
├── seed [--staging] [--scope <name>] [--clean] [--repair]
│   └── clean [--staging]
├── db
│   ├── migrate <local|staging|production>
│   ├── generate
│   └── browser school
├── check
│   ├── openapi
│   ├── boundaries
│   └── test-naming
├── smoke-test <staging|notify|r2>
├── openapi <export|generate>
├── codegen <generate|check> [options]
├── identity-migrate
├── identity-wipe <local|staging> [--yes]
├── deploy api <staging|production>
├── doctor
└── verify [--full]
```

## Development

### `bun repo dev`

Starts the API (including Account authentication) and the local file server directly with Bun in watch mode. Loads `apps/api/.env` for the API and files. Use `bun repo seed` to populate local development data.

### `bun repo seed`

Forwards argv to `tooling/seeding/scripts/seed.ts` — single parser in `@edaya/seeding`.

```sh
bun repo seed                          # local full demo seed
bun repo seed --staging                 # staging API
bun repo seed clean                    # wipe local school .data
bun repo seed clean --staging          # wipe staging school DB
bun repo seed --scope doctor --repair  # diagnose + repair drift
bun repo seed --scope auth:link        # granular scope
```

Env: repo root `.env` — see `.env.example`. API runtime stays in `apps/api/.env`.

## Database

```sh
bun repo db migrate local
bun repo db migrate staging
bun repo db reset staging --yes      # drop schemas + re-apply school migrations
bun repo db reset production --yes   # destructive — production only
bun repo db flatten                  # squash school migrations to one baseline
bun repo db generate
bun repo db browser school    # stop bun repo dev first
```

`db reset` drops `drizzle`, `notify`, and `public` schemas, then re-applies school + notify migrations. After staging reset, run `bun repo seed --staging`. Identity users are wiped from `edaya_identity` (`bun repo db wipe staging`).

Migrate / reset implementation: `tooling/repo/db/school/`. Identity commands live in `tooling/repo/db/identity/`:

```sh
bun repo identity-migrate                 # AUTH_DATABASE_URL or staging/production variants
bun repo identity-wipe local --yes        # stop identity before deleting local data
bun repo identity-wipe staging --yes      # guarded staging identity cleanup
```

These commands keep school and identity databases separate. The low-level generator is available through `bun repo codegen generate|check --input <file|url> ...`; `bun repo openapi generate` remains the usual repository workflow.

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

**Not included (default):** `lint`, `check`, `build`, `test`, `quality`, `test:integration*`, `smoke-test *`.

```sh
bun repo verify --full
```

Local **PR blocking** gate: hygiene + `quality` + `build` + unit `test` + `test:integration` (same as `_verify.yml` then `_integration.yml`). Omits informational coverage (`_coverage.yml`).

### Pre-PR (`bun run verify`)

Default gate from repo root — repo hygiene first, then Turbo quality + build + unit tests (no integration):

```sh
bun run verify
# = bun repo verify && bun run quality && bun run build && turbo run test -- --dots
```

CI verify job uses `bun run verify`. PR workflows also run `bun run test:integration` afterward — use `bun repo verify --full` to run both locally. See [test-pyramid-plan.md](../sprints/test-pyramid-plan.md).

## Operations

### `bun repo smoke-test`

Live environment / provider checks (not Turbo tests).

| Target | Description |
|--------|-------------|
| `staging` | Tier-1 HTTP vs deployed staging API |
| `notify` | In-process notify announcement + delivery-event e2e against the school API |
| `r2` | R2 credentials smoke |

Ad-hoc: `bun repo smoke-test staging`, `bun repo smoke-test notify`, `bun repo smoke-test r2`.

### `bun repo deploy`

```sh
bun repo deploy api staging
bun repo deploy api production
```

Runs `wrangler deploy` from `apps/api/`.

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
bun run verify                # bun repo verify + quality + build + test
bun repo verify --full        # above + test:integration (PR blocking CI)
bun run lint | check | test | build | quality | lint:fix
bun run test:coverage
bun run test:integration          # api + http
bun run test:integration:api
bun run test:integration:http
bun run test:integration:seed     # slow, opt-in
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

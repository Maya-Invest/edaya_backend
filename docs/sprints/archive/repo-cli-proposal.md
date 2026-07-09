# `@edaya/repo` CLI — Brainstorming Proposal

> **Status:** Draft — **agreed principles** (updated 2026-07-05)  
> **Created:** 2026-07-04  
> **Scope:** Centralize dev/ops entry points behind a single `bun repo` command  
> **Out of scope (for now):** Moving domain logic into `@edaya/repo`, cross-repo CLI (`edaya_web`)  
> **Related:** [local-dev.md](../reference/local-dev.md), [deploy-staging.md](../reference/deploy-staging.md), `tooling/repo/`, `tooling/seeding/`

---

## 0. Agreed principles (2026-07-05)

Three places to look for scripts:

| Layer | Responsibility |
|-------|----------------|
| **Domain packages** | Logic, libs, utils + **Turbo quality scripts only** (`test`, `lint`, `lint:fix`, `check`, `build`, `quality`, …) |
| **`bun repo`** | All **operational** commands (dev, seed, db, deploy, smoke, openapi, doctor, verify, …) |
| **Root `package.json`** | `repo` entry + **convenient aliases** (`dev`, `seed`, …) + **Turbo orchestration** for quality |

**Not in package `package.json` (public):** `seed:*`, `migrate:*`, `deploy:*`, `smoke:*`, `doctor`, `openapi:*`, etc. Those are invoked by `bun repo …` (spawn into the package’s script entry or TS file). Implementation may remain in the package on disk for cwd/path reasons — it is just not part of the Turbo graph or contributor mental model.

### Allowed package scripts (Turbo graph)

Every workspace package exposes **only** quality tasks, e.g.:

```json
{
  "scripts": {
    "check": "tsc --noEmit",
    "lint": "eslint …",
    "lint:fix": "eslint … --fix",
    "test": "bun test …",
    "quality": "bun run lint && bun run check",
    "build": "…"
  }
}
```

`turbo.json` pipelines reference **only** these names. No `seed`, `migrate`, or `smoke` tasks in Turbo.

### Root `package.json` (target)

```json
{
  "scripts": {
    "repo": "bun tooling/repo/cli/main.ts",

    "dev": "bun repo dev",
    "seed": "bun repo seed",
    "verify": "bun repo verify",

    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "check": "turbo run check",
    "build": "turbo run build",
    "test": "turbo run test",
    "quality": "turbo run quality"
  }
}
```

### Testing placement rule

| Kind | Where it lives | How it runs |
|------|----------------|-------------|
| **Unit tests** | Domain package `test` suite — e.g. `@edaya/seeding` port workflows, CLI parse, mocked HTTP | `turbo run test` |
| **HTTP slice tests** | **`@edaya/integration-tests`** — embedded route app, one seed scope per file, light bootstrap (§1b) | `@edaya/integration-tests` `test` → Turbo |
| **PGlite service journeys** | **`@edaya/integration-tests`** — in-process workflows (auth, services, routes, …) | same `test` script → Turbo |
| **Provider / external smoke** | Implementation in domain packages; **entry** via **`bun repo smoke-test <provider>`** | Ad-hoc ops + optional deploy gates |
| **Repo hygiene checks** | Implementation in `tooling/repo`; **entry** via **`bun repo check …`** | `repo verify` and ad-hoc |

**Examples:**

- `@edaya/seeding` — **unit tests only** → `turbo run test`  
- `@edaya/integration-tests` — PGlite journeys **+ HTTP seed slice tests** → `turbo run test`  
- Full demo HTTP seed (`scope: all`) — **not** in Turbo; see §1b  
- `repo check boundaries`, `repo check openapi` → `repo verify` steps  
- `repo smoke-test staging`, `repo smoke-test novu`, `repo smoke-test r2` → external/provider verification (not unit tests)

### CLI conventions (agreed 2026-07-05)

#### 1. `seed` uses `--remote` (flag, not subcommand)

Target selection is always a **flag**, not a positional `staging` / `remote` subcommand:

| Intent | Command |
|--------|---------|
| Full local seed | `bun repo seed` |
| Full remote seed | `bun repo seed --remote` |
| Wipe local `.data` | `bun repo seed clean` |
| Wipe staging DB | `bun repo seed clean --remote` |
| Doctor (local API) | `bun repo seed --scope doctor` |
| Doctor + repair | `bun repo seed --scope doctor --repair` |

`--remote` sets `SEED_REMOTE_*` target for any seed operation that talks to an API or infers cleanup target. **No** `seed remote`, **no** `seed clean staging`.

> **Follow-up:** align `tooling/seeding/scripts/seed.ts` and root aliases (`seed:remote`, `seed:clean:staging`) with this before or during Phase 1.

#### 1b. HTTP testing pyramid

**Agreed concern:** some HTTP coverage is valuable; **full demo seed (`scope: all`) as an automated integration test is overkill** for every PR.

**Agreed placement (2026-07-05):** HTTP slice tests stay in **`@edaya/integration-tests`** — same package as PGlite journeys, using the existing embedded route harness. `@edaya/seeding` keeps **unit tests only** (logic under test; HTTP wiring exercised via integration-tests).

Today: `bun verify` does **not** run `test:integration-seeds`; only the opt-in `test:seeds` script runs `src/seed/slow/*` (~2+ minutes).

**Target layers:**

| Layer | Package | Runs in `turbo test`? | Proves |
|-------|---------|------------------------|--------|
| **Unit** | `@edaya/seeding` (and other domains) | Yes | Port workflows, CLI parse, doctor repair order, mocked `fetch` |
| **HTTP slice** | `@edaya/integration-tests` | Yes | Seed HTTP adapters + `/core/*` + auth cookies/origin — **one scope per file** |
| **HTTP light bootstrap** | `@edaya/integration-tests` | Yes (fast) | `runIntegrationLightSchoolSeed` + HTTP assertions — no full demo dataset |
| **PGlite service journey** | `@edaya/integration-tests` | Yes | Domain workflows in-process |
| **Full demo seed** | — (ops) | **No** | `repo seed` / `smoke-test staging` / optional slow gate |

**Where full demo seed belongs:**

- **Operator:** `bun repo seed` / `bun repo seed --remote`
- **Post-deploy:** `bun repo smoke-test staging`
- **Optional slow gate:** `test:slow` in integration-tests or `repo test seed-slow` — explicit, not default `verify`

**Refactor `integration-tests/src/seed/slow/` (stay in package):**

| File | Action |
|------|--------|
| `auth-seed.test.ts` | Keep → HTTP slice (already scoped) |
| `doctor-scope.test.ts`, `validate-scope.test.ts` | Refactor → light bootstrap, not shared `scope: all` `beforeAll` |
| `http-seed.test.ts` | Remove from default `test` script; optional `test:slow` only or delete |

**Principle:** `@edaya/seeding` = seed **logic**. `@edaya/integration-tests` = seed **HTTP integration** (what it is). Full demo seed = **ops**.

#### 2. `check` verb for all validation

Group read-only validation under **`repo check`** (consistent with `repo check boundaries`):

| Today | Proposed |
|-------|----------|
| `openapi:check` | `bun repo check openapi` |
| `check:boundaries` | `bun repo check boundaries` |

Mutating OpenAPI workflows stay under **`repo openapi`** (write ops):

| Today | Proposed |
|-------|----------|
| `export-openapi` | `bun repo openapi export` |
| `openapi:generate` | `bun repo openapi generate` |

#### 3. `smoke-test` for provider / external verification

All **live environment / provider** smoke checks use one command family:

```text
bun repo smoke-test staging    # tier-1 HTTP vs deployed staging API
bun repo smoke-test novu       # Novu outbound + webhook e2e
bun repo smoke-test r2         # R2 credentials / CORS (today: test:r2, configure:r2-cors)
```

- **Dispatch only** in `@edaya/repo` — implementation scripts stay in the owning package (`integration-tests`, `novu-ops`, `tooling/repo`, …).
- Not Turbo tasks; not mixed with unit tests.
- `repo verify` may call a **subset** (e.g. `check openapi` + turbo `test`); full `smoke-test staging` remains a **post-deploy** operator command.

### Resolved nuances

| # | Topic | Decision |
|---|--------|----------|
| 1 | **`apps/api` deploy** | Keep Wrangler scripts in `apps/api` as **implementation** (cwd/secrets). Public entry: `bun repo deploy api staging` only. |
| 2 | **`@edaya/repo` package scripts** | Package `package.json` keeps quality scripts only. `doctor`, `openapi`, `db:browser` become **CLI commands**, not npm scripts. |
| 3 | **`verify`** | Lives under **`bun repo verify`**. Root `"verify": "bun repo verify"` is the convenience alias. |
| 4 | **Tests** | Unit → domain packages (`@edaya/seeding` = unit only); HTTP seed slices + PGlite → **`@edaya/integration-tests`**; provider smoke → **`repo smoke-test`**; repo hygiene → **`repo check`** + verify. |
| 5 | **Turbo** | Pipeline tasks = quality only (`test`, `lint`, `check`, `build`, …). |
| 6 | **`seed --remote`** | Flag for remote API / staging target (including `seed clean --remote`). |
| 7 | **`check` verb** | `repo check openapi`, `repo check boundaries` (not `repo openapi check`). |
| 8 | **`smoke-test`** | Single entry for provider/external smoke (`staging`, `novu`, `r2`, …). |
| 9 | **`@edaya/integration-tests` scope** | **PGlite service journeys + HTTP seed slice tests.** Provider smoke moves to `repo smoke-test`; staging impl may leave the package. |
| 10 | **HTTP seed tests** | Slices in **integration-tests** → Turbo; **full `scope: all` not in Turbo** → ops / optional `test:slow`. |

---

## 1. Problem statement

### Current state

Dev workflows are spread across the **root `package.json`** and **six+ tooling packages**:

```text
bun dev                    → tooling/repo/dev/start-local-dev.ts
bun seed*                  → tooling/seeding/scripts/*
bun db:migrate:*           → @edaya/db-migrate
bun db:browser:*           → @edaya/repo
bun doctor / verify        → @edaya/repo (+ turbo)
bun smoke:staging          → @edaya/integration-tests
bun novu:*                 → @edaya/novu-ops
bun deploy:api:*           → apps/api
bun openapi:*              → @edaya/repo
```

Each package owns the **right** logic. The pain is at the **surface**:

| Issue | Example | Impact |
|-------|---------|--------|
| No single discoverability | Is health check `bun seed:doctor` or `bun doctor` or `bun smoke:staging`? | Onboarding friction, stale docs |
| Root script sprawl | ~25 dev scripts in root `package.json` | Hard to see what’s “official” vs legacy |
| Inconsistent argv patterns | `seed:clean:staging` vs `seed --remote --clean` vs `db:migrate:staging:auth` | Muscle memory doesn’t transfer |
| Docs drift | README, local-dev, deploy-staging, package READMEs | We just fixed seeding env + commands; root still lists old names |
| `@edaya/repo` is already half a CLI | `doctor`, `db:browser`, `openapi`, `dev` — but not named or structured as one tool | Missed opportunity for cohesion |

Recent seeding cleanup (5 env vars, 6 public commands, `--scope` for power users) shows the direction: **narrow public contract, rich internals**. The root monorepo still needs the same treatment at one level up.

### What we are *not* trying to fix

- Package boundaries (`@edaya/seeding`, `@edaya/db-migrate`, `apps/api` stay authoritative).
- Turbo’s role as the **quality graph** across workspaces (`test`, `lint`, `check`, `build`).
- Production runtime (Wrangler, Workers) — CLI is for **operators and local dev**.

---

## 2. Proposal (one sentence)

Introduce **`bun repo <group> <command> [flags]`** as a **thin dispatcher**: parse argv, print help, forward to existing scripts/packages. **Logic stays in domain packages; only Turbo quality scripts remain on packages; ops commands live under `repo` and root aliases.**

---

## 3. Goals

| # | Goal |
|---|------|
| G1 | **One help tree** — `bun repo --help` lists all supported dev/ops workflows |
| G2 | **Thin facade** — `@edaya/repo` does not import seeding workflows, migration SQL, or API handlers |
| G3 | **Stable public verbs** — `check` for validation, `smoke-test` for provider smoke, `--remote` for seed target |
| G4 | **Package scripts = Turbo only** — ops scripts removed from workspace `package.json` public surface |
| G5 | **Root = front door** — `repo` + short aliases + `turbo run *` for quality |
| G6 | **Consistent UX** — shared patterns for `--help`, env hints, exit codes, error messages |

## 4. Non-goals

- Putting domain business logic in `@edaya/repo` (dispatch and verify orchestration only).
- Becoming a general task runner beyond verify (Turbo owns parallel quality).
- Bundling/installing a global binary (stay `bun repo` from repo root).
- Merging `edaya_web` deploy commands in v1 (optional later: `repo deploy webapp`).

---

## 5. Command tree (draft)

```text
bun repo
├── dev                          # API + local-files
├── dev worker                   # wrangler dev smoke
├── cron local
│
├── seed [--remote]              # full seed (default local)
│   ├── clean [--remote]         # wipe local .data or staging DB
│   └── --scope <name>           # granular: auth:link, doctor, validate, …
│       └── --repair             # with --scope doctor
│
├── db
│   ├── migrate local|staging|production [--pg|--auth]
│   ├── generate [--auth]
│   └── browser school|auth
│
├── check
│   ├── boundaries             # runtime boundary rules
│   └── openapi                # OpenAPI drift vs committed fixture
│
├── smoke-test
│   ├── staging                # tier-1 HTTP vs deployed staging API
│   ├── novu                   # Novu outbound + webhook e2e
│   └── r2                     # R2 credentials / CORS ops smoke
│
├── openapi
│   ├── export
│   └── generate
│
├── novu bootstrap|…           # Novu ops (non-smoke); smoke → smoke-test novu
├── deploy api staging|production
├── doctor                       # repo hygiene (env examples, tracked secrets, …)
└── verify                       # pre-PR pipeline (see below)
```

`repo verify` (draft steps):

```text
1. repo doctor
2. turbo run lint
3. turbo run check
4. turbo run build
5. repo check openapi
6. repo check boundaries
7. turbo run test                  # @edaya/seeding unit; integration-tests PGlite + HTTP seed slices
```

**Explicitly not in default verify:** full HTTP demo seed (`scope: all`), `repo smoke-test *`.

### Mapping from today → proposed

| Today | Proposed |
|-------|----------|
| `bun dev` | `bun repo dev` |
| `bun seed` | `bun repo seed` |
| `bun seed:remote` | `bun repo seed --remote` |
| `bun seed:doctor --repair` | `bun repo seed --scope doctor --repair` |
| `bun seed:clean:staging` | `bun repo seed clean --remote` |
| `bun db:migrate:staging:auth` | `bun repo db migrate staging --auth` |
| `bun smoke:staging` | `bun repo smoke-test staging` |
| `bun novu:smoke` | `bun repo smoke-test novu` |
| `bun test:r2` | `bun repo smoke-test r2` |
| `bun openapi:check` | `bun repo check openapi` |
| `bun check:boundaries` | `bun repo check boundaries` |
| `bun test:integration-seeds` | Fold into `@edaya/integration-tests` `test` (slices only); drop separate root script |
| `bun doctor` | `bun repo doctor` |
| `bun verify` | `bun repo verify` |

**Resolved:** seed target = `--remote` flag; validation under `repo check`; provider smoke under `repo smoke-test`.

---

## 6. Architecture

### 6.1 Thin dispatcher (recommended)

```mermaid
flowchart LR
  subgraph CLI["@edaya/repo cli"]
    MAIN[main.ts]
    PARSE[argv + help]
    DISP[dispatch]
  end

  subgraph Packages["Focused packages — unchanged logic"]
    SEED[@edaya/seeding]
    DB[@edaya/db-migrate]
    API[apps/api]
    IT[@edaya/integration-tests]
    NOVU[@edaya/novu-ops]
  end

  MAIN --> PARSE --> DISP
  DISP -->|spawn / import entry| SEED
  DISP --> DB
  DISP --> API
  DISP --> IT
  DISP --> NOVU
```

**Dispatch strategies (per command):**

| Strategy | When | Example |
|----------|------|---------|
| **Spawn script** | Self-contained TS entry | `bun tooling/seeding/scripts/seed.ts` + forwarded argv |
| **Spawn package script** | Implementation script not in Turbo graph | `bun apps/api/...` for wrangler cwd |
| **Inline orchestration** | Multi-step pipeline | `repo verify`, `repo doctor` |

**Rule:** prefer **subprocess dispatch**; no domain logic imports in `cli/`.

### 6.2 Proposed layout

```text
tooling/repo/
  cli/
    main.ts                 # entry: bun tooling/repo/cli/main.ts
    registry.ts             # command → handler map
    commands/
      dev.ts
      seed.ts
      db.ts
      check.ts
      smoke-test.ts
      deploy.ts
      openapi.ts
      doctor.ts
      verify.ts
    lib/
      spawn.ts              # repo-root resolution, exit code propagation
      help.ts               # format help tree
  ci/                       # existing
  dev/                      # existing scripts (called by cli)
  lib/                      # existing
  openapi/                  # existing (invoked by cli, not package.json scripts)
```

Root `package.json` — **agreed target** (see §0). During migration, extra root aliases may remain as one-line `bun repo …` shims until docs and CI catch up.

---

## 7. CLI implementation options

| Option | Pros | Cons |
|--------|------|------|
| **A. Hand-rolled argv** (like `parse-seed-cli.ts`) | Zero deps, matches seeding style | Verbose for nested subcommands |
| **B. `citty` / `mri` / small parser** | Nice nested help, used in Nuxt ecosystem | New dependency |
| **C. `commander`** | Familiar | Heavier; overkill for internal CLI |

**Lean recommendation:** start with **hand-rolled** registry + `citty` only if nested help becomes painful in PR 2.

---

## 8. Phased rollout

### Phase 0 — Skeleton (1 PR) ✅

- [x] `cli/main.ts` + `registry.ts` + `--help`
- [x] Dispatch: `dev`, `seed`, `doctor` only
- [x] Root: `"repo": "bun tooling/repo/cli/main.ts"`, keep all existing scripts

### Phase 1 — Seed + DB (1 PR) ✅

- [x] `repo seed` forwards argv (`--remote`, `clean`, `--scope`, …) to `tooling/seeding/scripts/seed.ts`
- [x] **Seeding CLI:** replace `seed:remote` / `seed:clean:staging` with `--remote` on `seed` / `seed clean`
- [x] **Refactor** `integration-tests/src/seed/slow/*` — HTTP slices stay in package; light bootstrap; fold into default `test` (drop `test:seeds` / root `test:integration-seeds` → `test:slow` shim)
- [x] `@edaya/seeding` — unit tests only (no HTTP slice relocation)
- [x] `repo db migrate|browser|generate` → db-migrate + existing repo scripts

### Phase 2 — Ops + CI (1 PR) ✅

- [x] `repo check openapi|boundaries`, `repo smoke-test staging|novu|r2`, `repo verify` (orchestration per §5)
- [x] `repo deploy api staging|production` → spawn `apps/api` wrangler scripts
- [x] `repo novu *` → novu-ops (bootstrap/cleanup; smoke via `smoke-test novu`)
- [x] Strip ops scripts from workspace `package.json` files (keep quality + hidden impl paths if needed)

### Phase 3 — Docs + cleanup (1 PR) ✅

- [x] Single doc: `docs/reference/repo-cli.md`
- [x] Trim root README to quality + aliases table
- [x] CI uses `bun repo verify` only (no parallel root verify implementation)
- [x] `turbo.json` — quality tasks only

### Phase 4 — Polish (optional)

- [ ] Shell completion (zsh/fish)
- [ ] `REPO_DEBUG=1` for dispatch logging

---

## 9. Tradeoffs

### Benefits

- **Discoverability** — one `--help` for new contributors
- **Cohesion** — `@edaya/repo` name matches its expanded role
- **Docs** — seeding/env simplification pairs naturally with CLI simplification
- **CI readability** — `bun repo verify` is self-documenting in workflows

### Costs

- **Indirection** — one more hop when debugging (“which script actually ran?”)
- **Migration** — docs, muscle memory, possibly CI YAML
- **Ownership** — repo package becomes gatekeeper; needs clear contribution rules (“add command = add registry entry + doc line”)

### Risks & mitigations

| Risk | Mitigation |
|------|------------|
| God package | Subprocess-first dispatch; no domain imports |
| Flag drift between `repo seed` and seeding CLI | Forward argv verbatim; single parser in `@edaya/seeding` |
| Two sources of truth for command list | `registry.ts` is canonical; generate doc table from registry (later) |
| Breaking external scripts | Keep root aliases as shims |

---

## 10. Open questions (remaining)

1. **Binary name** — `repo` vs `edaya`? (**Default: `repo`**.)
2. **Root aliases** — keep `dev` / `seed` forever or document only `bun repo`? (**Default: keep short aliases.**)
3. **Cross-repo** — `repo deploy webapp` shell out to `edaya_web` sibling, or stay backend-only in v1?
4. **Env loading** — top-level `repo` preload of `apps/api/.env` + `tooling/seeding/.env`, or leave to each dispatched script?
5. **Publishing** — installable `@edaya/repo` CLI vs always `bun tooling/repo/cli/main.ts`?
6. **`@edaya/integration-tests` package layout** — `src/seed/http/` for slice tests vs `src/seed/slow/` naming? (**Default: keep under `src/seed/`, refactor in place.**)

**Resolved:** deploy in `apps/api`; repo package quality-only scripts; `verify` under `repo`; Turbo quality-only; `seed --remote`; `repo check *`; `repo smoke-test *`; `@edaya/seeding` unit only; integration-tests = PGlite + HTTP seed slices; full `scope: all` not in Turbo.

---

## 11. Alternatives considered

| Alternative | Why not (for now) |
|-------------|-------------------|
| **Turbo as CLI** | Great for task graphs, weak for nested help and human-facing ops verbs |
| **Just document root scripts** | Doesn’t reduce sprawl; we already drift |
| **Makefile** | Extra tool; poor Windows ergonomics; team is on bun |
| **mise/direnv tasks** | Environment-focused; doesn’t replace package dispatch |
| **Move everything into apps/api** | Wrong boundary; seeding/db don’t belong in API app |

---

## 12. Success criteria

- [x] `bun repo --help` documents ≥90% of daily dev commands (dev, seed, db migrate local, doctor, verify)
- [x] No new domain logic in `@edaya/repo` (review checklist in PR template)
- [x] Workspace packages expose **only** Turbo quality scripts (no public ops scripts)
- [x] `turbo.json` lists quality tasks only
- [ ] `bun repo verify` passes on clean clone (parity with today’s `bun verify`)

---

## 13. Suggested next step

**Spike PR (Phase 0):** ~200 lines — `main.ts`, registry, `dev` + `seed` + `doctor` dispatch, no root script removals. Team tries it for a week before committing to Phase 1–3.

---

## Appendix A — Current root dev scripts (inventory)

For migration tracking:

```text
dev, dev:worker, cron:local
seed, seed:remote, seed:doctor, seed:clean, seed:clean:staging
smoke:staging, test:integration-seeds
doctor, verify
db:generate, db:generate:auth, db:migrate:* (9 variants)
db:browser:school, db:browser:auth
novu:* (6 scripts)
deploy:api:staging, deploy:api:production
export-openapi, openapi:generate, openapi:check, generated:*
test:r2, configure:r2-cors, check:boundaries
```

## Appendix B — Seeding CLI alignment (target)

Current seeding surface (pre-`--remote` cleanup):

```text
bun seed | seed:remote | seed:doctor | seed:clean | seed:clean:staging
bun seed --scope <name>
```

**Target** (matches `repo seed` forwarding):

```text
bun seed                          # local full seed
bun seed --remote                 # remote full seed
bun seed clean                    # wipe local
bun seed clean --remote           # wipe staging
bun seed --scope doctor [--repair]
bun seed --scope <name>           # granular
```

`repo seed` is a thin forwarder — **one parser** in `@edaya/seeding`, not two.

## Appendix C — `@edaya/integration-tests` layout (target)

**Package role:** in-process **integration** — PGlite service journeys **and** HTTP seed slice tests (embedded route app). Not CLI ops, not live staging smoke.

```text
src/
  services/              # PGlite — lifecycle, tenant boundaries, atomic workflows
  auth/                  # PGlite — session, access control, concurrency
  routes/                # PGlite — route-level tests
  adaptor/               # PGlite — jsonb validation
  runtime/               # PGlite — persistence
  seed/
    contract.test.ts     # seed contract / manifest (stays)
    http/                # HTTP slice tests (refactor from seed/slow/)
      auth.test.ts
      doctor.test.ts
      validate.test.ts
      access.test.ts
    slow/                # optional: full scope:all — test:slow only, not default test
  support/               # harnesses (api-route-harness, http-seed-client, …)
```

**Moves out of package (ops → `repo`):**

| Today | Destination |
|-------|-------------|
| `src/staging/*` | `repo smoke-test staging` |
| `smoke/novu-e2e.ts` | `repo smoke-test novu` |

**`@edaya/seeding`:** unit tests only (`src/`, `tests/`). No HTTP slice tests — consumes `@edaya/seeding/http` from integration-tests when exercising adapters.

**Default `test` script includes:** PGlite journeys + `src/seed/http/*` + `contract.test.ts`. **Excludes** `src/seed/slow/*` (full demo seed).

# `@edaya/seeding` source layout

HTTP-first seed orchestration. Fixture data lives in `@edaya/fixtures`; this package owns ports, workflows, and CLI/runtime wiring.

## Layers

```text
src/
  domains/           # One folder per school vertical (port / workflow / http / in-process)
  transport/
    http/              # Low-level HTTP client, catalog, entity/command helpers
  diagnostics/       # Doctor, validation, profile-photo preflight
  runtime/           # HTTP scope orchestrator and per-scope handlers (PR4)
    scopes/          # doctor, validate, auth, smoke, all-fresh-bootstrap, domain-seed
  orchestration/     # Shared scope routers (auth → access → full school seed)
  bootstrap/         # Auth provision, session bootstrap, service account, minimal school
    auth/              # HTTP + handler auth provisioners, staging user repair
    session/           # Owner session bootstrap, local dev error hints
  http/              # Runtime: orchestrator, auth, bootstrap session, service account
  cleanup/           # Local `.data/` wipe and staging DB reset
  support/           # Types, env loading, repo-root resolution, shared errors
  index.ts           # In-process ports + orchestrators (test / harness use)
```

## Per-domain pattern

Each folder under `domains/<name>/`:

| File | Role |
|------|------|
| `port.ts` | Contract shared by HTTP and in-process adapters |
| `workflow.ts` | Fixture-driven steps using the port |
| `adapters/http.ts` | Calls `/core/*` via `HttpSeedClient` |
| `adapters/in-process.ts` | Fast path when tests pass `SeedApplication` directly |
| `port-workflow.test.ts` | Port/workflow unit tests (optional for new domains) |

## Where to put new code

| Kind | Location |
|------|----------|
| New seeded vertical | `domains/<context>/` (`port.ts`, `workflow.ts`, `adapters/*`) |
| New seed scope or orchestration step | `orchestration/` |
| Auth account creation / subject linking | `bootstrap/` |
| HTTP client, catalog, entity/command helpers | `transport/http/` |
| Doctor, validation, profile-photo preflight | `diagnostics/` |
| HTTP scope orchestrator | `runtime/` |
| Shared seed scope routing (domain workflows) | `orchestration/` |
| Env / shared types / errors | `support/` |
| Wipe or cleanup guard | `cleanup/` |

## Dependency rules

- **CLI / staging** — always HTTP (`domains/*/adapters/http.ts` + `transport/http/` + `runtime/`). Never construct a proxy `SeedApplication` in scripts.
- **Integration tests** — prefer `@edaya/seeding/http`; use `@edaya/seeding` in-process ports only when the harness provides `SeedApplication`.
- **Imports** — use `@edaya/core` and `@edaya/fixtures` barrels; do not deep-import domain-core paths.
- **Transport shims** — `http/client.ts`, `domains/*/http.ts`, etc. re-export from canonical paths during the folder migration.

See [seed-contract.md](../seed-contract.md) for the operation inventory and [README.md](../README.md) for CLI commands.

# `@edaya/seeding` source layout

HTTP-first seed orchestration. Fixture data lives in `@edaya/dev-fixtures`; this package owns ports, workflows, and CLI/runtime wiring.

## Layers

```text
src/
  domains/           # One folder per school vertical (port / workflow / http / in-process)
  orchestration/     # Scope routers: auth → access → full school seed
  bootstrap/         # Minimal school, Better Auth provision/link helpers
  http/              # Shared HTTP client, catalog, bootstrap session, validation
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
| `http.ts` | Calls `/core/*` via `HttpSeedClient` |
| `in-process.ts` | Fast path when tests pass `SeedApplication` directly |
| `port-workflow.test.ts` | Port/workflow unit tests (optional for new domains) |

## Where to put new code

| Kind | Location |
|------|----------|
| New seeded vertical | `domains/<context>/` (all four files above) |
| New seed scope or orchestration step | `orchestration/` |
| Auth account creation / subject linking | `bootstrap/` |
| HTTP helper (client, catalog, bootstrap) | `http/` |
| Env / shared types / errors | `support/` |
| Wipe or cleanup guard | `cleanup/` |

## Dependency rules

- **CLI / staging** — always HTTP (`domains/*/http.ts` + `http/`). Never construct a proxy `SeedApplication` in scripts.
- **Integration tests** — prefer `@edaya/seeding/http`; use `@edaya/seeding` in-process ports only when the harness provides `SeedApplication`.
- **Imports** — use `@edaya/core` and `@edaya/dev-fixtures` barrels; do not deep-import domain-core paths.

See [seed-contract.md](../seed-contract.md) for the operation inventory and [README.md](../README.md) for CLI commands.

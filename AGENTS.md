# Agent guidance

Backend monorepo (`edaya_backend`): API, cron, domain packages, adaptors, seeding, and integration tests.

Web frontends live in the sibling **[edaya_web](../edaya_web)** repo. For UI work there, follow `edaya_web/AGENTS.md` and `edaya_web/docs/specs/`.

## Architecture

- **Ports and adapters** — business rules in `@edaya/core`; Postgres in `@edaya/adaptor-postgres`; auth persistence in `@edaya/adaptor-auth`; Novu gateway in `@edaya/adaptor-novu`; migration CLI in `@edaya/db-migrate`; Novu ops CLI in `@edaya/novu-ops`; HTTP/runtime wiring in `apps/api`.
- **Boundary rule** — `package/domain-core`, `package/adaptor-postgres`, and adaptor packages never depend on `apps/` or `tooling/`.

## Key docs

| Topic | Path |
|-------|------|
| Monorepo layout | [README.md](README.md) |
| API folder structure | [docs/reference/api-folder-structure.md](docs/reference/api-folder-structure.md) |
| API runtimes | [docs/reference/api-runtimes.md](docs/reference/api-runtimes.md) |
| Local development | [docs/reference/local-dev.md](docs/reference/local-dev.md) |
| Cross-repo OpenAPI workflow | [docs/reference/cross-repo-workflow.md](docs/reference/cross-repo-workflow.md) |
| Package boundaries | [docs/reference/integrations-restructure.md](docs/reference/integrations-restructure.md) |

## Verification

Before opening a PR:

```sh
bun run verify
```

Package-scoped iteration: `bun --filter @edaya/core test`, `bun --filter @edaya/api test`, etc.

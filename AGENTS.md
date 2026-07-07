# Agent guidance

Backend monorepo (`edaya_backend`): API (including scheduled cron), domain packages, adaptors, seeding, and integration tests.

Web frontends live in the sibling **[edaya_web](../edaya_web)** repo. For UI work there, follow `edaya_web/AGENTS.md` and `edaya_web/docs/specs/`.

## Architecture

- **Ports and adapters** — business rules in `@edaya/core`; Postgres in `@edaya/adaptor-postgres`; auth persistence in `@edaya/adaptor-auth`; Novu gateway in `@edaya/adaptor-novu`; migration CLI in `@edaya/db-migrate`; Novu ops CLI in `@edaya/novu-ops`; HTTP/runtime wiring in `apps/api`.
- **Boundary rule** — `package/domain-core`, `package/adaptor-postgres`, and adaptor packages never depend on `apps/` or `tooling/`.

## Portal authorization

Staff permission assignments, role presets, scope seeds, and grant resolution affect **portal actors** (teachers, guardians, students) as well as staff workspace users. A change that looks correct for staff webapp routes can still break mobile portal authorization. After permission or seed changes, verify portal actors per [edaya_web demo-accounts.md](../edaya_web/docs/reference/demo-accounts.md) — not only staff API tests.

## Key docs

| Topic | Path |
|-------|------|
| Monorepo layout | [README.md](README.md) |
| API folder structure | [docs/reference/api-folder-structure.md](docs/reference/api-folder-structure.md) |
| API runtimes | [docs/reference/api-runtimes.md](docs/reference/api-runtimes.md) |
| Runtime boundaries | [docs/reference/runtime-boundaries.md](docs/reference/runtime-boundaries.md) |
| Local development | [docs/reference/local-dev.md](docs/reference/local-dev.md) |
| Repo CLI (`bun repo`) | [docs/reference/repo-cli.md](docs/reference/repo-cli.md) |
| Cross-repo OpenAPI workflow | [docs/reference/cross-repo-workflow.md](docs/reference/cross-repo-workflow.md) |
| Unit test coverage | [docs/reference/unit-test-coverage.md](docs/reference/unit-test-coverage.md) |
| Package boundaries | [docs/reference/integrations-restructure.md](docs/reference/integrations-restructure.md) |

## Verification

Before opening a PR:

```sh
bun run verify        # quality + build + unit tests + repo hygiene
bun run test:integration
```

For seed HTTP paths, also run `bun run test:integration:seed`.

Ad-hoc Turbo iteration: `bun run lint`, `bun run check`, `bun run test`, etc. Repo hygiene only: `bun repo verify`.

Package-scoped iteration: `bun --filter @edaya/core test`, `bun --filter @edaya/api test`, etc.

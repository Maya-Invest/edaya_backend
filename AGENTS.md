# Agent guidance

Backend monorepo (`edaya_backend`): API (including scheduled cron), domain packages, adaptors, seeding, and integration tests.

Web frontends live in the sibling **[edaya_web](../edaya_web)** repo. For UI work there, follow `edaya_web/AGENTS.md` and `edaya_web/docs/specs/`.

## Architecture

- **Ports and adapters** — domain types and ports in `@edaya/core`; authorization engine in `@edaya/authorization`; school orchestration (workflows, entity configs, notifications, cron) in `@edaya/service`; Postgres in `@edaya/adaptor-postgres`; auth persistence in `@edaya/adaptor-auth`; in-process notification adapters in `@edaya/adaptor-notify` (Novu remains `@edaya/adaptor-novu` as env fallback); migration CLI in `@edaya/db-migrate`; HTTP/runtime wiring in `apps/api`.
- **Domain dependency direction** — `school-service` → `authorization` → `core`. Production `src/` in core must not import `@edaya/authorization` or `@edaya/service`; authorization `src/` must not import `@edaya/service`. `Permission` and staff grant scope validation live in `@edaya/core`.
- **Boundary rule** — `package/domain-core`, `package/authorization`, `package/domain-service`, `package/adaptor-postgres`, and adaptor packages never depend on `apps/` or `tooling/`.

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
| CI setup | [docs/reference/ci-setup.md](docs/reference/ci-setup.md) |
| Cross-repo OpenAPI workflow | [docs/reference/cross-repo-workflow.md](docs/reference/cross-repo-workflow.md) |
| Unit test coverage | [docs/reference/unit-test-coverage.md](docs/reference/unit-test-coverage.md) |
| Package boundaries | [docs/reference/integrations-restructure.md](docs/reference/integrations-restructure.md) |
| Notification router | [docs/architecture/notification-router.md](docs/architecture/notification-router.md) |

## Verification

Before opening a PR:

```sh
bun repo verify --full   # PR blocking CI locally (verify + integration)
# or separately:
bun run verify           # repo hygiene, then quality + build + unit tests
bun run test:integration
```

For seed HTTP paths, also run `bun run test:integration:seed`.

Ad-hoc Turbo iteration: `bun run lint`, `bun run check`, `bun run test`, etc. Repo hygiene only: `bun repo verify`.

Package-scoped iteration: `bun --filter @edaya/core test`, `bun --filter @edaya/api test`, etc.

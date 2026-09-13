# Agent guidance

Backend monorepo (`edaya_backend`): API (including scheduled cron), domain packages, adaptors, seeding, and integration tests.

Web frontends live in the sibling **[edaya_frontend](../edaya_frontend)** repo. For UI work there, follow `edaya_frontend/AGENTS.md` and `edaya_frontend/docs/specs/`.

## Architecture

- **Ports and adapters** — domain types and ports in `@edaya/core`; business access policies in `@edaya/authorization`; school orchestration (workflows, entity configs, notifications, cron) in `@edaya/service`; Postgres in `@edaya/adaptor-postgres`; central auth persistence and Better Auth in sibling `edaya_identity`; school JWT/directory access through `@maya-invest/edaya-identity-client`; in-process notification adapters in `@edaya/adaptor-notify` (Novu is an email transport in `@edaya/adaptor-novu`); in-process document rendering in `@edaya/adaptor-docs`; migration CLI in `@edaya/db-migrate`; HTTP/runtime wiring in `apps/api`.
- **Domain dependency direction** — `@edaya/service` → `@edaya/authorization` → `@edaya/core`. Production `src/` in core must not import `@edaya/authorization` or `@edaya/service`; authorization `src/` must not import `@edaya/service`. `Permission` and staff grant scope validation live in `@edaya/core`.
- **Boundary rule** — `package/domain-core`, `package/domain-authorization`, `package/domain-service`, `package/adaptor-postgres`, and adaptor packages never depend on `apps/` or `tooling/`.
- **Package READMEs** — describe **this** package’s folders only. The monorepo map lives in [README.md](README.md) and [docs/reference/integrations-restructure.md](docs/reference/integrations-restructure.md).

## Portal authorization

Actors identify the selected caller profile. Staff authority comes from typed manual grants and current staff assignments; teachers, guardians, and students use their current business relationships. A guardian request never inherits staff authority. Keep actions and their resource scopes together in policies, constrain reads before pagination/counts, and authorize all existing/proposed write targets inside the command transaction. Presets assign permissions; role names never decide runtime access.

After permission, relationship, or seed changes, verify teacher and family portals as well as staff API routes. Follow the [authorization model](package/domain-authorization/src/README.md) and the sibling frontend's demo-account guidance.

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
| Document renderer | [docs/architecture/document-renderer.md](docs/architecture/document-renderer.md) |
| Platform actors and S2S keys | [docs/architecture/platform-actors-and-s2s-keys.md](docs/architecture/platform-actors-and-s2s-keys.md) |
| First-party sibling app | [docs/architecture/first-party-sibling-app.md](docs/architecture/first-party-sibling-app.md) |

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

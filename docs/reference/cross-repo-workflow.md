# Cross-repo workflow

Edaya spans multiple repositories:

| Repo | Role |
|------|------|
| **edaya_backend** (this repo) | API, cron, domain packages, adaptors, seeding, integration tests |
| **edaya_web** | SvelteKit webapp + saas-admin, browser OpenAPI types |
| **edaya-client-codegen** | OpenAPI artifact generator (`@edaya/client-codegen`) |
| **edaya_mobile** | Flutter app (consumes OpenAPI client bindings extension) |

## Backend-only OpenAPI pipeline

When API routes or registry metadata change in **this repo**:

```sh
bun repo openapi export          # tooling/repo/fixtures/openapi.json
bun repo openapi generate        # tooling/seeding + integration-tests client dirs
bun run verify
```

| Step | Script | Output |
|------|--------|--------|
| Export spec | `bun repo openapi export` | `tooling/repo/fixtures/openapi.json` |
| Generate bindings | `bun repo openapi generate` | `edaya-client-codegen/clients/school-api/src/` (when checkout present) |
| Drift check | `bun repo check openapi` | Compares temp output to tracked files (non-mutating) |

### Published client (`@edaya/api-client`)

On merge to `staging` / `main`, CI also regenerates and publishes the shared client from **edaya-client-codegen** (`clients/school-api/`). See [ci-setup.md](./ci-setup.md#api-client-npm-publish-edayaapi-client).

Consumers can install:

```sh
npm install @edaya/api-client@staging
```

Or use a local path checkout: `file:../edaya-client-codegen/clients/school-api`.

Bindings are embedded in the OpenAPI document under `info.x-edaya-client-bindings`. The export step reads route metadata from `apps/api/src/lib/school-api/client-bindings.ts`.

## Pair PR with edaya_web

After merging API changes here:

1. Copy or re-export the updated `openapi.json` into **edaya_web** (`apps/webapp/src/lib/api/openapi.json`).
2. In edaya_web: `bun repo openapi generate` (schema types + web copy of client bindings).
3. Run `bun run verify` in both repos.

Full consumer-side details: [edaya_web/docs/reference/cross-repo-workflow.md](../../edaya_web/docs/reference/cross-repo-workflow.md).

## CI independence

Each repo runs `bun run verify` from its own checkout. **edaya_web** CI uses committed `openapi.json` and does not require a sibling backend checkout. **edaya_backend** CI exports and checks generated artifacts from the in-repo API.

## Hand-written client runtime

Generated files are regen-only. The handwritten runtime (`Transport`, `EntityResource`, `createSchoolClient`, …) lives in `edaya-client-codegen/templates/runtime/` and is copied into each generated client directory. **edaya_web** and backend tooling depend on `@edaya/api-client` (`file:../../edaya-client-codegen/clients/school-api`).

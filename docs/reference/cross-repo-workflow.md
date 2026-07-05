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
bun run export-openapi          # tooling/repo/fixtures/openapi.json
bun run openapi:generate          # package/generated-api-client/src/generated/*
bun repo verify
```

| Step | Script | Output |
|------|--------|--------|
| Export spec | `bun run export-openapi` | `tooling/repo/fixtures/openapi.json` |
| Generate bindings | `bun run openapi:generate` | `package/generated-api-client/src/generated/client-bindings.ts` |
| Drift check | `bun repo check openapi` | Compares temp output to tracked files (non-mutating) |

Bindings are embedded in the OpenAPI document under `info.x-edaya-client-bindings`. The export step reads route metadata from `apps/api/src/lib/school-api/client-bindings.ts`.

## Pair PR with edaya_web

After merging API changes here:

1. Copy or re-export the updated `openapi.json` into **edaya_web** (`apps/webapp/src/lib/api/openapi.json`).
2. In edaya_web: `bun run openapi:generate` (schema types + web copy of client bindings).
3. Run `bun repo verify` in both repos.

Full consumer-side details: [edaya_web/docs/reference/cross-repo-workflow.md](../../edaya_web/docs/reference/cross-repo-workflow.md).

## CI independence

Each repo runs `bun repo verify` from its own checkout. **edaya_web** CI uses committed `openapi.json` and does not require a sibling backend checkout. **edaya_backend** CI exports and checks generated artifacts from the in-repo API.

## Hand-written client runtime

Generated files are regen-only. The handwritten runtime (`Transport`, `EntityResource`, `createSchoolClient`, …) lives in `package/generated-api-client/src/`. **edaya_web** maintains a synced copy under `packages/api-client/src/` until a shared publish workflow ships.

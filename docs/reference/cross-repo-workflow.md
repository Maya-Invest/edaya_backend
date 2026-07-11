# Cross-repo workflow

Edaya spans multiple repositories:

| Repo | Role |
|------|------|
| **edaya_backend** (this repo) | API, cron, domain packages, adaptors, `@maya-invest/edaya-api-client`, client codegen tooling |
| **edaya_web** | SvelteKit webapp + saas-admin, browser OpenAPI types |
| **edaya_mobile** | Flutter app (consumes OpenAPI client bindings extension) |

## Backend OpenAPI pipeline

When API routes or registry metadata change in **this repo**:

```sh
bun repo openapi export          # tooling/repo/fixtures/openapi.json
bun repo openapi generate        # package/api-client/src/
bun run verify
```

| Step | Script | Output |
|------|--------|--------|
| Export spec | `bun repo openapi export` | `tooling/repo/fixtures/openapi.json` |
| Generate client | `bun repo openapi generate` | `package/api-client/src/` |
| Drift check | `bun repo check openapi` | Compares temp output to tracked files (non-mutating) |

### Published client (`@maya-invest/edaya-api-client`)

The generated client lives in `package/api-client/`. On merge to `staging` / `main`, CI regenerates and publishes to **GitHub Packages** (`npm.pkg.github.com`) with dist-tags `staging` / `production`. See [ci-setup.md](./ci-setup.md#api-client-github-packages-maya-investedaya-api-client).

Consumers can install:

```sh
bun add @maya-invest/edaya-api-client@staging
bun add @maya-invest/edaya-api-client@production
```

**Local development in this monorepo** — workspace resolution via root override:

```json
"overrides": {
  "@maya-invest/edaya-api-client": "workspace:*"
}
```

**Sibling repos** — point `package.json` at the backend client folder:

```json
"@maya-invest/edaya-api-client": "file:../edaya_backend/package/api-client"
```

Bindings are embedded in the OpenAPI document under `info.x-edaya-client-bindings`. The export step reads route metadata from `apps/api/src/lib/school-api/client-bindings.ts`.

## Pair PR with edaya_web

After merging API changes here:

1. Copy or re-export the updated `openapi.json` into **edaya_web** (`apps/webapp/src/lib/api/openapi.json`).
2. In edaya_web: `bun repo openapi generate` (schema types + saas-admin copies).
3. Run `bun run verify` in both repos.

Full consumer-side details: [edaya_web/docs/reference/cross-repo-workflow.md](../../edaya_web/docs/reference/cross-repo-workflow.md).

## CI independence

Each repo runs `bun run verify` from its own checkout. **edaya_web** CI uses committed `openapi.json` and checks out **edaya_backend** for the shared api-client package. **edaya_backend** CI exports and checks generated artifacts from the in-repo API.

## Hand-written client runtime

Generated files are regen-only. The handwritten runtime (`Transport`, `EntityResource`, `createSchoolClient`, …) lives in `tooling/client-codegen/templates/runtime/` and is copied into `package/api-client/src/runtime/` on generate.

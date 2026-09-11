# Cross-repo workflow

Edaya spans multiple repositories:

| Repo | Role |
|------|------|
| **edaya_backend** (this repo) | API, cron, domain packages, adaptors, `@maya-invest/edaya-api-client`, client codegen tooling |
| **edaya_web** | SvelteKit webapp + webadmin, browser OpenAPI types |
| **edaya_mobile** | Flutter app (consumes OpenAPI client bindings extension) |
| **edaya_identity** | Better Auth Worker, identity database, JWT issuer/JWKS, directory API, `@maya-invest/edaya-identity-client` |

Backend local development links the identity client with
`"@maya-invest/edaya-identity-client": "file:../edaya_identity/package/identity-client"`.
CI must check out the sibling identity repository before `bun install`, or replace the file link with the published package.

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
  "@maya-invest/edaya-api-client": "workspace:*",
  "@maya-invest/edaya-identity-client": "file:../edaya_identity/package/identity-client"
}
```

**Sibling repos** — point `package.json` at the backend client folder:

```json
"@maya-invest/edaya-api-client": "file:../edaya_backend/package/api-client"
```

Bindings are extracted from each operation's `x-edaya-*` metadata in the exported OpenAPI document. Entity metadata comes from the API registry and `apps/api/src/lib/school-api/openapi/client-extensions.ts`.

Every entity declares `publicOperations` with explicit `create`, `update`, `delete`, `batchCreate`, `batchUpdate`, and `batchDelete` flags. REST and GraphQL omit forbidden mutations. Generic save is an upsert and therefore requires both create and update permission; batch save requires both batch flags. The legacy `allowDirectSave` metadata is derived for compatibility and does not control exposure.

Regenerate both TypeScript and Dart clients when these policies change. TypeScript removes unavailable methods from the generated public type; both runtimes reject forbidden writes before sending a request. Use the named command for command-owned records. Client flags describe API availability, not the caller's authorization: backend tenant, permission and business-rule checks still apply to every exposed operation.

## Pair PR with edaya_web

After merging API changes here:

1. Merge or sync the updated `@maya-invest/edaya-api-client` (file link or published package).
2. In **edaya_web**: `bun install` (if using file link) and `bun run verify`.

Full consumer-side details: [edaya_web/docs/reference/cross-repo-workflow.md](../../edaya_web/docs/reference/cross-repo-workflow.md).

## CI independence

Each repo runs `bun run verify` against its own code. **edaya_web** CI checks out **edaya_backend** for the API-client file link. **edaya_backend** CI checks out **edaya_identity** as a sibling for the identity-client file link, then exports and checks generated artifacts from the in-repo school API.

## Hand-written client runtime

Generated files are regen-only. The handwritten runtime (`Transport`, `EntityResource`, `createSchoolClient`, …) lives in `tooling/client-codegen/templates/runtime/` and is copied into `package/api-client/src/runtime/` on generate.

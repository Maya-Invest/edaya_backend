# Backend tooling audit

Audited on October 2, 2026. The cleanup reduces backend tooling from eight workspace packages to four by consolidating repository commands, removing unused declarations, and separating the API contract from client generation. Migration, seeding, local upload, and client-generation functionality remains available.

The reduction concerns workspace structure and dependency ownership. The external dependency graph remains unchanged because other backend packages still use the removed declarations' libraries.

## Measured changes

Counts come from the original and updated `bun.lock`, with `dependencies` and `devDependencies` counted separately. The root workspace is excluded from the workspace count.

| Measure | Before | After |
|---------|-------:|------:|
| Tooling workspace packages | 8 | 4 |
| All backend workspace packages | 24 | 20 |
| Dependency declarations in tooling manifests | 69 | 37 |
| Distinct external names declared by tooling packages | 13 | 7 |
| Lockfile package entries, including workspaces | 810 | 806 |
| External package resolutions | 786 | 786 |

All 786 external resolutions remain pinned to their original versions. No additional external dependency was introduced. Duplicate declarations already shared installed versions through Bun; removing those declarations does not represent equivalent download or disk savings.

## Workspace decisions

| Original package | Decision | Evidence and destination |
|------------------|----------|--------------------------|
| `@edaya/repo` | Keep | Owns the repository CLI, hygiene checks, and local development orchestration. It now also owns command-only tooling. |
| `@edaya/client-codegen` | Consolidate | Private generator, called by repo OpenAPI commands and contract tests. Generation code, templates, and tests moved to `tooling/repo/codegen/`. The API's shared contract moved to the existing API client package. |
| `@edaya/db-migrate` | Consolidate | CLI scripts, without package exports or a separate deployable artifact. Commands moved to `tooling/repo/db/school/`. Schema generation continues to belong to `@edaya/adaptor-postgres`. |
| `@edaya/identity-migrate` | Consolidate | Private migration and wipe commands. Moved to `tooling/repo/db/identity/`; Account and provider SQL remain in their adapters. |
| `@edaya/local-files-server` | Consolidate | One executable entry point wrapping the existing local filesystem adapter. Moved to `tooling/repo/dev/local-files.ts`. The adapter still owns the HTTP implementation. |
| `@edaya/fixtures` | Keep | Shared dataset and helper exports used independently by API tests, integration tests, and seeding. Its onboarding subpath also serves the API's structure-template catalog. Keeping this data contract separate avoids making catalog and fixture consumers depend on seed orchestration. |
| `@edaya/seeding` | Keep | Owns HTTP orchestration, repair, cleanup, seed ports, and workflows. It has independent exports and test coverage beyond the fixture data. |
| `@edaya/integration-tests` | Keep | Owns distinct API, HTTP, seed, and native PostgreSQL suites with dedicated runtime setup. Its separate commands and dependency graph preserve test isolation and CI scheduling. |

`tooling/test-support/` and `tooling/api-dev-container/` contain scripts without package manifests; they do not increase the package count.

## Dependency removals

Source imports, configuration, script execution, and Turbo dependency scheduling were checked before removing declarations.

| Location | Removed declaration | Reason |
|----------|---------------------|--------|
| School migration tooling | `@edaya/core`, `@edaya/adaptor-notify` | No direct imports. Migration application is supplied by the Postgres adapter. |
| School migration tooling | `drizzle-kit` | An unreferenced `drizzle.school.config.ts` duplicated schema-generation ownership. That configuration was removed. The Postgres adapter retains its active Drizzle Kit commands. |
| Local file server | `hono` | The entry point imports only the local filesystem adapter and environment loaders. The adapter directly owns and declares Hono. |
| Integration tests | `dotenv`, `dotenv-expand`, `jose`, `zod` | No direct imports in the integration package. Required uses remain declared by the packages implementing those features. |
| Seeding | `@maya-invest/edaya-identity-client` | No imports; provisioning uses public auth operations. The unified API now removes this client from integration tests and the workspace entirely. |
| Tooling compiler and types | Eight `@types/bun`, six `typescript`, and one `@types/node` declarations | Centralized at the workspace root. The root already owned TypeScript and Node types; Bun types were added there. |

The remaining seven external tooling names have direct uses: `@electric-sql/pglite`, `dotenv`, `dotenv-expand`, `drizzle-orm`, `postgres`, `openapi-typescript`, and `hono`. The fixture package requires only workspace dependencies.

The API's test dependency on `@edaya/repo` and the integration suite's direct dependency on repository migration helpers remain explicit in development dependencies. This allows Turbo to invalidate dependent checks and tests when generator or migration code changes.

## Runtime and code cleanup

The API formerly imported constants and types from the generator's root entry point, which also re-exported filesystem helpers and OpenAPI generation code. It now imports `@maya-invest/edaya-api-client/contract`. This entry point has no external dependencies and successfully bundles for a browser target at 2,137 bytes. An import-boundary check rejects repository tooling in API production source.

The generator now shares `tooling/repo/lib/drift.ts` with repository checks. Its duplicate drift implementation and unused `copyRuntimeTemplatesTo` and `listRuntimeTemplateFiles` helpers were removed.

The relocated local file entry point resolves its environment file and relative file root against the actual backend root. Its previous root calculation stopped at `tooling/`. A smoke check verifies the selected environment file, relative storage path, and health endpoint.

The repository package now runs the relocated generator and migration tests, preserves strict migration type checks, and includes identity scripts in lint checks. Separate generator formatting rules remain because its existing sources and templates use a different style.

## Command and CI changes

| Operation | Current command or entry point |
|-----------|--------------------------------|
| Start identity, API, and local files | `bun repo dev` |
| School migration, reset, and generation | Existing `bun repo db ...` commands |
| Identity migration | `bun repo identity-migrate` |
| Guarded identity wipe | `bun repo identity-wipe local|staging [--yes]` |
| Repository client regeneration | `bun repo openapi generate` |
| Client generation from another input | `bun repo codegen generate|check ...` |
| Standalone local file server | `bun tooling/repo/dev/local-files.ts` |

Identity command help exits before executing a migration or wipe, including when `--yes` is present. The generator also supports `--help`.

CI migration steps, staging deployment and rehearsal scripts, deploy path filters, container startup, and seed-baking scripts use the relocated entries. Native finance tests and their TypeScript includes now reference `tooling/repo/db/school/`.

Client regeneration preserves the existing OpenAPI schema, bindings, runtime files, and Dart contract. Historical generator banners were retained to avoid changing consumer artifact hashes for a tooling-only relocation. The content-addressed release contract was repinned in backend, frontend, and mobile; only the backend source fingerprint and release ID changed in those manifests.

## Tools retained outside the consolidated packages

The root TypeScript compiler and ESLint configuration supply active checks across the backend. Turbo schedules workspace tasks and caches them, including the generated API-client build. Bun executes the local API entry directly, and Wrangler bundles the Worker entry for deployment. CI validates staging and production Worker bundles through deployment dry runs. Drizzle Kit remains with the adapters that own schema generation.

## Validation

- Repository tooling type checks, lint checks, and 74 tests pass, including generator, migration guard, CLI routing, and runtime-boundary tests.
- API and HTTP integration suites pass: 53 tests across 23 files.
- Native PostgreSQL integration passes: 60 tests, with three optional benchmark tests skipped.
- Seed integration passes: 8 tests covering the seed contract, HTTP validation, and HTTP diagnostics.
- Disposable school and identity PGlite migrations pass through the new CLI paths.
- The relocated local file server passes environment, storage-path, and health smoke checks.
- The isolated client contract builds successfully for a browser target.
- A fresh offline installation with a frozen lockfile passes without existing dependency links; repository tooling checks and tests are verified in that copy.
- Final `bun run verify` passes: repository hygiene, release-contract checks, lint, type checks, builds, and 2,012 unit tests. The integration suites separately pass 121 tests in total; three optional benchmarks are skipped.

Live deployment, remote database resets, and container image publication are outside this audit. CI and container entry points were updated; live operations were not executed.

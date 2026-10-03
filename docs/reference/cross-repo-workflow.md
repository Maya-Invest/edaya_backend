# Three-repository contract workflow

The product has exactly three candidate repositories: backend, frontend and mobile. Account authentication lives inside backend `apps/api/src/identity`. There is one backend Worker and one published TypeScript client, `@maya-invest/edaya-api-client`.

Run `bun repo openapi generate` in the backend after changing public contracts. The main contract includes both school operations and the `auth` namespace. Build the client and refresh the frontend vendor copy. Generate Dart bindings from the tracked backend OpenAPI with `EDAYA_OPENAPI_SPEC=../edaya_backend/tooling/repo/fixtures/openapi.json bash scripts/generate-api-bindings.sh` in mobile. After checking generated artifacts, run `python3 scripts/release-contract.py --write` in backend to pin all three repositories to one content-addressed contract.

Web auth uses the generated auth helper with a cookie transport. School transport obtains a JWT through that helper; auth requests must never invoke the school token manager. Native `edaya_auth` uses generated Dart contracts while `edaya_api_client` remains independent of the session adapter.

Qualification precedes publication. The staging coordinator publishes or reuses only the API client at `0.0.0-staging.<backend-SHA>`, verifying its recorded backend source commit. Immutable version/source mismatches stop the release. Validation mode performs no publication and builds from qualified candidate sources. All builds and retry checks use the same backend/frontend/mobile revisions.

Each repository has its own verification gate. Cross-repository private checkout access remains required for integration and coordinated release workflows; the legacy credential name `IDENTITY_CHECKOUT_TOKEN` is retained as an input, not a fourth checkout.

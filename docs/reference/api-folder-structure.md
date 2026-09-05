# API folder structure

The `apps/api` package separates **route registration** (thin HTTP surface) from **shared implementation** under `lib/`. Core entity/command/query routes are generated from the school API registry; hand-written routes cover authorization, onboarding, and system operations. HTTP infrastructure and dual-runtime wiring live at the top level (`http/`, `runtime/`). GraphQL is mounted from `app.ts` (not `app-router.ts`).

## Layout

```
src/
├── main.ts                    # Shim → entries/local (legacy import path)
├── entries/
│   ├── local.ts               # Local dev server entry (PGlite / Postgres)
│   ├── worker.ts              # Cloudflare Worker export
│   └── cron-local.ts          # Local cron tick
├── app.ts                     # Hono app: createApp + OpenAPI + GraphQL + mount app-router
├── app-router.ts              # Composes REST route modules + Better Auth proxy
│
├── routes/                    # Hand-written OpenAPI route modules
│   ├── authorization.routes.ts
│   ├── effective-grants.route.ts
│   ├── onboarding.routes.ts
│   ├── invitation.routes.ts
│   ├── file-storage.routes.ts
│   ├── service-accounts.routes.ts
│   ├── seed-auth.routes.ts
│   └── notification-delivery-webhook.routes.ts
│
├── http/                      # App factory, CORS, DI, middleware, responses
│   ├── bindings.ts            # AppBindings (used by http/ and runtime/)
│   ├── create-app.ts
│   ├── dependencies/          # Per-request env, runtime, auth, session, school app
│   └── middleware/
│
├── cron/                      # scheduled() handler + queue consumer
│
├── runtime/                   # Runtime profiles + shared wiring
│   ├── shared/
│   │   ├── env/               # schema, bindings, hyperdrive, local-loader
│   │   └── adapters/          # file storage, notifications, invitations, Better Auth
│   ├── in-memory/             # test profile
│   ├── local/                 # dev profile + registry + resolve-api-runtime
│   └── worker/                # Cloudflare profile + resolve-api-runtime (Wrangler alias)
│
└── lib/
    ├── authorization/         # Grants cache + serialization
    ├── documents/             # Report-card / logbook document payloads
    ├── graphql/               # POST /graphql + optional GraphiQL
    ├── school-api/            # Registry, schemas, dispatch, route builders
    │   ├── application.ts
    │   ├── dispatch/          # Command + entity dispatch to SchoolService
    │   ├── registry.ts
    │   ├── routes/            # buildCoreRoutes (commands, queries, entities)
    │   └── schemas/           # OpenAPI/Zod request + response schemas
    └── service-accounts/      # Service-account request schemas
```

## Conventions

- **`routes/`** — Hand-crafted OpenAPI routes only (auth proxy is mounted in `app-router.ts`, not a route file). No business logic beyond request/response wiring.
- **`lib/school-api/routes/`** — Route factories that generate the bulk of `/core/*` endpoints from `registry.ts` (commands, queries, entities). Shared helpers live in `entity-handlers.ts` and `shared.ts`.
- **`lib/graphql/`** — Supported second contract. Schema and resolvers are derived from the same registry as REST. Mounted in `app.ts` via `mountGraphQLRoute`. The typed client is REST-only; production web/mobile use REST. GraphiQL (`/graphiql`) is off in production unless `GRAPHQL_GRAPHIQL=true`. Vite proxies `/graphql` for local exploration.
- **`routes/onboarding.routes.ts`** — Thin HTTP for school registration. Orchestration lives in `@edaya/service` (`capabilities/onboarding`). Template catalogs stay in `@edaya/fixtures/onboarding`.
- **`runtime/`** — Env parsing, database handles, Better Auth setup, Hyperdrive resolution, and the Node process runtime registry.
- **`http/dependencies/`** — Request-scoped dependency injection: env → school runtime → auth → session actor. Worker runtimes are resolved per request and closed in `onRequestComplete`.
- **`cron/`** — Worker `scheduled()` heartbeat and queue consumer.
- **`app-router.ts`** — REST composition point: index, effective grants, onboarding, system routes, generated core routes, then `/auth/*` proxy.

## Core route generation

`buildCoreRoutes()` in `lib/school-api/routes/index.ts` merges:

| Builder | Mount prefix | Source |
|---------|--------------|--------|
| `buildCommandRoutes()` | `/core/commands/*` | `registry.ts` command definitions |
| `buildQueryRoutes()` | `/core/queries/*` | `registry.ts` query definitions |
| `buildEntityRoutes()` | `/core/entities/*` | `registry.ts` entity configs |

All generated REST routes share `SCHOOL_API_BASE_PATH = "/core"` from `lib/school-api/routes/paths.ts`. GraphQL exposes the same commands, queries, and entities at `POST /graphql`.

## Import paths

| Concern | Path |
|---------|------|
| Runtime (public) | `@/runtime` |
| Runtime resolver (middleware only) | `@/runtime/resolve-api-runtime` (Wrangler alias → `worker/resolve-api-runtime.ts`) |
| HTTP app | `@/http/create-app` |
| Dependency injection | `@/http/dependencies` |
| Request context types | `@/http/bindings` |
| Core registry | `@/lib/school-api/registry` |
| OpenAPI schemas | `@/lib/school-api/schemas/*` |
| Hand-written routes | `@/routes/*` |
| Core route builders | `@/lib/school-api/routes` |
| GraphQL mount | `@/lib/graphql` |
| App router | `@/app-router` |

## Scripts

| Script | Command |
|--------|---------|
| `dev` | `bun --watch src/entries/local.ts` |
| `dev:worker` | `wrangler dev --env staging --env-file .dev.vars` |
| `build` | `tsup` → `dist/node.js` from `src/entries/local.ts` |
| `deploy:production` | `wrangler deploy --env prod` |
| `deploy:staging` | `wrangler deploy --env staging` |

TypeScript client bindings are generated at the repo root from the exported OpenAPI document: `bun tooling/repo/openapi/generate-bindings.ts`. OpenAPI export: `bun tooling/repo/openapi/export.ts`.

Root shortcuts: `bun repo deploy api production` → `@edaya/api deploy:production`; `bun repo deploy api staging` → `deploy:staging`.

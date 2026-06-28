# API folder structure

The `apps/api` package separates **route registration** (thin HTTP surface) from **shared implementation** under `lib/`. Core entity/command/query routes are generated from the school API registry; hand-written routes cover authorization, onboarding, and system operations. HTTP infrastructure and dual-runtime wiring live at the top level (`http/`, `runtime/`).

## Layout

```
src/
├── main.ts                    # Shim → entries/node (legacy import path)
├── entries/
│   ├── node.ts                # Node/Bun server entry (dev + production Node)
│   └── worker.ts              # Cloudflare Worker export
├── app.ts                     # Hono app: createApp + OpenAPI + mount app-router
├── app-router.ts              # Composes route modules + Better Auth proxy
│
├── routes/                    # Hand-written OpenAPI route modules
│   ├── effective-grants.route.ts
│   ├── onboarding.routes.ts   # School registration bootstrap
│   └── service-accounts.routes.ts
│
├── http/                      # App factory, CORS, DI, middleware, responses
│   ├── create-app.ts
│   ├── dependencies/          # Per-request env, runtime, auth, session, school app
│   └── middleware/
│
├── logging/                   # Pino + Better Auth logger (runtime-safe, no Hono)
│   └── app-logger.ts
│
├── context/                   # Shared request context types
│   └── bindings.ts            # AppBindings (used by http/ and runtime/)
│
├── runtime/                   # Env, DB, auth, Hyperdrive, runtime registry
│   ├── env/                   # Env parsing, bindings, dotenv
│   ├── registry/              # Node process cache
│   ├── resolve/               # api-runtime.ts (+ .worker.ts via Wrangler alias)
│   ├── shared/                # Better Auth + ApiRuntime assembly
│   ├── node/                  # Node DB + buildNodeApiRuntime
│   └── worker/                # Worker DB + buildWorkerApiRuntime
│
├── scripts/
│   └── export-openapi.ts      # Writes OpenAPI JSON (embeds x-edaya-client-bindings)
│
└── lib/
    ├── authorization/         # Grants cache + serialization
    └── school-api/            # Registry, schemas, dispatch, route builders
        ├── application.ts
        ├── dispatch/          # Command + entity dispatch to core
        ├── registry.ts
        ├── routes/            # buildCoreRoutes (commands, queries, entities)
        └── schemas/           # OpenAPI/Zod request + response schemas
```

## Conventions

- **`routes/`** — Hand-crafted OpenAPI routes only (auth proxy is mounted in `app-router.ts`, not a route file). No business logic beyond request/response wiring.
- **`lib/school-api/routes/`** — Route factories that generate the bulk of `/core/*` endpoints from `registry.ts` (commands, queries, entities). Shared helpers live in `entity-handlers.ts` and `shared.ts`.
- **`runtime/`** — Env parsing, database handles, Better Auth setup, Hyperdrive resolution, and the Node process runtime registry. Replaces the former `bootstrap/` and `authentication/` trees.
- **`http/dependencies/`** — Request-scoped dependency injection: env → school runtime → auth → session actor. Worker runtimes are resolved per request and closed in `onRequestComplete`.
- **`app-router.ts`** — Single composition point: index, effective grants, onboarding, system routes, generated core routes, then `/auth/*` proxy.

## Core route generation

`buildCoreRoutes()` in `lib/school-api/routes/index.ts` merges:

| Builder | Mount prefix | Source |
|---------|--------------|--------|
| `buildCommandRoutes()` | `/core/commands/*` | `registry.ts` command definitions |
| `buildQueryRoutes()` | `/core/queries/*` | `registry.ts` query definitions |
| `buildEntityRoutes()` | `/core/entities/*` | `registry.ts` entity configs |

All generated routes share `SCHOOL_API_BASE_PATH = "/core"` from `lib/school-api/routes/paths.ts`.

## Import paths

| Concern | Path |
|---------|------|
| Runtime (public) | `@/runtime` |
| Runtime resolver (middleware only) | `@/runtime/resolve/api-runtime` (Wrangler alias → `.worker.ts`) |
| HTTP app | `@/http/create-app` |
| Dependency injection | `@/http/dependencies` |
| Request context types | `@/context/bindings` |
| Logging | `@/logging/app-logger` |
| Core registry | `@/lib/school-api/registry` |
| OpenAPI schemas | `@/lib/school-api/schemas/*` |
| Hand-written routes | `@/routes/*` |
| Core route builders | `@/lib/school-api/routes` |
| App router | `@/app-router` |

## Scripts

| Script | Command |
|--------|---------|
| `dev` | `bun --watch src/entries/node.ts` |
| `dev:worker` | `wrangler dev --env-file .dev.vars` |
| `build` | `tsup` → `dist/node.js` from `src/entries/node.ts` |
| `start` | `node dist/node.js` |
| `deploy:worker` | `wrangler deploy --env production` |
| `export-openapi` | `bun src/scripts/export-openapi.ts` |

TypeScript client bindings are generated at the repo root from the exported OpenAPI document: `bun scripts/generate-client-bindings.ts`.

Root shortcut: `bun run deploy:api` → `@edaya/api deploy:worker`.

# API folder structure

The `apps/api` package separates **route registration** (thin HTTP surface) from **shared implementation** under `lib/`.

## Layout

```
src/
├── main.ts                    # Node server entrypoint
├── app.ts                     # Hono app + OpenAPI wiring
├── app-router.ts              # Composes all route modules
│
├── routes/                    # All OpenAPI route modules
│   ├── auth.route.ts
│   ├── effective-grants.route.ts
│   ├── system.routes.ts
│   ├── commands.routes.ts
│   ├── queries.routes.ts
│   └── entities.routes.ts
│
└── lib/
    ├── bootstrap/             # env, db, runtime config
    ├── http/                  # create-app, middleware, responses, types, openapi
    ├── authentication/        # Better Auth configuration
    ├── authorization/         # grants cache, serialize grants
    └── school-api/            # registry, schemas, runtime, dispatch, route helpers
        ├── registry/
        ├── schemas/openapi/
        ├── runtime/
        ├── dispatch/
        └── routes/            # shared-responses, entity-handlers, route-types
```

## Conventions

- **`routes/`** — OpenAPI route definitions and handlers only. No business logic beyond request/response wiring.
- **`lib/`** — Everything else, grouped by domain (`http`, `authentication`, `authorization`, `school-api`, `bootstrap`).
- **`lib/school-api/routes/`** — Shared route helpers (entity handlers, error responses, validation helpers) used by `routes/*.routes.ts`.
- **`app-router.ts`** — Single composition point: mounts auth, authorization, system, and core command/query/entity routes.

## Import paths

| Concern | Path |
|---------|------|
| Env / config | `@/lib/bootstrap/env` |
| Database | `@/lib/bootstrap/db` |
| HTTP app | `@/lib/http/create-app` |
| Middleware | `@/lib/http/middleware/*` |
| Better Auth | `@/lib/authentication/auth.config` |
| Core registry | `@/lib/school-api/registry` |
| OpenAPI schemas | `@/lib/school-api/schemas/openapi/*` |
| Route modules | `@/routes/*` |
| App router | `@/app-router` |

## Scripts

- `dev` — `tsx watch src/main.ts`
- `start` — `node dist/src/main.js`

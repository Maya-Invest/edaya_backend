# API runtime

Dual-runtime wiring for the Hono API: **Node** (local dev, tests, containers) and **Worker** (Cloudflare).

See [docs/api-runtimes.md](../../../../docs/api-runtimes.md) for env vars and commands.

## Public API

Import from **`@/runtime`** everywhere outside this folder:

```typescript
import type { ApiRuntime, Environment } from "@/runtime";
import {
  createAuth,
  getApiRuntime,
  loadNodeProcessEnv,
  parseEnv,
  parseRuntimeEnv,
  resetApiRuntimesForTests,
  shouldAllowPublicSchoolRegistration,
} from "@/runtime";
```

**Exception** — HTTP middleware must import the Wrangler-aliased resolver path:

```typescript
import { closeRequestApiRuntime, resolveApiRuntime } from "@/runtime/resolve/api-runtime";
```

Subfolders (`env/`, `registry/`, `shared/`, `node/`, `worker/`) are **internal**. Do not import them from routes, tests, or other `lib/` modules unless you are extending the runtime itself. Worker code should import `@/runtime/env` or `@/runtime/feature-flags` directly — not the `@/runtime` barrel — to avoid pulling Node-only modules into the Worker bundle.

## Layout

```
runtime/
  index.ts              # Public exports (start here)
  types.ts
  feature-flags.ts

  env/                  # internal — env parsing, bindings, dotenv
  registry/             # internal — Node process cache
  resolve/              # api-runtime.ts (+ .worker.ts via Wrangler alias)
  shared/               # internal — Better Auth + ApiRuntime assembly
  node/                 # internal — Node DB + buildNodeApiRuntime
  worker/               # internal — Worker DB + buildWorkerApiRuntime
```

## Node vs Worker

- School DB: Node uses `node/database.ts` with automatic PGlite migrations and explicit Postgres opt-in. Worker uses `worker/database.ts` with pre-applied Postgres migrations.
- Auth DB: Node uses `node/auth-database.ts` with the same startup migration gate. Worker uses the D1 `AUTH_DB` binding through `worker/auth-database.ts`.
- Runtime access: Node uses the process cache through `getApiRuntime(env)`. Worker uses `resolveApiRuntime(c)` per request.
- Env loading: Node uses `loadNodeProcessEnv()` and `.env`. Worker uses Wrangler bindings and `parseRuntimeEnv`.

Always obtain the Node runtime through `getApiRuntime`. Do not call `buildNodeApiRuntime` directly.

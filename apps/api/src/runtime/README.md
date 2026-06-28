# API runtime

Three runtime profiles: **in-memory** (tests), **local** (dev), **worker** (Cloudflare). Shared wiring lives under `shared/`.

See [docs/api-runtimes.md](../../../../docs/api-runtimes.md) for env vars and commands.

## Public API

```typescript
import type { ApiRuntime, Environment } from "@/runtime";
import {
  getApiRuntime,
  loadLocalProcessEnv,
  parseRuntimeEnv,
  resetApiRuntimesForTests,
} from "@/runtime";
```

Middleware imports `@/runtime/resolve-api-runtime` (tsconfig defaults to `local/`; Wrangler aliases to `worker/`).

## Layout

```
runtime/
  index.ts
  types.ts

  shared/
    env/
      schema.ts, bindings.ts, derived.ts, ...
    adapters/
      file-storage.ts
      notification-gateway.ts
      invitation-delivery.ts
      notification-delivery-webhook.ts
      auth-otp-mailer.ts
      auth-contact-resolver.ts
      better-auth.ts
      pino-logger.ts
    create-api-runtime.ts
    school-application.ts
    process-registry.ts
    school-database.ts

  in-memory/
    build-runtime.ts, auth-database.ts

  local/
    profile.ts, build-runtime.ts, school-database.ts, auth-database.ts
    registry.ts
    resolve-api-runtime.ts

  worker/
    build-runtime.ts, school-database.ts, auth-database.ts
    auth-service.ts
    resolve-api-runtime.ts
```

## Runtime access

| Profile               | Access                                       |
| --------------------- | -------------------------------------------- |
| `in-memory` / `local` | `getApiRuntime(env)` via `local/registry.ts` |
| `worker`              | `resolveApiRuntime(c)` per request           |

# API runtime

Three runtime profiles: **in-memory** (tests), **local** (dev), **worker** (Cloudflare). Shared wiring lives under `shared/`.

See [docs/reference/runtime-boundaries.md](../../../../docs/reference/runtime-boundaries.md) for the adapter contract and [api-runtimes.md](../../../../docs/reference/api-runtimes.md) for env vars and commands.

## Public API

```typescript
import type { ApiRuntime, Environment } from "@/runtime";
import { getApiRuntime, resetApiRuntimesForTests } from "@/runtime/local/registry";
import {
  loadLocalProcessEnv,
  parseRuntimeEnv,
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
      document-renderer.ts
      invitation-delivery.ts
      notify-delivery-sink.ts
      identity-client.ts
      auth-contact-resolver.ts
      pino-logger.ts
    create-api-runtime.ts
    school-application.ts
    process-registry.ts
    school-database.ts

  in-memory/
    build-runtime.ts

  local/
    profile.ts, build-runtime.ts, school-database.ts
    registry.ts
    resolve-api-runtime.ts

  worker/
    build-runtime.ts, school-database.ts
    resolve-api-runtime.ts
    resolve-cron-job-dispatcher.ts
    adapters/cloudflare-queue-cron-job-dispatcher.ts
```

## Runtime access

| Profile               | Access                                       |
| --------------------- | -------------------------------------------- |
| `in-memory` / `local` | `getApiRuntime(env)` via `local/registry.ts` |
| `worker`              | `resolveApiRuntime(c)` per request           |

# Cron runtime

Two runtime profiles: **local** (one-shot dev/CI), **worker** (Cloudflare scheduled). Shared wiring lives under `shared/`.

See [docs/cron-runtimes.md](../../../../docs/cron-runtimes.md) for env vars and commands.

## Public API

```typescript
import type { CronRuntime, Environment } from "@/runtime";
import {
  buildLocalCronRuntime,
  buildWorkerCronRuntime,
  loadLocalProcessEnv,
  parseRuntimeEnv,
} from "@/runtime";
```

## Layout

```
runtime/
  index.ts
  types.ts

  shared/
    env/
      schema.ts, bindings.ts, hyperdrive.ts, local-loader.ts, repo-root.ts, index.ts
    adapters/
      notification-gateway.ts
    create-cron-runtime.ts
    school-application.ts
    school-database.ts

  local/
    profile.ts, build-runtime.ts, school-database.ts

  worker/
    build-runtime.ts, school-database.ts
```

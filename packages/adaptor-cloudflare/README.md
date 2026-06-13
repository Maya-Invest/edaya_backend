# @edaya/adaptor-cloudflare

Cloudflare Worker infrastructure for EDAYA HTTP apps: Hono dependency injection, Hyperdrive binding resolution, and request-scoped runtime lifecycle.

Runtime configuration (env schema, Better Auth, Postgres repositories) stays in `apps/api`.

## Exports

| Module | Purpose |
|--------|---------|
| `createDependenciesInjection` | Ordered Hono middleware that resolves dependencies and runs teardown |
| `resolveDatabaseUrl` | Resolve Postgres URL from `HYPERDRIVE` binding or `DATABASE_URL` |
| `prepareRuntimeBindings` | Normalize Worker/Node bindings before env validation |
| `createWorkerRequestRuntimeResolver` | Per-request runtime cache for the Worker runtime |
| `createRuntimeRegistry` | Shared runtime cache for long-lived Node processes |

## Usage

```ts
import {
  createDependenciesInjection,
  createRuntimeRegistry,
  createWorkerRequestRuntimeResolver,
  prepareRuntimeBindings,
} from '@edaya/adaptor-cloudflare'

const requestRuntime = createWorkerRequestRuntimeResolver(
  {
    get: c => c.var.apiRuntime,
    set: (c, runtime) => c.set('apiRuntime', runtime),
  },
  env => buildApiRuntime(env),
  runtime => runtime.close(),
)

const runtimeRegistry = createRuntimeRegistry({
  buildRuntime: env => buildApiRuntime(env),
  closeRuntime: runtime => runtime.close(),
})

export const dependenciesInjection = createDependenciesInjection([
  {
    name: 'env',
    resolve(c) {
      c.env = parseEnv(prepareRuntimeBindings(c.env))
    },
  },
  // ...
], {
  onRequestComplete: c => requestRuntime.close(c),
})
```

On Workers, pass bindings to Hono and resolve database connections per request. On Node, use `createRuntimeRegistry()` so middleware and scripts share one cached runtime.

## Scripts

```sh
bun run check
bun run test
```

From the monorepo root:

```sh
bun --filter @edaya/adaptor-cloudflare test
```

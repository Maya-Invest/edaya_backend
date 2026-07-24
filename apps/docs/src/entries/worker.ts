/// <reference types="@cloudflare/workers-types" />

import type { DocsWorkerEnv } from '../runtime/worker-deps.ts'
import { createDocsApp } from '../composition.ts'
import { resolveWorkerDeps } from '../runtime/worker-deps.ts'

export default {
  async fetch(request: Request, env: DocsWorkerEnv, ctx: ExecutionContext) {
    const app = createDocsApp(resolveWorkerDeps(env))
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<DocsWorkerEnv>

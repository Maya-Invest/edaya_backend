/// <reference types="@cloudflare/workers-types" />

import app from "@/app";
import { parseRuntimeEnv } from "@/lib/runtime/env";

export default {
  async fetch(request: Request, bindings: Record<string, unknown>, executionCtx: ExecutionContext) {
    const env = parseRuntimeEnv(bindings, "worker");
    return app.fetch(request, env, executionCtx);
  },
} satisfies ExportedHandler<Record<string, unknown>>;

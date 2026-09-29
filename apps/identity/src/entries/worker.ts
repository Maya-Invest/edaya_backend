/// <reference types="@cloudflare/workers-types" />
import type { IdentityRuntime } from "../runtime";
import type { IdentitySigningKeys } from "../jwt-keys";
import app from "../app";
import { parseEnv } from "../env";
import { attachIdentityRuntime, createIdentityRuntime } from "../runtime";
import { maintenanceResponse, stagingSwitch } from "../staging-maintenance";

let cachedKeys: IdentitySigningKeys | undefined;
async function runtimeFor(bindings: Record<string, unknown>): Promise<IdentityRuntime> {
  const env = parseEnv(bindings, "worker");
  const runtime = await createIdentityRuntime(env, { keys: cachedKeys });
  cachedKeys = runtime.keys;
  attachIdentityRuntime(env, runtime);
  return runtime;
}
export default {
  async fetch(request: Request, bindings: Record<string, unknown>, ctx: ExecutionContext) {
    if (stagingSwitch(bindings, "STAGING_MAINTENANCE"))
      return maintenanceResponse();
    const runtime = await runtimeFor(bindings);
    try {
      return await app.fetch(request, runtime.env, ctx);
    }
    finally {
      ctx.waitUntil(runtime.close());
    }
  },
  async scheduled(_controller: ScheduledController, bindings: Record<string, unknown>, ctx: ExecutionContext) {
    void _controller;
    if (stagingSwitch(bindings, "STAGING_MAINTENANCE") || stagingSwitch(bindings, "STAGING_PAUSE_JOBS"))
      return;
    const runtime = await runtimeFor(bindings);
    ctx.waitUntil((async () => {
      try {
        await runtime.auth.purgeExpiredCredentials?.();
      }
      finally {
        await runtime.close();
      }
    })());
  },
} satisfies ExportedHandler<Record<string, unknown>>;

/// <reference types="@cloudflare/workers-types" />
import type { Context } from "hono";
import { publishSchoolChanges } from "@/cron/scheduler/runtime";
import { buildWorkerApiRuntime } from "@/runtime/worker/build-runtime";
import { drainRequestNotifications } from "@/runtime/shared/drain-request-notifications";
import type { AppBindings } from "@/http/bindings";
import type { ApiRuntime } from "@/runtime/types";

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  const existing = c.var.apiRuntime;
  if (existing) {
    return existing;
  }

  const runtime = await buildWorkerApiRuntime(c.env);
  c.set("apiRuntime", runtime);
  return runtime;
}

export async function closeRequestApiRuntime(c: Context<AppBindings>): Promise<void> {
  if (c.env.RUNTIME !== "worker") {
    return;
  }

  const runtime = c.var.apiRuntime;
  if (!runtime) {
    return;
  }

  c.set("apiRuntime", undefined);

  const finish = async () => {
    try {
      if (["GET", "HEAD", "OPTIONS"].includes(c.req.method))
        return;
      if (c.env.SCHEDULER_MODE !== "active")
        await drainRequestNotifications(runtime, c);
      if (c.env.SCHEDULER_MODE && c.env.SCHEDULER_MODE !== "legacy")
        await publishSchoolChanges(runtime);
    }
    finally {
      await runtime.close();
    }
  };

  const waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
  if (waitUntil) {
    waitUntil(finish());
    return;
  }

  await finish();
}

import type { Context } from "hono";
import { publishSchoolChanges } from "@/cron/scheduler/runtime";
import { getApiRuntime } from "@/runtime/local/registry";
import { drainRequestNotifications } from "@/runtime/shared/drain-request-notifications";
import type { AppBindings } from "@/http/bindings";
import type { ApiRuntime } from "@/runtime/types";

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  const existing = c.var.apiRuntime;
  if (existing) {
    return existing;
  }

  const runtime = await getApiRuntime(c.env);
  c.set("apiRuntime", runtime);
  return runtime;
}

export async function closeRequestApiRuntime(c: Context<AppBindings>): Promise<void> {
  const runtime = c.var.apiRuntime;
  if (!runtime || ["GET", "HEAD", "OPTIONS"].includes(c.req.method))
    return;
  if (c.env?.SCHEDULER_MODE !== "active")
    await drainRequestNotifications(runtime, c);
  if (c.env?.SCHEDULER_MODE && c.env.SCHEDULER_MODE !== "legacy") {
    try {
      await publishSchoolChanges(runtime);
    }
    catch (err) {
      c.var.logger?.error({ err }, "scheduler publication failed after commit");
    }
  }
}

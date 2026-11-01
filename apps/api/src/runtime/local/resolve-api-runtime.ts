import type { Context } from "hono";
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
  await drainRequestNotifications(c.var.apiRuntime, c);
}

import type { Context } from "hono";
import type { AppBindings } from "@/lib/http/types";
import { buildApiRuntime } from "@/lib/runtime/create-runtime";
import { getApiRuntime } from "@/lib/runtime/registry";
import type { ApiRuntime } from "@/lib/runtime/types";

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  if (c.env.RUNTIME === "worker") {
    const existing = c.get("apiRuntime");
    if (existing) {
      return existing;
    }

    const runtime = await buildApiRuntime(c.env);
    c.set("apiRuntime", runtime);
    return runtime;
  }

  return getApiRuntime(c.env);
}

export async function closeRequestApiRuntime(c: Context<AppBindings>): Promise<void> {
  if (c.env?.RUNTIME !== "worker") {
    return;
  }

  const runtime = c.get("apiRuntime");
  if (runtime) {
    await runtime.close();
    c.set("apiRuntime", undefined);
  }
}

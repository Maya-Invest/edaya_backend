import { createWorkerRequestRuntimeResolver } from "@edaya/adaptor-cloudflare";
import type { Context } from "hono";
import { buildApiRuntime } from "@/lib/runtime/create-runtime";
import { getApiRuntime } from "@/lib/runtime/registry";
import type { AppBindings } from "@/lib/http/types";
import type { ApiRuntime } from "@/lib/runtime/types";

const workerRequestRuntime = createWorkerRequestRuntimeResolver<
  AppBindings["Bindings"],
  ApiRuntime,
  AppBindings
>({
  get: c => c.var.apiRuntime,
  set: (c, runtime) => c.set("apiRuntime", runtime),
}, buildApiRuntime, runtime => runtime.close());

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  if (c.env.RUNTIME === "worker") {
    return workerRequestRuntime.resolve(c);
  }

  return getApiRuntime(c.env);
}

export async function closeRequestApiRuntime(c: Context<AppBindings>): Promise<void> {
  if (c.env?.RUNTIME !== "worker") {
    return;
  }

  return workerRequestRuntime.close(c);
}

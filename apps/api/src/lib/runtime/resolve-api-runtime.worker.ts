import { createWorkerRequestRuntimeResolver } from "@/lib/runtime/request-runtime";
import type { Context } from "hono";
import { buildWorkerApiRuntime } from "@/lib/runtime/create-runtime.worker";
import type { AppBindings } from "@/lib/http/types";
import type { ApiRuntime } from "@/lib/runtime/types";

const workerRequestRuntime = createWorkerRequestRuntimeResolver<
  AppBindings["Bindings"],
  ApiRuntime,
  AppBindings
>({
  get: c => c.var.apiRuntime,
  set: (c, runtime) => c.set("apiRuntime", runtime),
}, buildWorkerApiRuntime, runtime => runtime.close());

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  return workerRequestRuntime.resolve(c);
}

export async function closeRequestApiRuntime(c: Context<AppBindings>): Promise<void> {
  return workerRequestRuntime.close(c);
}

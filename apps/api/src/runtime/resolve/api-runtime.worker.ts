import { createWorkerRequestRuntimeResolver } from "@/runtime/resolve/request-runtime";
import type { Context } from "hono";
import { buildWorkerApiRuntime } from "@/runtime/worker/create-runtime";
import type { AppBindings } from "@/context/bindings";
import type { ApiRuntime } from "@/runtime/types";

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

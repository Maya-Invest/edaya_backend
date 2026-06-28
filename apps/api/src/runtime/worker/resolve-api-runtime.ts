import type { Context } from "hono";
import { buildWorkerApiRuntime } from "@/runtime/worker/build-runtime";
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

  await runtime.close();
  c.set("apiRuntime", undefined);
}

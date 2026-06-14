import type { Context } from "hono";
import { getApiRuntime } from "@/runtime/registry/node";
import type { AppBindings } from "@/context/bindings";
import type { ApiRuntime } from "@/runtime/types";

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  return getApiRuntime(c.env);
}

export async function closeRequestApiRuntime(_c: Context<AppBindings>): Promise<void> {

}

import type { Context } from "hono";
import { getApiRuntime } from "@/lib/runtime/registry";
import type { AppBindings } from "@/lib/http/types";
import type { ApiRuntime } from "@/lib/runtime/types";

export async function resolveApiRuntime(c: Context<AppBindings>): Promise<ApiRuntime> {
  return getApiRuntime(c.env);
}

export async function closeRequestApiRuntime(_c: Context<AppBindings>): Promise<void> {

}

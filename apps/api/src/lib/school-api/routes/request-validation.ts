import type { AppBindings } from "@/lib/http/types";
import type { Context } from "hono";

export function validatedJson(c: Context<AppBindings>): unknown {
  return (c.req as any).valid("json");
}

export function validatedParam(c: Context<AppBindings>): unknown {
  return (c.req as any).valid("param");
}

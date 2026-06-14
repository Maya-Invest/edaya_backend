import type { Context } from "hono";

export function isBetterAuthPath(c: Context): boolean {
  const path = c.req.path;
  return path === "/auth" || path.startsWith("/auth/");
}

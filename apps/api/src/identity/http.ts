import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/http/bindings";
import { resolveApiRuntime } from "@/runtime/resolve-api-runtime";
import { isAccountAuthRoute } from "./account-auth";

/** Authentication deliberately precedes school context and actor resolution. */
export const dispatchAuthentication: MiddlewareHandler<AppBindings> = async (c, next) => {
  const path = c.req.path;
  if (path === "/internal" || path.startsWith("/internal/"))
    return c.json({ code: "not_found" }, 404);
  if (path !== "/auth" && !path.startsWith("/auth/") && path !== "/.well-known/jwks.json")
    return next();
  if ((path === "/auth" || path.startsWith("/auth/")) && !isAccountAuthRoute(c.req.raw))
    return c.json({ code: "not_found" }, 404, { "cache-control": "no-store" });
  try {
    const runtime = await resolveApiRuntime(c);
    const identity = await runtime.getIdentityRuntime!();
    if (path === "/.well-known/jwks.json")
      return c.json(identity.keys.jwks, 200, { "cache-control": "public, max-age=60" });
    const url = new URL(c.req.raw.url);
    const request = new Request(new URL(url.pathname + url.search, c.env.API_ORIGIN), c.req.raw);
    return await identity.auth.handler(request);
  }
  catch { return c.json({ code: "authentication_unavailable" }, 503, { "cache-control": "no-store" }); }
  finally {
    // No school notifications were produced by the auth handler.
    if (c.env.RUNTIME === "worker" && c.var.apiRuntime) {
      const runtime = c.var.apiRuntime;
      c.set("apiRuntime", undefined);
      c.executionCtx.waitUntil(runtime.close());
    }
  }
};

import type { Environment } from "./env";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { IDENTITY_DIRECTORY_SECRET_HEADER } from "@maya-invest/edaya-identity-client";
import { toIdentityRequest } from "./auth-request";
import { resolveCorsOrigin } from "./cors";
import { lookupDirectoryByContact, resolveDirectoryById } from "./directory";
import type { IdentityRuntime } from "./runtime";
import { resolveIdentityRuntime } from "./runtime";

export interface IdentityAppEnv {
  Bindings: Environment;
  Variables: {
    runtime: IdentityRuntime;
  };
}
export function createIdentityApp() {
  const app = new Hono<IdentityAppEnv>();
  app.use(cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.env) ?? "",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "x-edaya-client",
      "Authorization",
      IDENTITY_DIRECTORY_SECRET_HEADER,
    ],
    credentials: true,
  }));
  app.use(bodyLimit({ maxSize: 1024 * 1024 }));
  app.use(async (c, next) => {
    const runtime = await resolveIdentityRuntime(c.env);
    c.set("runtime", runtime);
    await next();
  });
  app.get("/", c => c.json({ message: "Edaya Identity" }));
  app.get("/.well-known/jwks.json", (c) => {
    return c.json(c.var.runtime.keys.jwks, 200, { "cache-control": "public, max-age=60" });
  });
  app.get("/internal/directory/by-contact", c => lookupDirectoryByContact(c));
  app.get("/internal/directory/by-id/:subjectId", c => resolveDirectoryById(c));
  app.on(["GET", "POST"], "/auth/*", c => c.var.runtime.auth.handler(toIdentityRequest(c)));
  app.onError((err, c) => {
    const status = err instanceof Error && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;
    return c.json({ message: status >= 500 ? "Authentication service unavailable" : "Request rejected" }, status as 500);
  });
  return app;
}
const app = createIdentityApp();
export default app;

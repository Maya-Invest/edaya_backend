import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { accountRequiresPrivilegedTotp } from "@/lib/account-security-policy";
import configureOpenAPI from "@/http/openapi";
import createApp from "@/http/create-app";
import appRouter from "@/app-router";
import { mountGraphQLRoute } from "@/lib/graphql";

const app = createApp();

app.get("/internal/account-policy/:accountId", async (c) => {
  const provided = Buffer.from(c.req.header("x-edaya-directory-secret") ?? "");
  const expected = Buffer.from(c.env.IDENTITY_DIRECTORY_SECRET);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    return c.json({ message: "Unauthorized" }, 401);
  return c.json({ requiresTotp: c.env.REQUIRE_PRIVILEGED_TOTP === true && await accountRequiresPrivilegedTotp(c.var.schoolApp.repositories, c.req.param("accountId")) }, 200, { "cache-control": "no-store" });
});
configureOpenAPI(app);
mountGraphQLRoute(app);

const routes = [appRouter] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;

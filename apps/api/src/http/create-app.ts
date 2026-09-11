import { OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import type { AppBindings, AppOpenAPI } from "@/http/types";
import { resolveCorsOrigin } from "@/http/cors";
import { dependenciesInjection } from "@/http/dependencies";
import { pinoLogger } from "@/http/middleware/logger";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();

  // CORS first so error responses from later middleware still include ACAO headers.
  app.use(cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.env),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Academic-Year-Id",
      "X-Actor-Kind",
      "X-Actor-Id",
      "X-School-Id",
      "X-Request-Id",
      "Idempotency-Key",
    ],
    credentials: true,
  }));
  app.use(async (c, next) => {
    if (c.req.path.startsWith("/core/files/memory/")) {
      return next();
    }
    return bodyLimit({ maxSize: 1024 * 1024 })(c, next);
  });
  app.use(dependenciesInjection);

  app.use(serveEmojiFavicon("📝"));
  app.use(pinoLogger());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<R extends AppOpenAPI>(router: R) {
  return createApp().route("/", router);
}

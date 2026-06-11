import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import type { AppBindings, AppOpenAPI } from "@/lib/http/types";
import { dependenciesInjection } from "@/lib/http/dependencies";
import { pinoLogger } from "@/lib/http/middleware/logger";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

function corsOrigins(): string[] {
  const trusted = process.env.TRUSTED_ORIGINS;
  if (trusted) {
    return trusted.split(",").map(origin => origin.trim()).filter(Boolean);
  }
  return ["http://localhost:5173", "http://localhost:4173"];
}

export default function createApp() {
  const app = createRouter();
  const allowedOrigins = corsOrigins();

  app.use(cors({
    origin: (origin) => {
      if (!origin) {
        return allowedOrigins[0] ?? "http://localhost:5173";
      }
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Cookie", "X-Academic-Year-Id"],
    credentials: true,
  }));

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

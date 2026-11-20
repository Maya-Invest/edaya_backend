import type { AppBindings, AppOpenAPI } from "@/http/types";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import { resolveCorsOrigin } from "@/http/cors";
import { dependenciesInjection } from "@/http/dependencies";
import { pinoLogger } from "@/http/middleware/logger";
import { requestBodyLimit } from "@/http/middleware/request-body-limit";
import { dispatchAuthentication } from "@/identity/http";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook(result, context) {
      if (!result.success) {
        const command = context.req.path.split("/").at(-1);
        const legacyProposal = ["save-teacher-logbook", "request-teacher-correction", "revise-teacher-correction", "get-teacher-workflow-state"].includes(command ?? "")
          && result.error.issues.some(issue => issue.path.join(".") === "proposal.formatVersion");
        const legacyEntry = command === "record-lesson-session-progress" && result.error.issues.some(issue => issue.code === "unrecognized_keys" && issue.keys.includes("completedPercentage"));
        if (legacyProposal || legacyEntry)
          return context.json({ code: "LOGBOOK_UPGRADE_REQUIRED", message: "Update the app to save logbook chapters. Your drafts can be recovered after the update." }, 426);
      }
      return defaultHook(result, context);
    },
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
      "x-edaya-client",
      "Authorization",
      "X-Academic-Year-Id",
      "X-Actor-Kind",
      "X-Actor-Id",
      "X-School-Id",
      "X-Request-Id",
      "Idempotency-Key",
      "If-None-Match",
    ],
    exposeHeaders: ["ETag", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  }));
  app.use(requestBodyLimit);
  app.use(dispatchAuthentication);
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

import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "hono-pino";
import { logger } from "hono-pino";
import { randomUUID } from "node:crypto";

import type { AppBindings } from "@/context/bindings";
import { createAppLogger } from "@/logging/app-logger";

export { createAppLogger, createBetterAuthLogger, resetAppLoggersForTests, setAppLogDestinationForTests } from "@/logging/app-logger";

export function pinoLogger() {
  return ((c, next) => logger({
    pino: createAppLogger(c.env),
    http: {
      reqId: () => randomUUID(),
    },
  })(c as unknown as Context<Env>, next)) satisfies MiddlewareHandler<AppBindings>;
}

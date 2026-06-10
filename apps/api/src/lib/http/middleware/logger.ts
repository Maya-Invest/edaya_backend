import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "hono-pino";
import { logger } from "hono-pino";
import { randomUUID } from "node:crypto";

import type { AppBindings } from "@/lib/http/types";
import { createAppLogger } from "@/lib/logging/app-logger";

export function pinoLogger() {
  return ((c, next) => logger({
    pino: createAppLogger(c.env),
    http: {
      reqId: () => randomUUID(),
    },
  })(c as unknown as Context<Env>, next)) satisfies MiddlewareHandler<AppBindings>;
}

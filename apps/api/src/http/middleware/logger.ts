import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "hono-pino";
import { logger } from "hono-pino";
import { randomUUID } from "node:crypto";

import type { AppBindings } from "@/http/bindings";
import { createPinoLogger } from "@/runtime/shared/adapters/pino-logger";

export function pinoLogger() {
  return ((c, next) => logger({
    pino: createPinoLogger(c.env),
    http: {
      reqId: () => randomUUID(),
    },
  })(c as unknown as Context<Env>, next)) satisfies MiddlewareHandler<AppBindings>;
}

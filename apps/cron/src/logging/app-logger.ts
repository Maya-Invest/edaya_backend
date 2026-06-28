import type { Environment } from "@/runtime/shared/env/schema";
import pino from "pino";
import type { Logger } from "pino";
import pretty from "pino-pretty";

const loggers = new Map<string, Logger>();

function loggerCacheKey(env: Environment): string {
  return `${env.NODE_ENV}:${env.LOG_LEVEL}`;
}

export function createAppLogger(env: Environment): Logger {
  const key = loggerCacheKey(env);
  let instance = loggers.get(key);
  if (!instance) {
    const destination = env.NODE_ENV === "production" ? undefined : pretty();
    instance = pino({
      level: env.LOG_LEVEL || "info",
    }, destination);
    loggers.set(key, instance);
  }
  return instance;
}

export function resetAppLoggersForTests(): void {
  loggers.clear();
}

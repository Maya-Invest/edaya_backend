import type { LoggerPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";
import pino from "pino";
import type { Logger } from "pino";
import pretty from "pino-pretty";

const loggers = new Map<string, Logger>();
let testLogDestination: pino.DestinationStream | undefined;

function loggerCacheKey(env: Environment): string {
  return `${env.NODE_ENV}:${env.LOG_LEVEL}`;
}

export function createAppLogger(env: Environment): LoggerPort {
  const key = loggerCacheKey(env);
  let instance = loggers.get(key);
  if (!instance) {
    const destination = testLogDestination
      ?? (env.NODE_ENV === "production" ? undefined : pretty());
    instance = pino({
      level: env.LOG_LEVEL || "info",
      redact: {
        paths: [
          "authorization",
          "cookie",
          "password",
          "otp",
          "token",
          "secret",
          "accessToken",
          "refreshToken",
          "renewalCredential",
          "*.authorization",
          "*.cookie",
          "*.password",
          "*.otp",
          "*.token",
          "*.secret",
          "*.accessToken",
          "*.refreshToken",
          "*.renewalCredential",
          "req.headers.authorization",
          "req.headers.cookie",
          "request.headers.authorization",
          "request.headers.cookie",
          "res.headers[\"set-cookie\"]",
          "res.headers[\"set-auth-token\"]",
        ],
        censor: "[REDACTED]",
      },
    }, destination);
    loggers.set(key, instance);
  }
  return instance as LoggerPort;
}

/** Underlying Pino instance for HTTP middleware (hono-pino). */
export function createPinoLogger(env: Environment): Logger {
  return createAppLogger(env) as Logger;
}

export function resetAppLoggersForTests(): void {
  loggers.clear();
  testLogDestination = undefined;
}

/** Captures Pino output in tests without writing to stdout. */
export function setAppLogDestinationForTests(destination: pino.DestinationStream): void {
  testLogDestination = destination;
  loggers.clear();
}

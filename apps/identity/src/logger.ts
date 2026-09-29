import type { Environment } from "./env";
import type { Logger } from "pino";
import pino from "pino";
import pretty from "pino-pretty";

type BetterAuthLogLevel = "debug" | "info" | "warn" | "error";
const loggers = new Map<string, Logger>();
let testLogDestination: pino.DestinationStream | undefined;
function loggerCacheKey(env: Pick<Environment, "NODE_ENV" | "LOG_LEVEL" | "RUNTIME">): string {
  return `${env.RUNTIME}:${env.NODE_ENV}:${env.LOG_LEVEL}`;
}
export function createAppLogger(env: Pick<Environment, "NODE_ENV" | "LOG_LEVEL" | "RUNTIME">): Logger {
  const key = loggerCacheKey(env);
  let instance = loggers.get(key);
  if (!instance) {
    const destination = testLogDestination
      ?? (env.NODE_ENV === "production" || env.RUNTIME === "worker" ? undefined : pretty());
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
  return instance;
}
export function resetAppLoggersForTests(): void {
  loggers.clear();
  testLogDestination = undefined;
}
export function setAppLogDestinationForTests(destination: pino.DestinationStream): void {
  testLogDestination = destination;
  loggers.clear();
}
function mapLogLevelToBetterAuth(logLevel: Environment["LOG_LEVEL"]): BetterAuthLogLevel {
  switch (logLevel) {
    case "trace":
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
    case "fatal":
      return "error";
    default:
      return "warn";
  }
}
function publishToPino(logger: Logger, level: BetterAuthLogLevel, message: string, args: unknown[]): void {
  const log = logger[level].bind(logger) as (obj: object | string, msg?: string) => void;
  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
    log(args[0] as object, message);
    return;
  }
  if (args.length > 0) {
    log({ detail: args }, message);
    return;
  }
  log(message);
}
/**
 * Better Auth logger config backed by the shared application Pino instance.
 * Follows `LOG_LEVEL`; set `LOG_LEVEL=silent` to disable auth logs in tests.
 */
export function createBetterAuthLogger(env: Pick<Environment, "NODE_ENV" | "LOG_LEVEL" | "RUNTIME">) {
  if (env.LOG_LEVEL === "silent") {
    return { disabled: true as const };
  }
  const appLogger = createAppLogger(env).child({ module: "better-auth" });
  const level = mapLogLevelToBetterAuth(env.LOG_LEVEL);
  return {
    level,
    log: (logLevel: BetterAuthLogLevel, message: string, ...args: unknown[]) => {
      publishToPino(appLogger, logLevel, message, args);
    },
  };
}

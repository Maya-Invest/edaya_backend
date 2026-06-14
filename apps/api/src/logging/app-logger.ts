import type { Environment } from "@/runtime/env/schema";
import pino, { type Logger } from "pino";
import pretty from "pino-pretty";

type BetterAuthLogLevel = "debug" | "info" | "warn" | "error";

const loggers = new Map<string, Logger>();
let testLogDestination: pino.DestinationStream | undefined;

function loggerCacheKey(env: Environment): string {
  return `${env.NODE_ENV}:${env.LOG_LEVEL}`;
}

export function createAppLogger(env: Environment): Logger {
  const key = loggerCacheKey(env);
  let instance = loggers.get(key);
  if (!instance) {
    const destination = testLogDestination
      ?? (env.NODE_ENV === "production" ? undefined : pretty());
    instance = pino({
      level: env.LOG_LEVEL || "info",
    }, destination);
    loggers.set(key, instance);
  }
  return instance;
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

function publishToPino(
  logger: Logger,
  level: BetterAuthLogLevel,
  message: string,
  args: unknown[],
): void {
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
export function createBetterAuthLogger(env: Environment) {
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

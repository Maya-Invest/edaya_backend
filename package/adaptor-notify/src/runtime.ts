import type { NormalizedDeliveryEvent } from "@edaya/core";
import { resolveEmailFrom, resolveEmailTransport } from "./email/resolve";
import type { EmailTransportPort } from "./email/port";
import type { NotifyTransportEnv } from "./env";
import type { FcmTransport } from "./push/fcm";
import { resolveFcmTransport } from "./push/fcm";
import { createNotifySqlFromDrizzle } from "./store/sql";
import type { NotifySql } from "./store/types";

export interface NotifyRuntime {
  sql: NotifySql;
  email: EmailTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  log: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
}

export interface CreateNotifyRuntimeOptions {
  sql: NotifySql;
  env: NotifyTransportEnv;
  log?: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  email?: EmailTransportPort;
  fcm?: FcmTransport;
}

export function silentNotifyLog(): (message: string, extra?: Record<string, unknown>) => void {
  return () => {};
}

export function createNotifyRuntime(options: CreateNotifyRuntimeOptions): NotifyRuntime {
  const log = options.log ?? silentNotifyLog();
  return {
    sql: options.sql,
    email: options.email ?? resolveEmailTransport(options.env, log),
    fcm: options.fcm ?? resolveFcmTransport(options.env.FCM_SERVICE_ACCOUNT_JSON, log),
    from: resolveEmailFrom(options.env),
    log,
    onDeliveryEvent: options.onDeliveryEvent,
  };
}

export function createNotifyRuntimeFromDrizzle(options: {
  db: unknown;
  getExecutor?: () => unknown;
  env: NotifyTransportEnv;
  log?: CreateNotifyRuntimeOptions["log"];
  onDeliveryEvent?: CreateNotifyRuntimeOptions["onDeliveryEvent"];
  email?: EmailTransportPort;
  fcm?: FcmTransport;
}): NotifyRuntime {
  return createNotifyRuntime({
    sql: createNotifySqlFromDrizzle(options.db, options.getExecutor),
    env: options.env,
    log: options.log,
    onDeliveryEvent: options.onDeliveryEvent,
    email: options.email,
    fcm: options.fcm,
  });
}

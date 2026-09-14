import type { NormalizedDeliveryEvent, ResolveInvitationDispatchRecipient, ResolveNotificationDispatchRecipient } from "@edaya/core";
import type { EmailTransportPort } from "./email/port";
import type { NotifyTransportEnv } from "./env";
import type { FcmTransport } from "./push/fcm";
import type { NotifySql } from "./store/types";
import { resolveEmailFrom, resolveEmailTransport } from "./email/resolve";
import { resolveFcmTransport } from "./push/fcm";
import { createNotifySqlFromDrizzle } from "./store/sql";

export interface NotifyRuntime {
  sql: NotifySql;
  email: EmailTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  log: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
}

export interface CreateNotifyRuntimeOptions {
  sql: NotifySql;
  env: NotifyTransportEnv;
  log?: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
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
    resolveSchoolRecipient: options.resolveSchoolRecipient,
    resolveInvitationRecipient: options.resolveInvitationRecipient,
  };
}

export function createNotifyRuntimeFromDrizzle(options: {
  db: unknown;
  getExecutor?: () => unknown;
  env: NotifyTransportEnv;
  log?: CreateNotifyRuntimeOptions["log"];
  onDeliveryEvent?: CreateNotifyRuntimeOptions["onDeliveryEvent"];
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
  email?: EmailTransportPort;
  fcm?: FcmTransport;
}): NotifyRuntime {
  return createNotifyRuntime({
    sql: createNotifySqlFromDrizzle(options.db, options.getExecutor),
    env: options.env,
    log: options.log,
    onDeliveryEvent: options.onDeliveryEvent,
    resolveSchoolRecipient: options.resolveSchoolRecipient,
    resolveInvitationRecipient: options.resolveInvitationRecipient,
    email: options.email,
    fcm: options.fcm,
  });
}

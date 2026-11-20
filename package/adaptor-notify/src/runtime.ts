import type { EmailTransportPort, NormalizedDeliveryEvent, ResolveInvitationDispatchRecipient, ResolveNotificationDispatchRecipient, SmsTransportPort } from "@edaya/core";
import type { NotifyTransportEnv } from "./env";
import type { FcmTransport } from "./push/fcm";
import type { NotifySql } from "./store/types";
import { resolveEmailFrom } from "./env";
import { resolveFcmTransport } from "./push/fcm";
import { createNotifySqlFromDrizzle } from "./store/sql";

export interface NotifyRuntime {
  sql: NotifySql;
  deliverySql?: NotifySql;
  email: EmailTransportPort;
  sms: SmsTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  log: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
}

export interface CreateNotifyRuntimeOptions {
  sql: NotifySql;
  deliverySql?: NotifySql;
  env: NotifyTransportEnv;
  email: EmailTransportPort;
  sms: SmsTransportPort;
  log?: (message: string, extra?: Record<string, unknown>) => void;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
  fcm?: FcmTransport;
}

export function silentNotifyLog(): (message: string, extra?: Record<string, unknown>) => void {
  return () => {};
}

export function createNotifyRuntime(options: CreateNotifyRuntimeOptions): NotifyRuntime {
  const log = options.log ?? silentNotifyLog();
  return {
    sql: options.sql,
    deliverySql: options.deliverySql ?? options.sql,
    email: options.email,
    sms: options.sms,
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
  email: EmailTransportPort;
  sms: SmsTransportPort;
  log?: CreateNotifyRuntimeOptions["log"];
  onDeliveryEvent?: CreateNotifyRuntimeOptions["onDeliveryEvent"];
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
  fcm?: FcmTransport;
}): NotifyRuntime {
  return createNotifyRuntime({
    sql: createNotifySqlFromDrizzle(options.db, options.getExecutor),
    deliverySql: createNotifySqlFromDrizzle(options.db),
    env: options.env,
    email: options.email,
    sms: options.sms,
    log: options.log,
    onDeliveryEvent: options.onDeliveryEvent,
    resolveSchoolRecipient: options.resolveSchoolRecipient,
    resolveInvitationRecipient: options.resolveInvitationRecipient,
    fcm: options.fcm,
  });
}

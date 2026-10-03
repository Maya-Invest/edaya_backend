import { allowStagingNotification } from "@/staging-notifications";
import { createSystemActorMetadata } from "@edaya/authorization";
import { resolveInvitationDispatchRecipient, resolveNotificationDispatchRecipient } from "@edaya/service";
import { transactionContext } from "@edaya/adaptor-postgres";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import {
  createNotifyRuntimeFromDrizzle,
  drainPendingSchoolNotifications,
} from "@edaya/adaptor-notify";
import type { NotifyRuntime } from "@edaya/adaptor-notify";
import type { NormalizedDeliveryEvent } from "@edaya/core";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { composeIdentity } from "@/identity/composition";
import { applyInProcessNotifyDeliveryEvent } from "@/runtime/shared/adapters/notify-delivery-sink";
import { isNotifyConfigured } from "@/runtime/shared/adapters/notification-gateway";
import { resolveEmailTransport } from "@/runtime/shared/adapters/email-transport";
import { resolveSmsTransport } from "@/runtime/shared/adapters/sms-transport";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";
import type { IdentityClient } from "../../identity/server/index";

export interface InitSchoolApplicationExtras {
  identityClient: IdentityClient;
  notifyRuntime?: NotifyRuntime;
}

export interface CreateApiRuntimeOptions {
  env: Environment;
  identityClient?: IdentityClient;
  resolveSchoolHandle: () => Promise<DatabaseHandle>;
  initSchoolApplication: (
    db: PostgresTransactionalDb,
    extras: InitSchoolApplicationExtras,
  ) => Promise<ApiSchoolApplication>;
}

export async function createApiRuntime(options: CreateApiRuntimeOptions): Promise<ApiRuntime> {
  let schoolApplicationPromise: Promise<ApiSchoolApplication> | undefined;
  let closing: Promise<void> | undefined;
  let schoolApp: ApiSchoolApplication | null = null;
  let resolvedSchoolHandle: DatabaseHandle | null = null;
  let notifyRuntime: NotifyRuntime | undefined;
  const deliverySink: { apply?: (event: NormalizedDeliveryEvent) => Promise<void> } = {};

  async function getResolvedSchoolHandle(): Promise<DatabaseHandle> {
    resolvedSchoolHandle ??= await options.resolveSchoolHandle();
    return resolvedSchoolHandle;
  }

  async function getNotifyRuntime(): Promise<NotifyRuntime | undefined> {
    if (!isNotifyConfigured(options.env)) {
      return undefined;
    }
    if (notifyRuntime) {
      return notifyRuntime;
    }
    const handle = await getResolvedSchoolHandle();
    const logger = options.env.LOG_LEVEL !== "silent"
      ? createAppLogger(options.env)
      : undefined;
    const transportLog = logger
      ? (message: string, extra?: Record<string, unknown>) => logger.info(extra ?? {}, message)
      : () => {};
    notifyRuntime = createNotifyRuntimeFromDrizzle({
      db: handle.db,
      getExecutor: () => transactionContext.getStore() ?? handle.db,
      env: options.env,
      email: resolveEmailTransport(options.env, transportLog),
      sms: resolveSmsTransport(options.env, transportLog),
      log: logger
        ? (message, extra) => logger.info(extra ?? {}, message)
        : undefined,
      resolveSchoolRecipient: async (request) => {
        if (!schoolApp)
          throw new Error("School notification resolver is not initialized");
        const actor = createSystemActorMetadata({ systemId: "notify-adapter", schoolId: request.schoolId, requestId: `notify:${request.deliveryId}`, reason: "Resolve current notification recipient" });
        const profile = await resolveNotificationDispatchRecipient(schoolApp.forActor(actor).baseService, request);
        return allowStagingNotification(options.env.API_ORIGIN, profile?.email, options.env.STAGING_NOTIFICATION_EMAILS) ? profile : undefined;
      },
      resolveInvitationRecipient: async (request) => {
        if (!schoolApp)
          throw new Error("Invitation resolver is not initialized");
        const actor = createSystemActorMetadata({ systemId: "invitation-dispatch", schoolId: request.schoolId, requestId: `invitation:${request.invitationId}`, reason: "Resolve current invitation delivery" });
        // Invitation destinations are command-owned. The staging school-notification
        // allowlist must not cancel an address a staff member just invited.
        return resolveInvitationDispatchRecipient(schoolApp.forActor(actor).baseService, request);
      },
      onDeliveryEvent: async (event) => {
        await deliverySink.apply?.(event);
      },
    });
    return notifyRuntime;
  }

  const identity = composeIdentity(options.env, getSchoolApplication);
  const identityClient = options.identityClient ?? identity.client;

  function getSchoolApplication(): Promise<ApiSchoolApplication> {
    return schoolApplicationPromise ??= initializeSchoolApplication();
  }

  async function initializeSchoolApplication() {
    if (!schoolApp) {
      const handle = await getResolvedSchoolHandle();
      const runtime = await getNotifyRuntime();
      schoolApp = await options.initSchoolApplication(handle.db as PostgresTransactionalDb, {
        identityClient,
        notifyRuntime: runtime,
      });
      deliverySink.apply = async (event) => {
        await applyInProcessNotifyDeliveryEvent(schoolApp!, event);
      };
    }
    return schoolApp;
  }

  return {
    env: options.env,
    async drainNotifications() {
      await getSchoolApplication();
      const runtime = await getNotifyRuntime();
      if (runtime)
        await drainPendingSchoolNotifications(runtime);
    },
    getSchoolApplication,
    getIdentityRuntime: identity.resolve,
    getIdentityClient() {
      return identityClient;
    },
    close: () => closing ??= (async () => {
      const results = await Promise.allSettled([identity.close(), resolvedSchoolHandle?.dispose()]);
      const failures = results.filter(r => r.status === "rejected");
      if (failures.length)
        throw new AggregateError(failures.map(r => (r as PromiseRejectedResult).reason), "API cleanup failed");
    })(),
  };
}

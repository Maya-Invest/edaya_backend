import { transactionContext } from "@edaya/adaptor-postgres";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import {
  createNotifyRuntimeFromDrizzle,
  drainPendingSchoolNotifications,
  type NotifyRuntime,
} from "@edaya/adaptor-notify";
import type { NormalizedDeliveryEvent } from "@edaya/core";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createSchoolIdentityClient } from "@/runtime/shared/adapters/identity-client";
import { applyInProcessNotifyDeliveryEvent } from "@/runtime/shared/adapters/notify-delivery-sink";
import { isNotifyConfigured } from "@/runtime/shared/adapters/notification-gateway";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";
import type { IdentityClient } from "@maya-invest/edaya-identity-client";

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
    notifyRuntime = createNotifyRuntimeFromDrizzle({
      db: handle.db,
      getExecutor: () => transactionContext.getStore() ?? handle.db,
      env: options.env,
      log: logger
        ? (message, extra) => logger.info(extra ?? {}, message)
        : undefined,
      onDeliveryEvent: async (event) => {
        await deliverySink.apply?.(event);
      },
    });
    return notifyRuntime;
  }

  const identityClient = options.identityClient ?? createSchoolIdentityClient(options.env);

  return {
    env: options.env,
    async drainNotifications() {
      const runtime = await getNotifyRuntime();
      if (runtime)
        await drainPendingSchoolNotifications(runtime);
    },
    async getSchoolApplication() {
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
    },
    getIdentityClient() {
      return identityClient;
    },
    close: async () => {
      if (resolvedSchoolHandle) {
        await resolvedSchoolHandle.dispose();
      }
    },
  };
}

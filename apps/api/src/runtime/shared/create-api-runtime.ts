import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import {
  createNotifyRuntimeFromDrizzle,
  type NotifyRuntime,
} from "@edaya/adaptor-notify";
import type { NormalizedDeliveryEvent } from "@edaya/core";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createBetterAuth } from "@/runtime/shared/adapters/better-auth";
import { applyInProcessNotifyDeliveryEvent } from "@/runtime/shared/adapters/notify-delivery-sink";
import { isNotifyConfigured } from "@/runtime/shared/adapters/notification-gateway";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export interface InitSchoolApplicationExtras {
  notifyRuntime?: NotifyRuntime;
}

export interface CreateApiRuntimeOptions {
  env: Environment;
  authHandle: DatabaseHandle;
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

  const auth = createBetterAuth(options.authHandle.db, options.env, {
    ...(options.env.authSecondaryStorage
      ? { secondaryStorage: options.env.authSecondaryStorage }
      : {}),
    getNotifyRuntime: async () => {
      const runtime = await getNotifyRuntime();
      if (!runtime) {
        throw new Error("in-process notify runtime is not configured");
      }
      return runtime;
    },
  });

  return {
    env: options.env,
    async getSchoolApplication() {
      if (!schoolApp) {
        const handle = await getResolvedSchoolHandle();
        const runtime = await getNotifyRuntime();
        schoolApp = await options.initSchoolApplication(handle.db as PostgresTransactionalDb, {
          notifyRuntime: runtime,
        });
        deliverySink.apply = async (event) => {
          await applyInProcessNotifyDeliveryEvent(schoolApp!, event);
        };
      }
      return schoolApp;
    },
    getAuth() {
      return auth;
    },
    close: async () => {
      await options.authHandle.dispose();
      if (resolvedSchoolHandle) {
        await resolvedSchoolHandle.dispose();
      }
    },
  };
}

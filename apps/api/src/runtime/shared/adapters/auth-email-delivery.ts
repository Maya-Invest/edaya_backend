import {
  createNovuAuthEmailDeliveryPortFromSecretKey,
} from "@edaya/adaptor-novu";
import {
  createNotifyAuthEmailDeliveryPortFromLoader,
  type NotifyRuntime,
} from "@edaya/adaptor-notify";
import type { AuthEmailDeliveryPort } from "@edaya/core";
import { isNotifyConfigured } from "@/runtime/shared/adapters/notification-gateway";
import type { Environment } from "@/runtime/shared/env/schema";

export type AuthEmailDeliveryMode = "notify" | "novu" | "log";

export interface ResolvedAuthEmailDelivery {
  mode: AuthEmailDeliveryMode;
  port: AuthEmailDeliveryPort | null;
}

export interface ResolveAuthEmailDeliveryOptions {
  getNotifyRuntime?: () => Promise<NotifyRuntime>;
}

export function isAuthEmailDeliveryConfigured(env: Environment | undefined): boolean {
  if (!env || env.RUNTIME === "in-memory") {
    return false;
  }
  return isNotifyConfigured(env) || (env.NOTIFICATION_PROVIDER === "novu" && Boolean(env.NOVU_SECRET_KEY?.trim()));
}

export function shouldRequireEmailVerification(env: Environment | undefined): boolean {
  if (env?.REQUIRE_EMAIL_VERIFICATION === true) {
    return true;
  }
  if (env?.REQUIRE_EMAIL_VERIFICATION === false) {
    return false;
  }
  return isAuthEmailDeliveryConfigured(env);
}

export function resolveAuthEmailDelivery(
  env: Environment | undefined,
  options: ResolveAuthEmailDeliveryOptions = {},
): ResolvedAuthEmailDelivery {
  if (!env || env.RUNTIME === "in-memory") {
    return { mode: "log", port: null };
  }

  if (isNotifyConfigured(env)) {
    return {
      mode: "notify",
      port: createNotifyAuthEmailDeliveryPortFromLoader(async () => {
        const runtime = await options.getNotifyRuntime?.();
        if (!runtime) {
          throw new Error("in-process notify runtime is required for auth email delivery");
        }
        return runtime;
      }),
    };
  }

  if (env.NOTIFICATION_PROVIDER !== "novu" || !env.NOVU_SECRET_KEY) {
    return { mode: "log", port: null };
  }

  return {
    mode: "novu",
    port: createNovuAuthEmailDeliveryPortFromSecretKey({
      secretKey: env.NOVU_SECRET_KEY,
      serverURL: env.NOVU_API_URL,
    }),
  };
}

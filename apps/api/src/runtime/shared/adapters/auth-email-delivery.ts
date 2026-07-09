import {

  createNovuAuthEmailDeliveryPortFromSecretKey,
} from "@edaya/adaptor-novu";
import type { AuthEmailDeliveryPort } from "@edaya/adaptor-novu";
import type { Environment } from "@/runtime/shared/env/schema";

export type AuthEmailDeliveryMode = "novu" | "log";

export interface ResolvedAuthEmailDelivery {
  mode: AuthEmailDeliveryMode;
  port: AuthEmailDeliveryPort | null;
}

export function isAuthEmailDeliveryConfigured(env: Environment | undefined): boolean {
  if (!env || env.RUNTIME === "in-memory") {
    return false;
  }
  return Boolean(env.NOVU_SECRET_KEY?.trim());
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
): ResolvedAuthEmailDelivery {
  if (!env || env.RUNTIME === "in-memory" || !env.NOVU_SECRET_KEY) {
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

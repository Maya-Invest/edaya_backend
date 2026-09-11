import { createNovuInvitationDeliveryPortFromSecretKey } from "@edaya/adaptor-novu";
import { createNotifyInvitationDeliveryPort, type NotifyRuntime } from "@edaya/adaptor-notify";
import type { InvitationDeliveryPort } from "@edaya/core";
import { noOpInvitationDeliveryPort } from "@edaya/core";
import { isNotifyConfigured } from "@/runtime/shared/adapters/notification-gateway";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveInvitationDelivery(
  env: Environment | undefined,
  options: { runtime?: NotifyRuntime } = {},
): InvitationDeliveryPort {
  if (!env || env.RUNTIME === "in-memory") {
    return noOpInvitationDeliveryPort;
  }

  if (isNotifyConfigured(env) && options.runtime) {
    return createNotifyInvitationDeliveryPort(options.runtime);
  }

  if (env.NOTIFICATION_PROVIDER !== "novu" || !env.NOVU_SECRET_KEY) {
    return noOpInvitationDeliveryPort;
  }

  return createNovuInvitationDeliveryPortFromSecretKey({
    secretKey: env.NOVU_SECRET_KEY,
    serverURL: env.NOVU_API_URL,
  });
}

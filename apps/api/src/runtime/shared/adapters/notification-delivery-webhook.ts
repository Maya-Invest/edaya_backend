import { createNovuDeliveryWebhookAdapter } from "@edaya/adaptor-novu";
import type { NotificationDeliveryWebhookAdapter } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveNotificationDeliveryWebhookAdapter(
  env: Environment | undefined,
): NotificationDeliveryWebhookAdapter | undefined {
  if (!env?.NOVU_WEBHOOK_SECRET) {
    return undefined;
  }

  return createNovuDeliveryWebhookAdapter({
    webhookSecret: env.NOVU_WEBHOOK_SECRET,
  });
}

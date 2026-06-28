import { createNovuInvitationDeliveryPortFromSecretKey } from "@edaya/adaptor-novu";
import type { InvitationDeliveryPort } from "@edaya/core";
import { noOpInvitationDeliveryPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveInvitationDelivery(
  env: Environment | undefined,
): InvitationDeliveryPort {
  if (!env?.NOVU_SECRET_KEY) {
    return noOpInvitationDeliveryPort;
  }

  return createNovuInvitationDeliveryPortFromSecretKey({
    secretKey: env.NOVU_SECRET_KEY,
    serverURL: env.NOVU_API_URL,
  });
}

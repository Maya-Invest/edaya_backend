import { Novu } from "@novu/api";
import type { NotificationDeliveryStatusLookup } from "@edaya/core";
import { groupNovuMessagesByDeliveryId } from "./delivery-status";
import type { NovuApiMessageSnapshot } from "./delivery-status";

export interface NovuMessagesClient {
  lookupDeliveryStatuses: (
    deliveries: ReadonlyArray<{ deliveryId: string; subjectId: string }>,
  ) => Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>>;
}

export interface CreateNovuMessagesClientOptions {
  secretKey: string;
  serverURL?: string;
}

const NOVU_MESSAGES_PAGE_SIZE = 100;

function toMessageSnapshot(message: {
  id?: string;
  transactionId: string;
  subscriberId: string;
  status: string;
  read: boolean;
  seen: boolean;
  lastReadDate?: string;
  lastSeenDate?: string;
  deliveredAt?: string[];
  createdAt: string;
  errorText?: string;
}): NovuApiMessageSnapshot {
  return {
    id: message.id,
    transactionId: message.transactionId,
    subscriberId: message.subscriberId,
    status: message.status,
    read: message.read,
    seen: message.seen,
    lastReadDate: message.lastReadDate,
    lastSeenDate: message.lastSeenDate,
    deliveredAt: message.deliveredAt,
    createdAt: message.createdAt,
    errorText: message.errorText,
  };
}

export function createNovuMessagesClient(
  options: CreateNovuMessagesClientOptions,
): NovuMessagesClient {
  const novu = new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });

  return {
    lookupDeliveryStatuses: async (deliveries) => {
      if (deliveries.length === 0) {
        return new Map();
      }

      const transactionIds = [...new Set(deliveries.map(delivery => delivery.deliveryId))];
      const messages: NovuApiMessageSnapshot[] = [];
      let page = 0;

      while (true) {
        const response = await novu.messages.retrieve({
          transactionId: transactionIds,
          page,
          limit: NOVU_MESSAGES_PAGE_SIZE,
        });
        const result = response.result;
        messages.push(...result.data.map(toMessageSnapshot));
        if (!result.hasMore) {
          break;
        }
        page += 1;
      }

      return groupNovuMessagesByDeliveryId(messages);
    },
  };
}

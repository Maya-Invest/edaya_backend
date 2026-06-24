import { Novu } from "@novu/api";
import type { NotificationRecipientProfile } from "@edaya/core";
import { mapRecipientProfileToNovuSubscriber } from "./map-subscriber-profile";

export interface NovuSubscriberClient {
  upsert: (subscriberId: string, schoolId: string, profile: NotificationRecipientProfile) => Promise<void>;
  remove: (subscriberId: string) => Promise<void>;
}

export interface CreateNovuSubscriberClientOptions {
  secretKey: string;
  serverURL?: string;
}

export function createNovuSubscriberClient(
  options: CreateNovuSubscriberClientOptions,
): NovuSubscriberClient {
  const novu = new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });

  return {
    upsert: async (subscriberId, schoolId, profile) => {
      await novu.subscribers.create(
        mapRecipientProfileToNovuSubscriber(subscriberId, schoolId, profile),
      );
    },
    remove: async (subscriberId) => {
      await novu.subscribers.delete(subscriberId);
    },
  };
}

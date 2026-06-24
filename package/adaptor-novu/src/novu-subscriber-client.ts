import { Novu } from "@novu/api";
import type { NotificationRecipientProfile } from "@edaya/core";
import {
  mapRecipientProfileToNovuGlobalPreferences,
  mapRecipientProfileToNovuWorkflowPreferencesBulk,
} from "./map-subscriber-preferences";
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
      await novu.subscribers.preferences.update(
        mapRecipientProfileToNovuGlobalPreferences(schoolId, profile),
        subscriberId,
      );
      await novu.subscribers.preferences.bulkUpdate(
        mapRecipientProfileToNovuWorkflowPreferencesBulk(schoolId, profile),
        subscriberId,
      );
    },
    remove: async (subscriberId) => {
      await novu.subscribers.delete(subscriberId);
    },
  };
}

import { Novu } from "@novu/api";
import type { NotificationRecipientProfile } from "@edaya/core";
import {
  mapRecipientProfileToNovuGlobalPreferences,
  mapRecipientProfileToNovuWorkflowPreferencesBulk,
} from "./map-subscriber-preferences";
import { mapRecipientProfileToNovuSubscriber } from "./map-subscriber-profile";

export interface NovuSubscriberUpsertOptions {
  /** Skip per-workflow preference sync (used for transient invitation subscribers). */
  skipWorkflowPreferences?: boolean;
}

export interface NovuSubscriberClient {
  upsert: (
    subscriberId: string,
    schoolId: string,
    profile: NotificationRecipientProfile,
    options?: NovuSubscriberUpsertOptions,
  ) => Promise<void>;
  remove: (subscriberId: string) => Promise<void>;
}

export interface CreateNovuSubscriberClientOptions {
  secretKey: string;
  serverURL?: string;
}

export function isNovuSubscriberNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("statusCode" in error && error.statusCode === 404) {
    return true;
  }

  return "message" in error
    && typeof error.message === "string"
    && error.message.includes("Subscriber was not found");
}

export function createNovuSubscriberClient(
  options: CreateNovuSubscriberClientOptions,
): NovuSubscriberClient {
  const novu = new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });

  return {
    upsert: async (subscriberId, schoolId, profile, options) => {
      await novu.subscribers.create(
        mapRecipientProfileToNovuSubscriber(subscriberId, schoolId, profile),
      );
      await novu.subscribers.preferences.update(
        mapRecipientProfileToNovuGlobalPreferences(schoolId, profile),
        subscriberId,
      );
      if (!options?.skipWorkflowPreferences) {
        await novu.subscribers.preferences.bulkUpdate(
          mapRecipientProfileToNovuWorkflowPreferencesBulk(schoolId, profile),
          subscriberId,
        );
      }
    },
    remove: async (subscriberId) => {
      try {
        await novu.subscribers.delete(subscriberId);
      }
      catch (error) {
        if (!isNovuSubscriberNotFoundError(error)) {
          throw error;
        }
      }
    },
  };
}

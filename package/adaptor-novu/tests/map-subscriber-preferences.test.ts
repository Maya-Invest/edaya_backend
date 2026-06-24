import { describe, expect, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import {
  mapRecipientProfileToNovuGlobalPreferences,
  mapRecipientProfileToNovuWorkflowPreferencesBulk,
  NOVU_NOTIFICATION_WORKFLOW_IDS,
} from "../src/map-subscriber-preferences";

const baseProfile = {
  schoolId: "sch-edaya-central",
  recipient: {
    kind: MessageDeliveryRecipientKind.Guardian,
    id: "g1",
    subjectId: "auth-g1",
  },
  preferences: {
    allowsNotifications: true,
    channels: {
      email: true,
      sms: false,
      in_app: true,
    },
  },
} as const;

describe("mapRecipientProfileToNovuGlobalPreferences", () => {
  test("maps channel toggles and tenant context", () => {
    expect(mapRecipientProfileToNovuGlobalPreferences("sch-edaya-central", baseProfile)).toEqual({
      channels: {
        email: true,
        sms: false,
        inApp: true,
        push: false,
      },
      context: { tenant: "sch-edaya-central" },
    });
  });

  test("disables all channels when allowsNotifications is false", () => {
    const mapped = mapRecipientProfileToNovuGlobalPreferences("sch-edaya-central", {
      ...baseProfile,
      preferences: {
        ...baseProfile.preferences,
        allowsNotifications: false,
        channels: { email: true, sms: true, in_app: true },
      },
    });

    expect(mapped.channels).toEqual({
      email: false,
      sms: false,
      inApp: false,
      push: false,
    });
  });
});

describe("mapRecipientProfileToNovuWorkflowPreferencesBulk", () => {
  test("mirrors global channel settings on every known workflow id", () => {
    const mapped = mapRecipientProfileToNovuWorkflowPreferencesBulk("sch-edaya-central", baseProfile);

    expect(mapped.context).toEqual({ tenant: "sch-edaya-central" });
    expect(mapped.preferences).toHaveLength(NOVU_NOTIFICATION_WORKFLOW_IDS.length);
    expect(mapped.preferences).toEqual(
      NOVU_NOTIFICATION_WORKFLOW_IDS.map(workflowId => ({
        workflowId,
        channels: {
          email: true,
          sms: false,
          inApp: true,
          push: false,
        },
      })),
    );
  });
});

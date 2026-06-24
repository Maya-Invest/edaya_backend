import { describe, expect, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { mapRecipientProfileToNovuSubscriber } from "../src/map-subscriber-profile";

describe("mapRecipientProfileToNovuSubscriber", () => {
  test("maps profile fields and stores school metadata in data", () => {
    const mapped = mapRecipientProfileToNovuSubscriber("auth-g1", "school-1", {
      schoolId: "school-1",
      recipient: {
        kind: MessageDeliveryRecipientKind.Guardian,
        id: "g1",
        subjectId: "auth-g1",
      },
      displayName: "Grace Hopper",
      email: "grace@mail.com",
      phone: "+33600000000",
      preferences: {
        allowsNotifications: true,
        receivesAcademicReports: true,
      },
    });

    expect(mapped).toEqual({
      subscriberId: "auth-g1",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@mail.com",
      phone: "+33600000000",
      locale: undefined,
      data: {
        schoolId: "school-1",
        recipientKind: MessageDeliveryRecipientKind.Guardian,
        recipientId: "g1",
        preferences: {
          allowsNotifications: true,
          receivesAcademicReports: true,
        },
      },
    });
  });
});

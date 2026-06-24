import { describe, expect, mock, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import {
  buildNovuSubscriberId,
  createNovuNotificationGateway,
  mapNotificationToNovuTriggerRequest,
} from "../src";

describe("mapNotificationToNovuTriggerRequest", () => {
  test("maps recipients to subjectId subscriber ids and uses eventKey as workflowId", () => {
    const request = mapNotificationToNovuTriggerRequest({
      idempotencyKey: "report_card.published:rc1",
      schoolId: "school-1",
      kind: "event",
      eventKey: "report_card.published",
      title: "Report card",
      body: "Available now",
      recipients: [
        { kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "auth-g1" },
        { kind: MessageDeliveryRecipientKind.Student, id: "s1", subjectId: "auth-s1" },
      ],
      metadata: { resultId: "rc1" },
    });

    expect(request).toEqual({
      workflowId: "report_card.published",
      to: ["auth-g1", "auth-s1"],
      transactionId: "report_card.published:rc1",
      context: {
        tenant: "school-1",
      },
      payload: expect.objectContaining({
        title: "Report card",
        body: "Available now",
        eventKey: "report_card.published",
        metadata: { resultId: "rc1" },
      }),
    });
  });
});

describe("createNovuNotificationGateway", () => {
  test("enqueue triggers Novu and cancel uses idempotency key as transaction id", async () => {
    const trigger = mock(async () => {});
    const triggerBulk = mock(async () => {});
    const cancel = mock(async () => {});

    const gateway = createNovuNotificationGateway({
      client: { trigger, triggerBulk, cancel },
    });

    const input = {
      idempotencyKey: "assessment.due_soon:a1",
      schoolId: "school-1",
      kind: "job" as const,
      eventKey: "assessment.due_soon",
      title: "Due soon",
      body: "Tomorrow",
      recipients: [{ kind: MessageDeliveryRecipientKind.Student, id: "s1", subjectId: "auth-s1" }],
    };

    await gateway.enqueue(input);
    await gateway.cancel(input.idempotencyKey);

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(triggerBulk).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith("assessment.due_soon:a1");
    expect(buildNovuSubscriberId(input.recipients[0]!)).toBe("auth-s1");
  });

  test("swallows client errors and reports via onError", async () => {
    const onError = mock(() => {});
    const gateway = createNovuNotificationGateway({
      client: {
        trigger: async () => {
          throw new Error("novu unavailable");
        },
        triggerBulk: async () => {},
        cancel: async () => {},
      },
      onError,
    });

    await expect(gateway.enqueue({
      idempotencyKey: "test:1",
      schoolId: "school-1",
      kind: "event",
      eventKey: "test.event",
      title: "Title",
      body: "Body",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "auth-g1" }],
    })).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});

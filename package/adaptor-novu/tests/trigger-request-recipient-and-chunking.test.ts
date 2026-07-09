import { describe, expect, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import {
  chunkNovuTriggerRequests,
  defaultNovuWorkflowIdResolver,
  mapNotificationToNovuTriggerRequest,
} from "../src/trigger-request";

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

  test("uses a single subscriber id when only one recipient is targeted", () => {
    const request = mapNotificationToNovuTriggerRequest({
      idempotencyKey: "assessment.due_soon:a1",
      schoolId: "school-1",
      kind: "job",
      eventKey: "assessment.due_soon",
      title: "Due soon",
      body: "Tomorrow",
      recipients: [{ kind: MessageDeliveryRecipientKind.Student, id: "s1", subjectId: "auth-s1" }],
    }, defaultNovuWorkflowIdResolver);

    expect(request.to).toBe("auth-s1");
  });

  test("rejects enqueue input without subject-backed recipients", () => {
    expect(() => mapNotificationToNovuTriggerRequest({
      idempotencyKey: "test:1",
      schoolId: "school-1",
      kind: "event",
      eventKey: "test.event",
      title: "Title",
      body: "Body",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1" }],
    })).toThrow("NotificationEnqueueInput must include at least one recipient with subjectId");
  });
});

describe("chunkNovuTriggerRequests", () => {
  test("returns the original request when recipient count is within Novu limits", () => {
    const request = {
      workflowId: "announcement.published",
      to: ["auth-s1", "auth-s2"],
      transactionId: "announcement:1",
      context: { tenant: "school-1" },
      payload: {},
    };

    expect(chunkNovuTriggerRequests(request)).toEqual([request]);
  });

  test("splits oversized recipient lists into chunked trigger requests", () => {
    const recipients = Array.from({ length: 101 }, (_, index) => `auth-${index}`);
    const request = {
      workflowId: "announcement.published",
      to: recipients,
      transactionId: "announcement:bulk",
      context: { tenant: "school-1" },
      payload: {},
    };

    const chunks = chunkNovuTriggerRequests(request);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.to).toHaveLength(100);
    expect(chunks[1]?.to).toBe("auth-100");
    expect(chunks[1]?.transactionId).toBe("announcement:bulk:1");
  });
});

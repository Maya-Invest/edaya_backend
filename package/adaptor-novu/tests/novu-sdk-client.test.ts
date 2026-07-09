import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

const trigger = mock(async () => {});
const triggerBulk = mock(async () => {});
const cancel = mock(async () => {});

beforeAll(async () => {
  mock.module("@novu/api", () => ({
    Novu: class MockNovu {
      trigger = trigger;
      triggerBulk = triggerBulk;
      cancel = cancel;
    },
  }));
});

afterAll(async () => {
  mock.restore();
});

const request = {
  workflowId: "assessment.due_soon",
  to: "auth-s1",
  transactionId: "assessment.due_soon:a1",
  context: { tenant: "school-1" },
  payload: { title: "Due soon", body: "Tomorrow" },
};

describe("createNovuSdkClient", () => {
  beforeEach(() => {
    trigger.mockClear();
    triggerBulk.mockClear();
    cancel.mockClear();
  });

  test("triggers a single workflow with the transaction id", async () => {
    const { createNovuSdkClient } = await import("../src/novu-sdk-client");
    const client = createNovuSdkClient({ secretKey: "test-secret" });

    await client.trigger(request);

    expect(trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "assessment.due_soon",
        transactionId: "assessment.due_soon:a1",
      }),
      "assessment.due_soon:a1",
    );
  });

  test("uses trigger for a single bulk request and triggerBulk for multiple events", async () => {
    const { createNovuSdkClient } = await import("../src/novu-sdk-client");
    const client = createNovuSdkClient({ secretKey: "test-secret" });

    await client.triggerBulk([]);
    await client.triggerBulk([request]);
    await client.triggerBulk([
      request,
      { ...request, transactionId: "assessment.due_soon:a2", to: "auth-s2" },
    ]);

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(triggerBulk).toHaveBeenCalledTimes(1);
  });

  test("cancels deliveries by transaction id", async () => {
    const { createNovuSdkClient } = await import("../src/novu-sdk-client");
    const client = createNovuSdkClient({ secretKey: "test-secret" });

    await client.cancel("assessment.due_soon:a1");

    expect(cancel).toHaveBeenCalledWith("assessment.due_soon:a1");
  });
});

import type { NovuEmailRequest } from "../src/email-transport";
import { expect, test } from "bun:test";
import { createNovuEmailTransport, NOVU_EMAIL_WORKFLOW_ID } from "../src/email-transport";

test("every attempt replaces the provider destination without creating a business subscriber profile", async () => {
  const requests: NovuEmailRequest[] = [];
  const transport = createNovuEmailTransport({ trigger: async (request) => {
    requests.push(request);
  } });
  const input = { to: "first@example.test", from: { email: "school@example.test", name: "School" }, subject: "Notice", html: "<p>Private</p>", text: "Private", idempotencyKey: "delivery:login:email", correlation: { deliveryId: "delivery", schoolId: "school", subjectId: "login" } };
  await transport.send(input);
  await transport.send({ ...input, to: "current@example.test" });
  expect(requests.map(request => request.workflowId)).toEqual([NOVU_EMAIL_WORKFLOW_ID, NOVU_EMAIL_WORKFLOW_ID]);
  expect(requests.map(request => request.overrides.email.to)).toEqual([["first@example.test"], ["current@example.test"]]);
  expect(requests.every(request => request.overrides.email.replaceToRecipient)).toBe(true);
  expect(requests.map(request => request.to)).toEqual([{ subscriberId: "email:delivery:login:email" }, { subscriberId: "email:delivery:login:email" }]);
  expect(requests[0]!.payload).toMatchObject(input.correlation);
  expect(requests[1]!.transactionId).toBe(input.idempotencyKey);
});

test("provider failures reach the shared dispatcher retry mechanism", async () => {
  const transport = createNovuEmailTransport({ trigger: async () => {
    throw new Error("provider unavailable");
  } });
  await expect(transport.send({ to: "person@example.test", from: { email: "school@example.test" }, subject: "Notice", html: "Private", idempotencyKey: "delivery:email" })).rejects.toThrow("provider unavailable");
});

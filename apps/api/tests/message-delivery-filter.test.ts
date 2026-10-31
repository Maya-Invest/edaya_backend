import { describe, expect, test } from "bun:test";
import { messageDeliveryQuerySchema } from "../src/lib/school-api/schemas/entities";

describe("personal inbox matching schema", () => {
  test("preserves nested title/body substring filters and recipient scope for lists and counts", () => {
    const query = { subjectId: "subject", recipientKind: "staff", recipientId: "staff", $and: [{ $or: [{ eventKey: { $exists: false } }, { eventKey: { $ne: "conversation.message" } }] }, { $or: [{ title: { $contains: "échéance 100%_" } }, { body: { $contains: "échéance 100%_" } }] }], status: "sent", $limit: 25, $offset: 25 };
    expect(messageDeliveryQuerySchema.parse(query)).toEqual(query);
  });
  test("limits search size and field scope", () => {
    expect(messageDeliveryQuerySchema.safeParse({ title: { $contains: "x".repeat(201) } }).success).toBe(false);
    expect(messageDeliveryQuerySchema.parse({ recipientId: { $contains: "other-person" } })).toEqual({ recipientId: {} });
  });
});

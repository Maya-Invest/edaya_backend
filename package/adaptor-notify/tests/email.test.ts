import { describe, expect, test } from "bun:test";
import { createLogEmailTransport } from "../src/email/log";
import { resolveEmailTransport } from "../src/email/resolve";

describe("email transports", () => {
  test("log transport records a send", async () => {
    const calls: string[] = [];
    const transport = createLogEmailTransport(message => calls.push(message));
    const result = await transport.send({
      to: "a@b.c",
      from: { email: "noreply@edayaplus.com" },
      subject: "Hi",
      html: "<p>Hi</p>",
      idempotencyKey: "k1",
    });
    expect(result.providerMessageId).toBe("log:k1");
    expect(calls.length).toBe(1);
  });

  test("smtp is a documented swap point that is not implemented yet", () => {
    expect(() => resolveEmailTransport({ EMAIL_TRANSPORT: "smtp" }, () => {})).toThrow(/not implemented/);
  });
});

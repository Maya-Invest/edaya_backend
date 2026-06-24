import { describe, expect, test } from "bun:test";
import {
  computeNovuEmailWebhookSignature,
  normalizeRecipients,
  parseFromAddress,
  parseNovuEmailWebhookPayload,
  verifyNovuEmailWebhookSignature,
} from "../src/novu-email-webhook";

describe("parseNovuEmailWebhookPayload", () => {
  test("parses Novu email webhook body", () => {
    const body = JSON.stringify({
      to: ["parent@example.com"],
      from: "announcements@edaya.softilab.dev",
      subject: "School update",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(parseNovuEmailWebhookPayload(body)).toEqual({
      to: ["parent@example.com"],
      from: "announcements@edaya.softilab.dev",
      subject: "School update",
      html: "<p>Hello</p>",
      text: "Hello",
    });
  });
});

describe("verifyNovuEmailWebhookSignature", () => {
  test("verifies HMAC SHA-256 hex signature round-trip", async () => {
    const body = "{\"to\":[\"johndoe@example.com\"],\"from\":\"janedoe@example.com\",\"subject\":\"test\",\"html\":\" test \",\"text\":\"test\"}";
    const secret = "super-secret-key";

    const signature = await computeNovuEmailWebhookSignature(body, secret);
    expect(await verifyNovuEmailWebhookSignature(body, secret, signature)).toBe(true);
    expect(await verifyNovuEmailWebhookSignature(body, secret, "bad-signature")).toBe(false);
  });
});

describe("helpers", () => {
  test("normalizes recipient list", () => {
    expect(normalizeRecipients([" a@x.com ", "a@x.com", ""])).toEqual(["a@x.com"]);
  });

  test("parses from address with optional default name", () => {
    expect(parseFromAddress("Edaya <hello@edaya.softilab.dev>")).toEqual({
      email: "hello@edaya.softilab.dev",
      name: "Edaya",
    });
    expect(parseFromAddress("hello@edaya.softilab.dev", "Edaya")).toEqual({
      email: "hello@edaya.softilab.dev",
      name: "Edaya",
    });
  });
});

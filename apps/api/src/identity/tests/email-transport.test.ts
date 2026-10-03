import { describe, expect, test } from "bun:test";
import { createAuthEmailSenders } from "../email";
import { parseEnv } from "../env";

const silentLog = {
  info() { },
  warn() { },
  error() { },
};
function workerEnv(send: (message: unknown) => Promise<{
  messageId?: string;
}>) {
  return parseEnv({
    RUNTIME: "worker",
    NODE_ENV: "production",
    LOG_LEVEL: "silent",
    AUTH_DATABASE_URL: "pglite:memory",
    BETTER_AUTH_SECRET: "test-secret-placeholder-key-32chars",
    BETTER_AUTH_URL: "https://staging.identity.api.edayaplus.com",
    FIRST_PARTY_API_ORIGINS: "https://staging.school.api.edayaplus.com",
    EMAIL_TRANSPORT: "cloudflare",
    EMAIL_FROM: "EDAYA <noreply@edayaplus.com>",
    EMAIL: { send },
  }, "worker");
}
describe("cloudflare auth email", () => {
  test("sends structured OTP messages without MIME streams", async () => {
    const sent: unknown[] = [];
    const env = workerEnv(async (message) => {
      sent.push(message);
      return { messageId: "msg_otp" };
    });
    const mailer = createAuthEmailSenders(env, silentLog);
    await mailer.sendAuthVerificationOtp({
      email: "Parent@School.edu",
      otp: "246810",
      type: "email-verification",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      to: "parent@school.edu",
      from: { email: "noreply@edayaplus.com", name: "EDAYA" },
      subject: "Verify your EDAYA email",
      html: expect.stringContaining("246810"),
      text: expect.stringContaining("246810"),
    });
    expect(JSON.parse(JSON.stringify(sent[0]))).toEqual(sent[0]);
  });
  test("sends structured verification-link messages", async () => {
    const sent: unknown[] = [];
    const env = workerEnv(async (message) => {
      sent.push(message);
      return { messageId: "msg_link" };
    });
    const mailer = createAuthEmailSenders(env, silentLog);
    const url = "https://staging.identity.api.edayaplus.com/auth/verify-email?token=abc";
    await mailer.sendAuthVerificationEmail({
      email: "parent@school.edu",
      url,
      displayName: "Atoumbré",
    });
    expect(sent).toHaveLength(1);
    const payload = sent[0] as {
      html: string;
      text: string;
      from: {
        email: string;
        name: string;
      };
    };
    expect(payload.from).toEqual({ email: "noreply@edayaplus.com", name: "EDAYA" });
    expect(payload.html).toContain("Atoumbré");
    expect(payload.html).toContain(url);
    expect(payload.text).toContain("Atoumbré");
    expect(payload.text).toContain(url);
    expect(JSON.parse(JSON.stringify(sent[0]))).toEqual(sent[0]);
  });
});

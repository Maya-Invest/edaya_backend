import { describe, expect, spyOn, test } from "bun:test";
import { createAuthEmailSenders } from "../email";
import { parseEnv } from "../env";
import { parseTestingEnv } from "../testing/env";

const credentials = { CLOUDFLARE_EMAIL_ACCOUNT_ID: "test-account", CLOUDFLARE_EMAIL_API_TOKEN: "private-test-token" };
const otp = { email: " Parent@School.edu ", otp: "246810", type: "sign-in" as const };
const accepted = () => Response.json({ success: true, result: { delivered: [], queued: ["parent@school.edu"], permanent_bounces: [] } });
function localEnv(overrides: Record<string, unknown> = {}) {
  return parseEnv({
    NODE_ENV: "development",
    AUTH_DATABASE_URL: "pglite:memory",
    BETTER_AUTH_SECRET: "test-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:9999",
    FIRST_PARTY_API_ORIGINS: "http://localhost:9999",
    ...credentials,
    ...overrides,
  }, "local");
}
function logger() {
  const warnings: string[] = [];
  return { warnings, info() {}, error() {}, warn(_data: object, message?: string) {
    warnings.push(message ?? "");
  } };
}

describe("local auth email", () => {
  test("automatically sends the normalized recipient and existing OTP template through REST", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const timeout = spyOn(AbortSignal, "timeout");
    try {
      const sender = createAuthEmailSenders(localEnv(), logger(), { send: async (url, init) => {
        requests.push({ url, init });
        return accepted();
      } });
      await sender.sendAuthVerificationOtp(otp);
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe("https://api.cloudflare.com/client/v4/accounts/test-account/email/sending/send");
      expect(requests[0].init.method).toBe("POST");
      expect(requests[0].init.headers).toEqual({ "authorization": "Bearer private-test-token", "content-type": "application/json" });
      expect(requests[0].init.signal).toBeInstanceOf(AbortSignal);
      expect(timeout).toHaveBeenCalledWith(10000);
      expect(JSON.parse(requests[0].init.body as string)).toEqual({
        from: { address: "noreply@edayaplus.com", name: "EDAYA" },
        to: "parent@school.edu",
        subject: "Your EDAYA sign-in code",
        text: expect.stringContaining(otp.otp),
        html: expect.stringContaining(otp.otp),
      });
    }
    finally {
      timeout.mockRestore();
    }
  });

  test.each([
    ["absent credentials", { CLOUDFLARE_EMAIL_ACCOUNT_ID: undefined, CLOUDFLARE_EMAIL_API_TOKEN: undefined }, false],
    ["blank credentials", { CLOUDFLARE_EMAIL_ACCOUNT_ID: " ", CLOUDFLARE_EMAIL_API_TOKEN: " " }, false],
    ["explicit log override", { EMAIL_TRANSPORT: "log" }, false],
    ["missing token", { CLOUDFLARE_EMAIL_API_TOKEN: undefined }, true],
    ["missing account", { CLOUDFLARE_EMAIL_ACCOUNT_ID: undefined }, true],
    ["ordinary automated tests", { NODE_ENV: "test" }, false],
    ["Workers without a binding", { RUNTIME: "worker" }, false],
  ] as const)("does not send with %s", async (_name, overrides, warning) => {
    let sends = 0;
    const log = logger();
    const sender = createAuthEmailSenders(localEnv(overrides), log, { send: async () => {
      sends++;
      return accepted();
    } });
    await sender.sendAuthVerificationOtp(otp);
    expect(sends).toBe(0);
    expect(log.warnings).toHaveLength(warning ? 1 : 0);
    if (warning) {
      expect(log.warnings[0]).toContain("requires both CLOUDFLARE_EMAIL_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN");
      expect(log.warnings[0]).not.toContain(credentials.CLOUDFLARE_EMAIL_API_TOKEN);
    }
  });

  test("explicit testing-server wiring enables delivery without changing NODE_ENV", async () => {
    let sends = 0;
    const sender = createAuthEmailSenders(localEnv({ NODE_ENV: "test" }), logger(), {
      allowTestDelivery: true,
      send: async () => {
        sends++;
        return accepted();
      },
    });
    await sender.sendAuthVerificationOtp(otp);
    expect(sends).toBe(1);
  });

  test("preserves the Worker binding even when REST credentials are present", async () => {
    let bindingSends = 0;
    let restSends = 0;
    const sender = createAuthEmailSenders(localEnv({
      RUNTIME: "worker",
      EMAIL_TRANSPORT: "cloudflare",
      EMAIL: { send: async () => { bindingSends++; } },
    }), logger(), { send: async () => {
      restSends++;
      return accepted();
    } });
    await sender.sendAuthVerificationOtp(otp);
    expect(bindingSends).toBe(1);
    expect(restSends).toBe(0);
  });

  test("accepts immediate delivery and a plain sender address", async () => {
    const sender = createAuthEmailSenders(localEnv({ EMAIL_FROM: "noreply@edayaplus.com" }), logger(), { send: async (_url, init) => {
      expect(JSON.parse(init.body as string).from).toBe("noreply@edayaplus.com");
      return Response.json({ success: true, result: { delivered: ["parent@school.edu"], queued: [], permanent_bounces: [] } });
    } });
    await sender.sendAuthVerificationOtp(otp);
  });
});

test("testing configuration imports only email settings from the normal environment", () => {
  const env = parseTestingEnv({ EDAYA_TEST_PORT: "9876" }, {
    ...credentials,
    EMAIL_TRANSPORT: "cloudflare",
    EMAIL_FROM: "Dev <dev@edayaplus.com>",
    NODE_ENV: "production",
    RUNTIME: "worker",
    AUTH_DATABASE_URL: "postgres://remote.invalid/production",
    BETTER_AUTH_SECRET: "production-secret-must-not-be-imported",
    TRUSTED_ORIGINS: "https://remote.invalid",
    PHONE_AUTH_MODE: "sms_only",
  });
  expect(env).toMatchObject({
    ...credentials,
    EMAIL_TRANSPORT: "cloudflare",
    EMAIL_FROM: "Dev <dev@edayaplus.com>",
    NODE_ENV: "test",
    RUNTIME: "test",
    AUTH_DATABASE_URL: "pglite:memory",
    BETTER_AUTH_URL: "http://127.0.0.1:9876",
    PHONE_AUTH_MODE: "disabled",
  });
  expect(env.BETTER_AUTH_SECRET).not.toContain("production");
  expect(env.TRUSTED_ORIGINS).not.toContain("remote.invalid");
});

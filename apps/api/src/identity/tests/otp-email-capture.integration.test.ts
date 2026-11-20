import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createAuthEmailSenders } from "../email";
import { createTestingIdentity } from "../testing/composition";
import { parseTestingEnv } from "../testing/env";

const env = parseTestingEnv({}, { CLOUDFLARE_EMAIL_ACCOUNT_ID: "test-account", CLOUDFLARE_EMAIL_API_TOKEN: "private-test-token" });
const sent: { to: string; text: string }[] = [];
const warnings: string[] = [];
let respond: (to: string, signal: AbortSignal) => Promise<Response>;
let now = Date.now();
let fixture: Awaited<ReturnType<typeof createTestingIdentity>>;
function accept(to: string) {
  return Promise.resolve(Response.json({ success: true, result: { delivered: [], queued: [to], permanent_bounces: [] } }));
}
beforeAll(async () => {
  respond = accept;
  const email = createAuthEmailSenders(env, { info() {}, warn() {}, error() {} }, {
    allowTestDelivery: true,
    send: async (_url, init) => {
      const message = JSON.parse(init.body as string) as { to: string; text: string };
      sent.push(message);
      return respond(message.to, init.signal!);
    },
  });
  fixture = await createTestingIdentity(env, { now: () => now, emailDelivery: email.sendAuthVerificationOtp, warn: message => warnings.push(message) });
});
afterAll(async () => {
  await fixture.close();
});
function request(path: string, body: unknown, credential?: string) {
  return fixture.app.request(`${env.BETTER_AUTH_URL}/auth/edaya/${path}`, {
    method: "POST",
    headers: { "origin": "http://localhost:5173", "content-type": "application/json", "x-edaya-client": "native", ...(credential ? { authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify(body),
  }, env);
}
async function begin(value: string, credential?: string) {
  const response = await request(credential ? "identifiers/start" : "otp/start", { kind: value.startsWith("+") ? "phone" : "email", value }, credential);
  expect(response.status).toBe(200);
  return (await response.json() as { challenge: string }).challenge;
}
async function reveal(challenge: string, credential?: string) {
  const response = await request("testing/otp", { challenge }, credential);
  expect(response.status).toBe(200);
  return (await response.json() as { otp: string }).otp;
}

describe("email delivery with OTP extraction", () => {
  test("sends the captured code once, resends replacements, and verifies login and linking", async () => {
    const before = sent.length;
    const challenge = await begin("capture-email@example.com");
    expect(sent).toHaveLength(before + 1);
    const code = await reveal(challenge);
    expect(sent.at(-1)?.text).toContain(code);
    expect(await reveal(challenge)).toBe(code);
    expect(sent).toHaveLength(before + 1);

    now += 60001;
    const resent = await request("otp/resend", { challenge, action: "resend", requestId: crypto.randomUUID() });
    expect(resent.status).toBe(200);
    const replacement = (await resent.json() as { challenge: string }).challenge;
    expect(replacement).not.toBe(challenge);
    expect((await request("testing/otp", { challenge })).status).toBe(404);
    expect(sent).toHaveLength(before + 2);
    const nextCode = await reveal(replacement);
    expect(sent.at(-1)?.text).toContain(nextCode);
    const verified = await request("otp/verify", { challenge: replacement, code: nextCode });
    expect(verified.status).toBe(200);
    const offer = await verified.json() as { state: string; eligible: boolean; proof: string };
    expect(offer).toMatchObject({ state: "registration_required", eligible: true });
    const registered = await request("registration/complete", { challenge: replacement, proof: offer.proof });
    expect(registered.status).toBe(200);
    const token = (await registered.json() as { token: string }).token;
    expect(token).toBeTruthy();
    expect((await request("testing/otp", { challenge: replacement })).status).toBe(404);

    const linked = await begin("capture-linked@example.com", token);
    expect((await request("testing/otp", { challenge: linked })).status).toBe(401);
    const linkCode = await reveal(linked, token);
    expect(sent).toHaveLength(before + 3);
    expect(sent.at(-1)?.text).toContain(linkCode);
    expect((await request("otp/verify", { challenge: linked, code: linkCode }, token)).status).toBe(200);
  });

  test("phone channels remain capture-only", async () => {
    const before = sent.length;
    const challenge = await begin("+2250700000041");
    expect(await reveal(challenge)).toMatch(/^\d{6}$/);
    now += 60001;
    const response = await request("otp/resend", { challenge, action: "sms", requestId: crypto.randomUUID() });
    expect(response.status).toBe(200);
    const replacement = (await response.json() as { challenge: string }).challenge;
    expect(await reveal(replacement)).toMatch(/^\d{6}$/);
    expect(sent).toHaveLength(before);
  });

  test.each(["http-error", "provider-error", "bounce", "malformed", "invalid-json", "unknown-recipient", "timeout"])("keeps extraction and verification usable after %s", async (failure) => {
    const before = sent.length;
    const warningsBefore = warnings.length;
    // Shorten the real abort timer while checking production uses the 10-second bound.
    const timeout = failure === "timeout"
      ? spyOn(AbortSignal, "timeout").mockImplementation(() => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(new DOMException("private provider details", "TimeoutError")), 5);
          return controller.signal;
        })
      : undefined;
    respond = async (to, signal) => {
      switch (failure) {
        case "http-error": return new Response("private provider details", { status: 503 });
        case "provider-error": return Response.json({ success: false, errors: [{ message: "private provider details" }] });
        case "bounce": return Response.json({ success: true, result: { delivered: [], queued: [], permanent_bounces: [to] } });
        case "malformed": return Response.json({ success: true, result: {} });
        case "invalid-json": return new Response("not json");
        case "unknown-recipient": return Response.json({ success: true, result: { delivered: [], queued: ["someone-else@example.com"], permanent_bounces: [] } });
        default: return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }
    };
    try {
      const challenge = await begin(`capture-${failure}@example.com`);
      const code = await reveal(challenge);
      expect(sent).toHaveLength(before + 1);
      expect(warnings).toHaveLength(warningsBefore + 1);
      expect(warnings.at(-1)).toBe("Auth OTP email delivery failed; the captured test code remains available.");
      expect((await request("otp/verify", { challenge, code })).status).toBe(200);
      if (timeout)
        expect(timeout).toHaveBeenCalledWith(10000);
    }
    finally {
      timeout?.mockRestore();
      respond = accept;
    }
  });
});

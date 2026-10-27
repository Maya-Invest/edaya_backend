import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { createCapturedIdentity } from "../local/capture";
import { createOtpDelivery } from "../otp-delivery";
import { parseEnv } from "../env";

const origin = "http://127.0.0.1:9999";
const source = { NODE_ENV: "development", RUNTIME: "local", LOG_LEVEL: "silent", BETTER_AUTH_SECRET: "local-capture-disposable-secret-at-least-32-characters", BETTER_AUTH_URL: origin, FIRST_PARTY_API_ORIGINS: origin, TRUSTED_ORIGINS: origin, EMAIL_TRANSPORT: "log" };
test("development captures one delivered code and retains identities across restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "local-capture-"));
  const env = parseEnv({ ...source, AUTH_DATABASE_URL: `pglite:${root}/identity` }, "local");
  let sends = 0;
  let delivered = "";
  let capture = await createCapturedIdentity(env, { delivery: { async send(input) {
    sends++;
    delivered = input.code;
    return { status: "accepted" };
  } } });
  const request = (path: string, body: unknown) => capture.app.request(`${origin}/auth/edaya/${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }, env);
  async function signIn() {
    const start = await request("otp/start", { kind: "email", value: "seed@example.com", channel: "email" });
    expect(start.status).toBe(200);
    const { challenge } = await start.json() as { challenge: string };
    const peek = await request("testing/otp", { challenge });
    expect(peek.headers.get("cache-control")).toBe("no-store");
    const { otp } = await peek.json() as { otp: string };
    expect(otp).toBe(delivered);
    await request("testing/otp", { challenge });
    const verified = await request("otp/verify", { challenge, code: otp });
    expect(verified.status).toBe(200);
    return (await verified.json() as { user: { id: string } }).user.id;
  }
  try {
    const id = await signIn();
    expect(sends).toBe(1);
    expect(capture.runtime.env.NODE_ENV).toBe("development");
    expect(capture.runtime.env.PHONE_AUTH_MODE).toBe("disabled");
    await capture.close();
    capture = await createCapturedIdentity(env, { delivery: { async send(input) {
      sends++;
      delivered = input.code;
      throw new Error("private-provider-diagnostic");
    } }, warn: (message) => { expect(message).not.toContain("private-provider-diagnostic"); } });
    expect(await signIn()).toBe(id);
    expect(sends).toBe(2);
  }
  finally {
    await capture.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

test("capture stays usable without provider credentials and rejects remote or production use", async () => {
  const env = parseEnv({ ...source, AUTH_DATABASE_URL: "pglite:memory" }, "local");
  let calls = 0;
  const delivery = createOtpDelivery(env, async () => {
    calls++;
    throw new Error("unexpected network");
  });
  const capture = await createCapturedIdentity(env, { delivery });
  try {
    const challenge = await capture.runtime.accounts.begin({ kind: "email", value: "offline@example.com", channel: "email", ip: "local" });
    expect(challenge).toHaveProperty("challenge");
    expect(calls).toBe(0);
  }
  finally { await capture.close(); }
  for (const overrides of [{ NODE_ENV: "production" as const }, { AUTH_DATABASE_URL: "postgres://remote.example/auth" }, { RUNTIME: "worker" as const }])
    await expect(createCapturedIdentity({ ...env, ...overrides })).rejects.toThrow();
});

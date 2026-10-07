import type { OtpDeliveryPort } from "@edaya/account";
import type { Environment } from "../env";
import type { CreateIdentityRuntimeOptions } from "../runtime";
import type { AuthOtpDeliveryInput } from "../email";
import { appendFileSync, closeSync, fchmodSync, openSync } from "node:fs";
import { AuthError } from "@edaya/account";
import { z } from "zod";
import { createIdentityApp } from "../app";
import { attachIdentityRuntime, createIdentityRuntime } from "../runtime";
import { assertAuthRequest, authCredential } from "../request-policy";

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function assertTestingEnvironment(env: Environment) {
  if (env.NODE_ENV !== "test" || env.RUNTIME === "worker")
    throw new Error("OTP testing requires the local testing entry and NODE_ENV=test");
  const issuer = new URL(env.BETTER_AUTH_URL);
  if (issuer.protocol !== "http:" || !loopback.has(issuer.hostname))
    throw new Error("OTP testing must use an HTTP loopback issuer");
  if (!(env.AUTH_DATABASE_URL === "pglite" || env.AUTH_DATABASE_URL.startsWith("pglite:"))) {
    const database = new URL(env.AUTH_DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(database.protocol) || !loopback.has(database.hostname))
      throw new Error("OTP testing requires a local test database");
  }
}

/** The only composition that captures plaintext codes or installs OTP test routes. */
export async function createTestingIdentity(env: Environment, options: Pick<CreateIdentityRuntimeOptions, "now" | "privilegedPolicy"> & {
  mailbox?: string;
  emailDelivery?: (input: AuthOtpDeliveryInput) => Promise<void>;
  warn?: (message: string) => void;
} = {}) {
  assertTestingEnvironment(env);
  const now = options.now ?? Date.now;
  const captures = new Map<string, { otp: string; channel: string; expiresAt: number }>();
  if (options.mailbox) {
    const file = openSync(options.mailbox, "w", 0o600);
    fchmodSync(file, 0o600);
    closeSync(file);
  }
  function prune() {
    for (const [id, captured] of captures) {
      if (captured.expiresAt <= now())
        captures.delete(id);
    }
  }
  const delivery: OtpDeliveryPort = { async send(message) {
    prune();
    if (!message.attemptId)
      throw new Error("Test delivery requires a challenge ID");
    captures.set(message.attemptId, { otp: message.code, channel: message.channel, expiresAt: now() + 300000 });
    if (options.mailbox)
      appendFileSync(options.mailbox, `${JSON.stringify({ ...message, deliveredAt: Date.now() })}\n`, { mode: 0o600 });
    if (message.channel === "email" && options.emailDelivery) {
      try {
        await options.emailDelivery({ email: message.destination, otp: message.code, type: "sign-in" });
      }
      catch {
        // Never expose provider responses, credentials or OTPs in terminal warnings.
        (options.warn ?? console.error)("Auth OTP email delivery failed; the captured test code remains available.");
      }
    }
    return { status: "accepted" };
  } };
  const runtime = await createIdentityRuntime({ ...env, PHONE_AUTH_MODE: "whatsapp_first", PHONE_SMS_ROUTES: [{ prefix: "+225", provider: "africas_talking" }] }, { ...options, delivery });
  attachIdentityRuntime(env, runtime);
  const schema = z.object({ challenge: z.string().min(1).max(128) }).strict();
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
  const app = createIdentityApp((testApp) => {
    testApp.get("/auth/edaya/testing/capabilities", (c) => {
      try {
        assertAuthRequest(c.req.raw, env, false);
        return json({ otpAccess: true });
      }
      catch (error) {
        return json({ code: error instanceof AuthError ? error.code : "testing_unavailable" }, error instanceof AuthError ? error.status : 503);
      }
    });
    testApp.post("/auth/edaya/testing/otp", async (c) => {
      try {
        assertAuthRequest(c.req.raw, env);
        const { challenge } = schema.parse(await c.req.json());
        const status = await runtime.accounts.status(challenge, authCredential(c.req.raw, env));
        prune();
        if (status.lifecycle !== "pending") {
          captures.delete(challenge);
          return json({ code: "not_found" }, 404);
        }
        const captured = captures.get(challenge);
        if (!captured || captured.channel !== status.channel)
          return json({ code: "not_found" }, 404);
        return json({ challenge, otp: captured.otp, channel: status.channel, expiresAt: status.expiresAt });
      }
      catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError)
          return json({ code: "invalid_request" }, 400);
        if (error instanceof AuthError)
          return json({ code: error.code }, error.status === 400 ? 404 : error.status);
        return json({ code: "testing_unavailable" }, 503);
      }
    });
  });
  const cleanup = setInterval(prune, 60000);
  cleanup.unref();
  return { app, runtime, async close() {
    clearInterval(cleanup);
    captures.clear();
    await runtime.close();
  } };
}

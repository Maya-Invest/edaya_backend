import { createSmsRouter } from "@edaya/messaging";
import { attachIdentityRuntime } from "../runtime";
import type { Environment } from "../env";
import { assertCaptureEnvironment, createCapturedIdentity } from "../local/capture";

export function assertTestingEnvironment(env: Environment) {
  if (env.NODE_ENV !== "test")
    throw new Error("OTP testing requires NODE_ENV=test");
  assertCaptureEnvironment(env);
}

export async function createTestingIdentity(env: Environment, options: Parameters<typeof createCapturedIdentity>[1] = {}) {
  assertTestingEnvironment(env);
  const smsRouter = createSmsRouter([{ prefix: "+225", provider: "capture" }], {
    capture: {
      async send() {
        throw new Error("Test OTP delivery must be captured");
      },
    },
  });
  const captured = await createCapturedIdentity({ ...env, PHONE_AUTH_MODE: "whatsapp_first", SMS_ROUTES: [{ prefix: "+225", provider: "africas_talking" }] }, { ...options, smsRouter });
  attachIdentityRuntime(env, captured.runtime);
  return captured;
}

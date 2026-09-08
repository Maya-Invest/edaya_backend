import type { AuthEmailDeliveryPort } from "@edaya/core";
import { sendAuthOtp, sendAuthVerification } from "./operations";
import type { NotifyRuntime } from "./runtime";

export function createNotifyAuthEmailDeliveryPort(runtime: NotifyRuntime): AuthEmailDeliveryPort {
  return {
    sendOtp: async (input) => {
      await sendAuthOtp(runtime, input);
    },
    sendVerificationEmail: async (input) => {
      await sendAuthVerification(runtime, input);
    },
  };
}

export function createNotifyAuthEmailDeliveryPortFromLoader(
  loadRuntime: () => Promise<NotifyRuntime>,
): AuthEmailDeliveryPort {
  let cached: Promise<NotifyRuntime> | undefined;
  const runtime = (): Promise<NotifyRuntime> => {
    cached ??= loadRuntime();
    return cached;
  };
  return {
    sendOtp: async (input) => {
      await sendAuthOtp(await runtime(), input);
    },
    sendVerificationEmail: async (input) => {
      await sendAuthVerification(await runtime(), input);
    },
  };
}

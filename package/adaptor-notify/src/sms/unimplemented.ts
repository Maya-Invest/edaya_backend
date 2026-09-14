import type { SmsTransportPort } from "@edaya/core";

export function createUnimplementedSmsTransport(): SmsTransportPort {
  return {
    implemented: false,
    async send() {
      throw new Error("SMS transport is not implemented");
    },
  };
}

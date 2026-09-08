import { Novu } from "@novu/api";
import type { NovuTriggerClient, NovuTriggerRequest } from "./types";

export interface CreateNovuSdkClientOptions {
  secretKey: string;
  serverURL?: string;
}

function toNovuTriggerBody(request: NovuTriggerRequest): {
  workflowId: string;
  to: NovuTriggerRequest["to"];
  transactionId: string;
  context?: { tenant: string };
  payload: Record<string, unknown>;
} {
  return {
    workflowId: request.workflowId,
    to: request.to,
    transactionId: request.transactionId,
    ...(request.context ? { context: request.context } : {}),
    payload: request.payload,
  };
}

export function createNovuSdkClient(options: CreateNovuSdkClientOptions): NovuTriggerClient {
  const novu = new Novu({
    secretKey: options.secretKey,
    ...(options.serverURL ? { serverURL: options.serverURL } : {}),
  });

  return {
    trigger: async (request) => {
      await novu.trigger(toNovuTriggerBody(request), request.transactionId);
    },
    triggerBulk: async (requests) => {
      if (requests.length === 0) {
        return;
      }
      if (requests.length === 1) {
        await novu.trigger(toNovuTriggerBody(requests[0]!), requests[0]!.transactionId);
        return;
      }
      await novu.triggerBulk({
        events: requests.map(toNovuTriggerBody),
      }, requests[0]!.transactionId);
    },
    cancel: async (transactionId) => {
      await novu.cancel(transactionId);
    },
  };
}

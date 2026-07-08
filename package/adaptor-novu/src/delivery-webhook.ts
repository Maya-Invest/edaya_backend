import type { NormalizedDeliveryEvent, NotificationDeliveryWebhookAdapter } from "@edaya/core";
import { Webhook } from "svix";
import crypto from "node:crypto";

export type { NormalizedDeliveryEvent, NotificationDeliveryWebhookAdapter } from "@edaya/core";

export interface CreateNovuDeliveryWebhookAdapterOptions {
  webhookSecret: string;
}

interface NovuWebhookEnvelope {
  type?: string;
  event?: string;
  timestamp?: string;
  data?: unknown;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readStringField(record: Record<string, unknown>, field: string): string | undefined {
  return readString(record[field]);
}

function readRecordField(record: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  return readRecord(record[field]);
}

function normalizeEventType(type: string | undefined): string | undefined {
  if (!type) {
    return undefined;
  }
  return type.replace(/^messages\./, "message.");
}

function mapEventStatus(
  eventType: string | undefined,
): NormalizedDeliveryEvent["status"] | undefined {
  switch (normalizeEventType(eventType)) {
    case "message.delivered":
      return "sent";
    case "message.failed":
      return "failed";
    case "message.read":
    case "message.seen":
      return "read";
    default:
      return undefined;
  }
}

function extractMessageObject(data: unknown): Record<string, unknown> | undefined {
  const record = readRecord(data);
  if (!record) {
    return undefined;
  }
  return readRecord(readRecordField(record, "object")) ?? record;
}

function extractSubscriberId(message: Record<string, unknown>): string | undefined {
  const subscriber = readRecordField(message, "subscriber");
  return readStringField(message, "subscriberId")
    ?? readStringField(subscriber ?? {}, "subscriberId")
    ?? readStringField(subscriber ?? {}, "id");
}

function extractFailureReason(message: Record<string, unknown>): string | undefined {
  const error = readRecordField(message, "error");
  return readStringField(message, "failureReason")
    ?? readStringField(message, "reason")
    ?? readStringField(error ?? {}, "message")
    ?? readStringField(error ?? {}, "error");
}

function extractOccurredAt(
  envelope: NovuWebhookEnvelope,
  message: Record<string, unknown>,
): Date {
  const candidate = readString(envelope.timestamp)
    ?? readStringField(message, "updatedAt")
    ?? readStringField(message, "createdAt");
  if (candidate) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function parseEnvelope(rawBody: string): NormalizedDeliveryEvent[] {
  const envelope = JSON.parse(rawBody) as NovuWebhookEnvelope;
  const eventType = readString(envelope.type) ?? readString(envelope.event);
  const status = mapEventStatus(eventType);
  if (!status) {
    return [];
  }

  const message = extractMessageObject(envelope.data);
  if (!message) {
    return [];
  }

  const deliveryId = readStringField(message, "transactionId")
    ?? readStringField(message, "transaction_id");
  if (!deliveryId) {
    return [];
  }

  return [{
    deliveryId,
    status,
    providerMessageId: readStringField(message, "_id")
      ?? readStringField(message, "id")
      ?? readStringField(message, "messageId"),
    channel: readStringField(message, "channel"),
    failureReason: status === "failed" ? extractFailureReason(message) : undefined,
    occurredAt: extractOccurredAt(envelope, message),
    subjectId: extractSubscriberId(message),
  }];
}

export function createNovuDeliveryWebhookAdapter(
  options: CreateNovuDeliveryWebhookAdapterOptions,
): NotificationDeliveryWebhookAdapter {
  const verifier = new Webhook(options.webhookSecret);

  return {
    verifyRequest: async (request, rawBody) => {
      try {
        verifier.verify(rawBody, {
          "webhook-id": request.headers.get("webhook-id") ?? "",
          "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
          "webhook-signature": request.headers.get("webhook-signature") ?? "",
        });
        return true;
      }
      catch {
        return false;
      }
    },
    parseEvents: async rawBody => parseEnvelope(rawBody),
  };
}

/** Build a Svix-signed Request for local webhook smoke tests. */
export function buildSignedNovuWebhookRequest(
  webhookSecret: string,
  url: string,
  rawBody: string,
  messageId = `msg_sim_${crypto.randomUUID()}`,
): Request {
  const verifier = new Webhook(webhookSecret);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = verifier.sign(messageId, new Date(Number(timestamp) * 1000), rawBody);
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": messageId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body: rawBody,
  });
}

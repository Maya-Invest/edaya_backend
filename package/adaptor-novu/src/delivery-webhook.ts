import { buildNotifyChannelId, buildNotifyJobId } from "@edaya/adaptor-notify";
import type { NormalizedDeliveryEvent, NotificationDeliveryWebhookAdapter } from "@edaya/core";
import crypto from "node:crypto";
import { Webhook } from "svix";

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

  const payload = readRecordField(message, "payload") ?? {};
  const deliveryId = readStringField(payload, "deliveryId");
  const subjectId = readStringField(payload, "subjectId");
  const transactionId = readStringField(message, "transactionId");
  const schoolId = readStringField(payload, "schoolId");
  if (!deliveryId || !subjectId || readStringField(message, "channel") !== "email")
    return [];
  const version = readStringField(payload, "notificationCorrelationVersion");
  const currentCorrelation = version === "2" && schoolId && transactionId === buildNotifyChannelId(buildNotifyJobId("school", schoolId, deliveryId), subjectId, "email");
  // Signed late receipts retain their pre-cutover protocol and immutable IDs.
  // An explicitly versioned receipt must never fall back to that protocol.
  const legacyCorrelation = !("notificationCorrelationVersion" in payload) && transactionId === `${deliveryId}:${subjectId}:email`;
  if (!currentCorrelation && !legacyCorrelation)
    return [];

  return [{
    deliveryId,
    status,
    providerMessageId: readStringField(message, "_id")
      ?? readStringField(message, "id")
      ?? readStringField(message, "messageId"),
    channel: readStringField(message, "channel"),
    failureReason: status === "failed" ? "NOTIFY_PROVIDER_DELIVERY_FAILED" : undefined,
    occurredAt: extractOccurredAt(envelope, message),
    subjectId,
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

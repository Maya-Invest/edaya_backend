import { Webhook } from "svix";
import crypto from "node:crypto";

export interface NormalizedDeliveryEvent {
  deliveryId: string;
  status: "sent" | "failed" | "read" | "cancelled";
  providerMessageId?: string;
  channel?: string;
  failureReason?: string;
  occurredAt: Date;
  subjectId?: string;
}

export interface NotificationDeliveryWebhookAdapter {
  verifyRequest: (request: Request, rawBody: string) => Promise<boolean>;
  parseEvents: (rawBody: string) => Promise<NormalizedDeliveryEvent[]>;
}

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
  return readRecord(record.object) ?? record;
}

function extractSubscriberId(message: Record<string, unknown>): string | undefined {
  const subscriber = readRecord(message.subscriber);
  return readString(message.subscriberId)
    ?? readString(subscriber?.subscriberId)
    ?? readString(subscriber?.id);
}

function extractFailureReason(message: Record<string, unknown>): string | undefined {
  const error = readRecord(message.error);
  return readString(message.failureReason)
    ?? readString(message.reason)
    ?? readString(error?.message)
    ?? readString(error?.error);
}

function extractOccurredAt(
  envelope: NovuWebhookEnvelope,
  message: Record<string, unknown>,
): Date {
  const candidate = readString(envelope.timestamp)
    ?? readString(message.updatedAt)
    ?? readString(message.createdAt);
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

  const deliveryId = readString(message.transactionId)
    ?? readString(message.transaction_id);
  if (!deliveryId) {
    return [];
  }

  return [{
    deliveryId,
    status,
    providerMessageId: readString(message._id)
      ?? readString(message.id)
      ?? readString(message.messageId),
    channel: readString(message.channel),
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
    parseEvents: async (rawBody) => parseEnvelope(rawBody),
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

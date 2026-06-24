import type { NotificationDeliveryStatusLookup } from "@edaya/core";

export interface NovuApiMessageSnapshot {
  id?: string;
  transactionId: string;
  subscriberId?: string;
  status?: string;
  read?: boolean;
  seen?: boolean;
  lastReadDate?: string;
  lastSeenDate?: string;
  deliveredAt?: string[];
  createdAt?: string;
  errorText?: string;
}

const DELIVERY_STATUS_RANK: Record<NotificationDeliveryStatusLookup["status"], number> = {
  cancelled: 0,
  failed: 1,
  sent: 2,
  read: 3,
};

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function mapNovuApiMessageToDeliveryStatus(
  message: NovuApiMessageSnapshot,
): NotificationDeliveryStatusLookup | null {
  const occurredAt = parseDate(message.lastReadDate)
    ?? parseDate(message.lastSeenDate)
    ?? parseDate(message.deliveredAt?.[0])
    ?? parseDate(message.createdAt)
    ?? new Date();

  if (message.read || message.lastReadDate) {
    return {
      status: "read",
      providerMessageId: message.id,
      occurredAt,
    };
  }

  if (message.seen || message.lastSeenDate) {
    return {
      status: "read",
      providerMessageId: message.id,
      occurredAt,
    };
  }

  if (message.status === "error") {
    return {
      status: "failed",
      providerMessageId: message.id,
      failureReason: message.errorText ?? "Delivery failed",
      occurredAt,
    };
  }

  if (message.status === "sent" || message.status === "warning") {
    return {
      status: "sent",
      providerMessageId: message.id,
      occurredAt,
    };
  }

  return null;
}

function pickPreferredLookup(
  current: NotificationDeliveryStatusLookup | undefined,
  candidate: NotificationDeliveryStatusLookup,
): NotificationDeliveryStatusLookup {
  if (!current) {
    return candidate;
  }
  if (DELIVERY_STATUS_RANK[candidate.status] > DELIVERY_STATUS_RANK[current.status]) {
    return candidate;
  }
  if (DELIVERY_STATUS_RANK[candidate.status] < DELIVERY_STATUS_RANK[current.status]) {
    return current;
  }
  const currentAt = current.occurredAt?.getTime() ?? 0;
  const candidateAt = candidate.occurredAt?.getTime() ?? 0;
  return candidateAt >= currentAt ? candidate : current;
}

export function groupNovuMessagesByDeliveryId(
  messages: readonly NovuApiMessageSnapshot[],
): Map<string, NotificationDeliveryStatusLookup> {
  const grouped = new Map<string, NotificationDeliveryStatusLookup>();

  for (const message of messages) {
    const lookup = mapNovuApiMessageToDeliveryStatus(message);
    if (!lookup) {
      continue;
    }
    grouped.set(
      message.transactionId,
      pickPreferredLookup(grouped.get(message.transactionId), lookup),
    );
  }

  return grouped;
}

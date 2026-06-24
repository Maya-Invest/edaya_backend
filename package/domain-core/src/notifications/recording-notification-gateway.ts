import type {
  NotificationDeliveryStatusLookup,
  NotificationDeliveryStatusQuery,
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
} from '../ports/notification-gateway'

export class RecordingNotificationGateway implements NotificationGatewayPort {
  readonly enqueued: NotificationEnqueueInput[] = []
  readonly cancelled: string[] = []
  readonly upserted: NotificationRecipientProfile[] = []
  readonly removed: Array<{ schoolId: string, recipient: NotificationRecipient }> = []
  readonly statusLookups: NotificationDeliveryStatusQuery[][] = []
  private readonly enqueuedKeys = new Set<string>()
  private readonly statusLookupResults = new Map<string, NotificationDeliveryStatusLookup>()

  setStatusLookup(deliveryId: string, lookup: NotificationDeliveryStatusLookup): void {
    this.statusLookupResults.set(deliveryId, lookup)
  }

  async enqueue(input: NotificationEnqueueInput): Promise<void> {
    if (this.enqueuedKeys.has(input.idempotencyKey)) {
      return
    }
    this.enqueuedKeys.add(input.idempotencyKey)
    this.enqueued.push(input)
  }

  async cancel(idempotencyKey: string): Promise<void> {
    this.cancelled.push(idempotencyKey)
    this.enqueuedKeys.delete(idempotencyKey)
  }

  async upsertRecipient(profile: NotificationRecipientProfile): Promise<void> {
    this.upserted.push(profile)
  }

  async removeRecipient(schoolId: string, recipient: NotificationRecipient): Promise<void> {
    this.removed.push({ schoolId, recipient })
  }

  async lookupDeliveryStatuses(
    deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
  ): Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>> {
    this.statusLookups.push([...deliveries])
    const results = new Map<string, NotificationDeliveryStatusLookup>()
    for (const delivery of deliveries) {
      const lookup = this.statusLookupResults.get(delivery.deliveryId)
      if (lookup) {
        results.set(delivery.deliveryId, lookup)
      }
    }
    return results
  }

  clear(): void {
    this.enqueued.length = 0
    this.cancelled.length = 0
    this.upserted.length = 0
    this.removed.length = 0
    this.statusLookups.length = 0
    this.statusLookupResults.clear()
    this.enqueuedKeys.clear()
  }
}

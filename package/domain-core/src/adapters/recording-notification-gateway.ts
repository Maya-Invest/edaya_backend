import type {
  NotificationDeliveryStatusLookup,
  NotificationDeliveryStatusQuery,
  NotificationEnqueueInput,
  NotificationGatewayPort,
} from '../ports/gateways/notification-gateway'

export class RecordingNotificationGateway implements NotificationGatewayPort {
  readonly enqueued: NotificationEnqueueInput[] = []
  readonly cancelled: string[] = []
  readonly registeredPushDevices: Array<{ subjectId: string, schoolId: string, token: string, provider: 'fcm' | 'apns' }> = []
  readonly unregisteredPushDevices: Array<{ subjectId: string, schoolId: string, provider: 'fcm' | 'apns' }> = []
  readonly statusLookups: NotificationDeliveryStatusQuery[][] = []
  private readonly enqueuedKeys = new Set<string>()
  private readonly statusLookupResults = new Map<string, NotificationDeliveryStatusLookup>()

  setStatusLookup(schoolId: string, deliveryId: string, lookup: NotificationDeliveryStatusLookup): void {
    this.statusLookupResults.set(JSON.stringify([schoolId, deliveryId]), lookup)
  }

  async enqueue(input: NotificationEnqueueInput): Promise<void> {
    if (this.enqueuedKeys.has(JSON.stringify([input.schoolId, input.idempotencyKey]))) {
      return
    }
    this.enqueuedKeys.add(JSON.stringify([input.schoolId, input.idempotencyKey]))
    this.enqueued.push(input)
  }

  async cancel(idempotencyKey: string, schoolId: string): Promise<void> {
    this.cancelled.push(idempotencyKey)
    this.enqueuedKeys.delete(JSON.stringify([schoolId, idempotencyKey]))
  }

  async registerPushDevice(input: {
    subjectId: string
    schoolId: string
    token: string
    provider: 'fcm' | 'apns'
  }): Promise<void> {
    this.registeredPushDevices.push(input)
  }

  async unregisterPushDevice(input: {
    schoolId: string
    subjectId: string
    provider: 'fcm' | 'apns'
  }): Promise<void> {
    this.unregisteredPushDevices.push(input)
  }

  async lookupDeliveryStatuses(
    deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
  ): Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>> {
    this.statusLookups.push([...deliveries])
    const results = new Map<string, NotificationDeliveryStatusLookup>()
    for (const delivery of deliveries) {
      const lookup = this.statusLookupResults.get(JSON.stringify([delivery.schoolId, delivery.deliveryId]))
      if (lookup) {
        results.set(delivery.deliveryId, lookup)
      }
    }
    return results
  }

  clear(): void {
    this.enqueued.length = 0
    this.cancelled.length = 0
    this.registeredPushDevices.length = 0
    this.unregisteredPushDevices.length = 0
    this.statusLookups.length = 0
    this.statusLookupResults.clear()
    this.enqueuedKeys.clear()
  }
}

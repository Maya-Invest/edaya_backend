import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
} from '../ports/notification-gateway'

export class RecordingNotificationGateway implements NotificationGatewayPort {
  readonly enqueued: NotificationEnqueueInput[] = []
  readonly cancelled: string[] = []
  private readonly enqueuedKeys = new Set<string>()

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

  clear(): void {
    this.enqueued.length = 0
    this.cancelled.length = 0
    this.enqueuedKeys.clear()
  }
}

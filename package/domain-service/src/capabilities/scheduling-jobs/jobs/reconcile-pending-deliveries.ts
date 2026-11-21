import type { NotificationDeliveryStatusLookup } from '@edaya/core'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { MessageDeliveryStatus } from '@edaya/core'

const RECONCILE_BATCH_SIZE = 50
const RECONCILE_DELIVERY_LIMIT = 500

function toDeliveryStatus(
  status: NotificationDeliveryStatusLookup['status'],
): MessageDeliveryStatus.Sent | MessageDeliveryStatus.Failed | MessageDeliveryStatus.Read | MessageDeliveryStatus.Cancelled {
  switch (status) {
    case 'sent':
      return MessageDeliveryStatus.Sent
    case 'failed':
      return MessageDeliveryStatus.Failed
    case 'read':
      return MessageDeliveryStatus.Read
    case 'cancelled':
      return MessageDeliveryStatus.Cancelled
  }
}

async function listDeliveriesForReconcile(
  context: SchoolCronJobContext,
  status: MessageDeliveryStatus,
): Promise<Array<{ id: string, subjectId: string, status: MessageDeliveryStatus }>> {
  const { service, actor } = context
  const deliveries = await service.baseService.entities.messageDeliveries.list({
    schoolId: actor.schoolId,
    status,
    $limit: RECONCILE_DELIVERY_LIMIT,
  })

  return deliveries.map(delivery => ({
    id: delivery.id,
    subjectId: delivery.subjectId,
    status: delivery.status,
  }))
}

export async function reconcilePendingDeliveries(context: SchoolCronJobContext, changed?: Array<{ id: string, subjectId: string, status: MessageDeliveryStatus }>): Promise<CronJobResult> {
  const gateway = context.service.baseService.notificationGateway
  const deliveries = changed ?? [...await listDeliveriesForReconcile(context, MessageDeliveryStatus.Pending), ...await listDeliveriesForReconcile(context, MessageDeliveryStatus.Sent)]

  if (deliveries.length === 0) {
    return { processed: 0, skipped: 0 }
  }

  if (!gateway.lookupDeliveryStatuses) {
    return { processed: 0, skipped: deliveries.length }
  }

  let processed = 0
  let skipped = 0

  for (let index = 0; index < deliveries.length; index += RECONCILE_BATCH_SIZE) {
    const chunk = deliveries.slice(index, index + RECONCILE_BATCH_SIZE)
    const lookups = await gateway.lookupDeliveryStatuses(
      chunk.map(delivery => ({
        deliveryId: delivery.id,
        schoolId: context.actor.schoolId,
        subjectId: delivery.subjectId,
      })),
    )

    for (const delivery of chunk) {
      const lookup = lookups.get(delivery.id)
      if (!lookup) {
        skipped += 1
        continue
      }

      if (lookup.status === 'read' && delivery.status === MessageDeliveryStatus.Pending) {
        await context.service.communicationsWorkflow.applyDeliveryEvent({ deliveryId: delivery.id, status: MessageDeliveryStatus.Sent, providerMessageId: lookup.providerMessageId, occurredAt: lookup.occurredAt })
      }
      const updated = await context.service.communicationsWorkflow.applyDeliveryEvent({
        deliveryId: delivery.id,
        status: toDeliveryStatus(lookup.status),
        providerMessageId: lookup.providerMessageId,
        failureReason: lookup.failureReason,
        occurredAt: lookup.occurredAt,
      })

      if (updated && updated.status !== delivery.status) {
        processed += 1
      }
      else {
        skipped += 1
      }
    }
  }

  return { processed, skipped }
}

import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { deliveryInboxQuery, DomainValidationError, Permission } from '@edaya/core'
import { z } from 'zod'

const cursor = z.tuple([z.string().datetime(), z.string().min(1)])
export async function getDeliveryInbox(base: BaseSchoolService, input: { limit?: number, cursor?: string }) {
  const actor = base.actor
  if (actor.kind !== 'teacher' && actor.kind !== 'guardian')
    denyResourceAccess()
  const { limit = 30, cursor: value } = deliveryInboxQuery.parse(input)
  let after: { at: string, id: string } | undefined
  if (value !== undefined) {
    try {
      const [at, id] = cursor.parse(JSON.parse(value))
      after = { at, id }
    }
    catch {
      throw new DomainValidationError('Invalid inbox cursor')
    }
  }
  return base.atomicExecution.execute(async () => {
    const scope = await base.access.forOperation().scope(Permission.PERSONAL_COMMUNICATIONS_READ, 'messageDeliveries')
    return base.repositories.deliveryInbox.page(scope, limit, after)
  }, { readSnapshot: true })
}

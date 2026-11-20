import { MessageDelivery, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('native personal inbox filters recipient and literal text before counts and pagination', async () => {
  const f = await fixture('inbox-search')
  const date = new Date('2026-10-27T12:00:00Z')
  const recipient = { subjectId: f.id('editor'), recipientKind: MessageDeliveryRecipientKind.Staff, recipientId: f.id('editor') }
  for (let index = 0; index < 33; index++) {
    await f.r.messageDeliveries.save(new MessageDelivery({ id: f.id(`delivery-${String(index).padStart(2, '0')}`), schoolId: f.id('school'), ...recipient, ...(index === 27 ? { recipientId: 'other-staff' } : index === 28 ? { subjectId: 'other-login' } : index === 29 ? { eventKey: 'conversation.message' } : {}), title: index === 30 ? 'FRAIS 100xx' : index < 30 && index % 2 ? 'FRAIS 100%_ échéance' : 'School notice', body: index === 30 || index === 31 ? 'No match' : index % 2 ? 'No match' : 'Saved frais 100%_ body', status: index === 32 ? MessageDeliveryStatus.Pending : MessageDeliveryStatus.Sent, sentAt: index === 32 ? undefined : date, createdAt: date }))
  }
  const filter = { ...recipient, status: { $in: [MessageDeliveryStatus.Sent, MessageDeliveryStatus.Read] }, $and: [{ $or: [{ eventKey: { $exists: false } }, { eventKey: { $ne: 'conversation.message' } }] }, { $or: [{ title: { $contains: 'frais 100%_' } }, { body: { $contains: 'frais 100%_' } }] }] }
  const repository = f.editor.baseService.entities.messageDeliveries
  expect(await repository.count(filter)).toBe(27)
  const first = await repository.list({ ...filter, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 25 })
  const second = await repository.list({ ...filter, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 25, $offset: 25 })
  expect(first).toHaveLength(25)
  expect(second.map(row => row.id)).toEqual([f.id('delivery-25'), f.id('delivery-26')])
  expect([...first, ...second].every(row => row.subjectId === recipient.subjectId && row.recipientId === recipient.recipientId)).toBe(true)
})

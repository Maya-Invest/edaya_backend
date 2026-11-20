import type { Conversation } from '@edaya/core'
import { conversationsQuerySchema, School, withShortName } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('conversation search covers authorized history and participants before counts and paging', async () => {
  const f = await fixture('conversation-search')
  const ids = Array.from({ length: 32 }, (_, index) => f.id(`thread-${String(index).padStart(2, '0')}`))
  const now = '2026-10-27T12:00:00.000Z'
  async function save(id: string, index: number, schoolId = f.id('school')) {
    const row: Conversation = { id, schoolId, guardianId: f.id('guardian'), destination: index === 29 ? 'teacher' : 'school', teacherId: index === 29 ? f.id('teacher') : undefined, assignmentIds: [], subject: index === 27 ? 'Needle 100%_ in subject' : 'General enquiry', guardianName: index === 28 ? 'Needle 100%_ Parent' : 'Sam Parent', teacherName: index === 29 ? 'Needle 100%_ Teacher' : undefined, schoolName: 'Oak School', studentName: 'Robin Student', status: index === 27 ? 'resolved' : 'awaiting_school', version: 2, lastSequence: 2, lastMessage: 'Recent preview does not match', createdAt: now, updatedAt: now, awaitingSince: now }
    await f.r.conversations.save(row)
    for (const sequence of [1, 2]) await f.r.conversations.append({ id: `${id}-message-${sequence}`, schoolId, conversationId: id, sequence, authorKind: sequence === 1 ? 'guardian' : 'staff', authorId: sequence === 1 ? f.id('guardian') : f.id('editor'), authorSubjectId: f.id('subject'), authorName: sequence === 1 ? 'Sam Parent' : 'Ada Staff', createdAt: now, body: sequence === 1 && index < 27 ? `${'Earlier content '.repeat(30)}nEeDlE 100%_` : index === 31 ? 'Needle 100xx' : 'Recent message does not match' })
  }
  for (const [index, id] of ids.entries()) await save(id, index)
  await save(f.id('forbidden-thread'), 0)
  await f.r.schools.save(new School(withShortName({ id: 'other-school', name: 'Other school', timeZone: 'UTC', ownerSubjectId: f.id('other-owner'), financeCurrency: 'XOF' })))
  await save(f.id('other-school'), 0, 'other-school')
  const scope = { schoolId: f.id('school'), ids: [...ids, f.id('other-school')], profileKind: 'staff' as const, profileId: f.id('editor') }
  const query = (input: Parameters<typeof conversationsQuerySchema.parse>[0]) => conversationsQuerySchema.parse(input)
  const first = await f.r.conversations.list(scope, query({ search: '  NEEDLE 100%_  ', limit: 25 }))
  const second = await f.r.conversations.list(scope, query({ search: 'needle 100%_', offset: 25, limit: 25 }))
  expect(first.total).toBe(30)
  expect(first.unreadCount).toBe(30)
  expect(first.items).toHaveLength(25)
  expect(second.items).toHaveLength(5)
  expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(30)
  expect([...first.items, ...second.items].every(row => ids.includes(row.id))).toBe(true)
  expect((await f.r.conversations.list(scope, query({ search: 'needle 100%_', destination: 'teacher' }))).items.map(row => row.id)).toEqual([ids[29]!])
  expect((await f.r.conversations.list(scope, query({ search: 'needle 100%_', status: 'resolved' }))).total).toBe(1)
  expect((await f.r.conversations.list(scope, query({ search: '   ' }))).total).toBe(32)
  expect((await f.r.conversations.list(scope, query({ search: '\'); drop table conversations;--' }))).total).toBe(0)
})

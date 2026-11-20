import type { NotificationEnqueueInput } from '@edaya/core'
import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Guardian, GuardianStudentLink, Permission, StaffMember, StaffPermissionAssignment, Teacher, TeacherAssignment, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { dispatchConversationNotifications, resolveNotificationDispatchRecipient } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

async function fixture() {
  const notifications: NotificationEnqueueInput[] = []
  const f = await createReportCardContext({ notificationGateway: { enqueue: async (input) => {
    notifications.push(input)
  }, cancel: async () => {} } })
  const context = { schoolId: 'sch1', academicYearId: 'ay1', authenticatedAt: new Date(), requestId: 'messages', assuranceLevel: ActorAssuranceLevel.Verified }
  const guardian = f.forActor(createGuardianActorMetadata({ ...context, guardianId: 'gua1', subjectId: 'subject-gua1' }))
  await f.repositories.teachers.save(new Teacher({ id: 'teacher1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Teacher', subjectId: 'teacher-subject' }))
  for (const [id, kind] of [['math-assignment', TeacherAssignmentKind.Subject], ['homeroom-assignment', TeacherAssignmentKind.Homeroom]] as const)
    await f.repositories.teacherAssignments.save(new TeacherAssignment({ id, teacherId: 'teacher1', academicYearId: 'ay1', classGroupId: 'cg1', classSubjectId: kind === TeacherAssignmentKind.Subject ? 'cs1' : undefined, kind }))
  const teacher = f.forActor(createTeacherActorMetadata({ ...context, teacherId: 'teacher1', subjectId: 'teacher-subject' }))
  await f.repositories.staffMembers.save(new StaffMember({ id: 'secretary', schoolId: 'sch1', firstName: 'School', lastName: 'Secretary', subjectId: 'secretary-subject' }))
  for (const permission of [Permission.SCHOOL_MESSAGES_READ, Permission.SCHOOL_MESSAGES_REPLY, Permission.TEACHER_MESSAGES_REVIEW])
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'sch1', staffId: 'secretary', academicYearId: 'ay1', permission, scopes: [{ kind: 'school' }] }))
  const secretary = f.forActor(createStaffActorMetadata({ ...context, staffMemberId: 'secretary', subjectId: 'secretary-subject' }))
  return { ...f, guardian, teacher, secretary, notifications, context }
}
const teacherMessage = { requestId: 'new-teacher', destination: 'teacher' as const, teacherId: 'teacher1', studentId: 'stu1', subject: 'Homework question', body: 'Which exercise should we complete?' }
const schoolMessage = { requestId: 'new-school', destination: 'school' as const, subject: 'Opening hours', body: 'When does the office open?' }
async function endTeaching(f: Awaited<ReturnType<typeof fixture>>) {
  for (const id of ['math-assignment', 'homeroom-assignment']) {
    const assignment = (await f.repositories.teacherAssignments.findById(id))!
    await f.repositories.teacherAssignments.save(new TeacherAssignment({ ...assignment.data, status: TeacherAssignmentStatus.Ended, endsAt: new Date() }))
  }
}

describe('guardian messaging through native SQL and workflow boundaries', () => {
  test('teacher starts one pupil thread for the chosen guardian and retries the same first message', async () => {
    const f = await fixture()
    const scope = { classGroupId: 'cg1', studentId: 'stu1' }
    const input = { ...scope, guardianId: 'gua1', subject: 'Exercise', body: 'Please check your notebook.', requestId: 'teacher-start' }
    expect((await f.teacher.listTeacherGuardianRecipients(scope)).guardians.map(row => row.id)).toContain('gua1')
    await expect(f.teacher.listTeacherGuardianRecipients({ ...scope, classGroupId: 'wrong' })).rejects.toThrow()
    await expect(f.teacher.conversationsWorkflow.startTeacher({ ...input, guardianId: 'unlinked' })).rejects.toThrow()
    await f.repositories.guardians.save(new Guardian({ id: 'gua2', schoolId: 'sch1', firstName: 'Second', lastName: 'Guardian', subjectId: 'subject-gua2' }))
    await f.repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link2', schoolId: 'sch1', guardianId: 'gua2', studentId: 'stu1' }))
    const other = f.forActor(createGuardianActorMetadata({ ...f.context, guardianId: 'gua2', subjectId: 'subject-gua2' }))
    expect((await f.teacher.listTeacherGuardianRecipients(scope)).guardians).toHaveLength(2)
    const thread = await f.teacher.conversationsWorkflow.startTeacher(input)
    expect(thread.status).toBe('awaiting_guardian')
    expect((await f.teacher.conversationsWorkflow.startTeacher(input)).id).toBe(thread.id)
    const detail = await f.guardian.getConversation({ conversationId: thread.id })
    expect(detail.messages.map(row => row.authorKind)).toEqual(['teacher'])
    expect(detail.conversation.guardianId).toBe('gua1')
    expect((await other.listConversations({})).total).toBe(0)
    await expect(other.getConversation({ conversationId: thread.id })).rejects.toThrow()
    await f.repositories.guardianLinks.delete('link')
    await expect(f.teacher.conversationsWorkflow.startTeacher({ ...input, requestId: 'revoked' })).rejects.toThrow()
  })

  test('deduplicated teachers, two-way replies, per-profile read positions and unread races', async () => {
    const f = await fixture()
    const recipients = await f.guardian.listConversationRecipients({ studentId: 'stu1' })
    expect(recipients.teachers).toHaveLength(1)
    expect(recipients.teachers[0]?.subjects).toContain('Math')
    const started = await f.guardian.conversationsWorkflow.start(teacherMessage)
    expect((await f.teacher.listConversations({})).unreadCount).toBe(1)
    expect(await f.teacher.getUnreadConversationCount()).toEqual({ count: 1 })
    await f.teacher.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 1 })
    const replied = await f.teacher.conversationsWorkflow.reply({ conversationId: started.id, expectedVersion: 1, requestId: 'teacher-reply', body: 'Please complete exercise 3.' })
    expect(replied.lastSequence).toBe(2)
    const detail = await f.guardian.getConversation({ conversationId: started.id })
    expect(detail.messages.map(m => m.authorKind)).toEqual(['guardian', 'teacher'])
    expect(detail.conversation.allowedActions.reply).toBe(true)
    await f.guardian.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 1 })
    expect((await f.guardian.listConversations({})).unreadCount).toBe(1)
    expect(await f.guardian.getUnreadConversationCount()).toEqual({ count: 1 })
    await f.guardian.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 2 })
    await f.guardian.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 1 })
    expect((await f.guardian.listConversations({})).unreadCount).toBe(0)
    expect(await f.guardian.getUnreadConversationCount()).toEqual({ count: 0 })
    await expect(f.guardian.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 3 })).rejects.toThrow('future')
  })
  test('former teachers lose access, guardian retains history, oversight cannot reply or consume participant read state', async () => {
    const f = await fixture()
    const started = await f.guardian.conversationsWorkflow.start(teacherMessage)
    expect((await f.secretary.getConversation({ conversationId: started.id })).conversation.allowedActions.reply).toBe(false)
    await f.secretary.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 1 })
    expect((await f.teacher.listConversations({})).unreadCount).toBe(1)
    await expect(f.secretary.conversationsWorkflow.reply({ conversationId: started.id, expectedVersion: 1, requestId: 'unauthorized-reply', body: 'Hello' })).rejects.toThrow()
    await endTeaching(f)
    expect((await f.guardian.getConversation({ conversationId: started.id })).conversation.allowedActions.reply).toBe(false)
    expect((await f.teacher.listConversations({})).total).toBe(0)
    await expect(f.teacher.getConversation({ conversationId: started.id })).rejects.toThrow()
    await expect(f.guardian.conversationsWorkflow.reply({ conversationId: started.id, expectedVersion: 1, requestId: 'stale-teacher', body: 'Hello' })).rejects.toThrow()
  })
  test('other guardians cannot read, removed relationships disappear before counts and pagination', async () => {
    const f = await fixture()
    const started = await f.guardian.conversationsWorkflow.start(teacherMessage)
    await f.repositories.guardians.save(new Guardian({ id: 'gua2', schoolId: 'sch1', firstName: 'Second', lastName: 'Guardian', subjectId: 'subject-gua2' }))
    await f.repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link2', schoolId: 'sch1', guardianId: 'gua2', studentId: 'stu1' }))
    const other = f.forActor(createGuardianActorMetadata({ ...f.context, guardianId: 'gua2', subjectId: 'subject-gua2' }))
    expect((await other.listConversations({ limit: 1 })).total).toBe(0)
    await expect(other.getConversation({ conversationId: started.id })).rejects.toThrow()
    await f.repositories.guardianLinks.delete('link')
    expect((await f.guardian.listConversations({ limit: 1 })).total).toBe(0)
    await expect(f.guardian.getConversation({ conversationId: started.id })).rejects.toThrow()
  })
  test('school status stays pending after read, stale staff replies conflict, resolved enquiries reopen', async () => {
    const f = await fixture()
    const started = await f.guardian.conversationsWorkflow.start(schoolMessage)
    expect(started.studentId).toBeUndefined()
    await f.secretary.conversationsWorkflow.markRead({ conversationId: started.id, throughSequence: 1 })
    expect((await f.secretary.getConversation({ conversationId: started.id })).conversation.status).toBe('awaiting_school')
    const reply = { conversationId: started.id, expectedVersion: 1, requestId: 'school-reply', body: 'The office opens at 8.' }
    expect((await f.secretary.conversationsWorkflow.reply(reply)).status).toBe('awaiting_guardian')
    await expect(f.app.conversationsWorkflow.reply({ ...reply, requestId: 'second-staff' })).rejects.toThrow('New activity')
    await f.secretary.conversationsWorkflow.resolve({ conversationId: started.id, expectedVersion: 2, requestId: 'resolve' })
    expect((await f.guardian.conversationsWorkflow.reply({ conversationId: started.id, expectedVersion: 3, requestId: 'reopen', body: 'Does that include Fridays?' })).status).toBe('awaiting_school')
    expect((await f.secretary.listConversations({ destination: 'school', status: 'awaiting_school', order: 'oldest_awaiting' })).items[0]?.id).toBe(started.id)
  })
  test('retries create one message and durable notification, delivery rechecks teaching access', async () => {
    const f = await fixture()
    const first = await f.guardian.conversationsWorkflow.start(teacherMessage)
    expect((await f.guardian.conversationsWorkflow.start(teacherMessage)).id).toBe(first.id)
    expect((await f.guardian.listConversations({})).total).toBe(1)
    expect((await f.guardian.getConversation({ conversationId: first.id })).messages).toHaveLength(1)
    await expect(f.guardian.conversationsWorkflow.start({ ...teacherMessage, body: 'Changed retry' })).rejects.toThrow('different input')
    await dispatchConversationNotifications(f.application)
    await dispatchConversationNotifications(f.application)
    expect(f.notifications).toHaveLength(1)
    const delivery = f.notifications[0]!
    expect(delivery.enableEmail).toBe(false)
    expect(delivery.enableSms).toBe(false)
    expect(delivery.body).not.toContain('exercise')
    const { conversationId, recipientId, deliveryId } = delivery.metadata!
    expect(conversationId).toBe(first.id)
    expect(recipientId).toBe('teacher1')
    const system = f.application.forActor({ kind: 'system', systemId: 'notify-adapter', schoolId: 'sch1', requestId: 'dispatch', reason: 'test' }).baseService
    const request = { schoolId: 'sch1', deliveryId: deliveryId!, eventKey: delivery.eventKey, subjectId: 'teacher-subject', metadata: delivery.metadata! }
    expect((await resolveNotificationDispatchRecipient(system, request))?.recipient.id).toBe('teacher1')
    await endTeaching(f)
    expect(await resolveNotificationDispatchRecipient(system, request)).toBeUndefined()
  })
  test('announcement authority alone does not grant shared-inbox access', async () => {
    const f = await fixture()
    await f.guardian.conversationsWorkflow.start(schoolMessage)
    const grants = await f.repositories.staffPermissionAssignments.list({ staffId: 'secretary' })
    for (const grant of grants) await f.repositories.staffPermissionAssignments.delete(grant.id)
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'announcement-only', schoolId: 'sch1', staffId: 'secretary', academicYearId: 'ay1', permission: Permission.COMMUNICATION_SEND, scopes: [{ kind: 'all', grain: 'class_group' }] }))
    expect((await f.secretary.listConversations({})).total).toBe(0)
  })
  test('replacement teachers get their own conversations, never historical threads', async () => {
    const f = await fixture()
    const old = await f.guardian.conversationsWorkflow.start(teacherMessage)
    await endTeaching(f)
    await f.repositories.teachers.save(new Teacher({ id: 'replacement', schoolId: 'sch1', firstName: 'New', lastName: 'Teacher', subjectId: 'replacement-login' }))
    await f.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'new-assignment', teacherId: 'replacement', academicYearId: 'ay1', classGroupId: 'cg1', classSubjectId: 'cs1', kind: TeacherAssignmentKind.Subject }))
    const replacement = f.forActor(createTeacherActorMetadata({ ...f.context, teacherId: 'replacement', subjectId: 'replacement-login' }))
    await expect(replacement.getConversation({ conversationId: old.id })).rejects.toThrow()
    const current = await f.guardian.conversationsWorkflow.start({ ...teacherMessage, requestId: 'replacement-thread', teacherId: 'replacement' })
    expect((await replacement.listConversations({})).items.map(row => row.id)).toEqual([current.id])
    expect((await f.guardian.listConversations({ limit: 1 })).total).toBe(2)
    expect((await f.guardian.getConversation({ conversationId: old.id })).messages).toHaveLength(1)
  })
  test('no current school handler disables new enquiries without saving a message', async () => {
    const f = await fixture()
    for (const staff of await f.repositories.staffMembers.list({}))
      await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
    expect((await f.guardian.listConversationRecipients({})).schoolAvailable).toBe(false)
    await expect(f.guardian.conversationsWorkflow.start(schoolMessage)).rejects.toThrow('unavailable')
    expect((await f.guardian.listConversations({})).total).toBe(0)
  })
  test('a subsequent detail read observes revoked staff actions and read access', async () => {
    const f = await fixture()
    const thread = await f.guardian.conversationsWorkflow.start(schoolMessage)
    const detail = () => f.secretary.getConversation({ conversationId: thread.id })
    expect((await detail()).conversation.allowedActions.reply).toBe(true)
    await f.repositories.staffPermissionAssignments.delete(Permission.SCHOOL_MESSAGES_REPLY)
    expect((await detail()).conversation.allowedActions.reply).toBe(false)
    await f.repositories.staffPermissionAssignments.delete(Permission.SCHOOL_MESSAGES_READ)
    await expect(detail()).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('childless school history and guardian alerts disappear when family access is revoked', async () => {
    const f = await fixture()
    const thread = await f.guardian.conversationsWorkflow.start(schoolMessage)
    await f.secretary.conversationsWorkflow.reply({ conversationId: thread.id, expectedVersion: 1, requestId: 'staff-answer', body: 'Eight o’clock.' })
    await dispatchConversationNotifications(f.application)
    const delivery = f.notifications.find((row) => {
      const { recipientId } = row.metadata ?? {}
      return recipientId === 'gua1'
    })!
    expect(delivery).toBeDefined()
    await f.repositories.guardianLinks.delete('link')
    expect((await f.guardian.listConversations({})).total).toBe(0)
    await expect(f.guardian.getConversation({ conversationId: thread.id })).rejects.toThrow()
    const system = f.application.forActor({ kind: 'system', systemId: 'notify-adapter', schoolId: 'sch1', requestId: 'dispatch', reason: 'test' }).baseService
    const { deliveryId } = delivery.metadata!
    expect(await resolveNotificationDispatchRecipient(system, { schoolId: 'sch1', deliveryId: deliveryId!, eventKey: delivery.eventKey, subjectId: 'subject-gua1', metadata: delivery.metadata! })).toBeUndefined()
  })
  test('a failed push provider never rolls back a saved message', async () => {
    const f = await fixture()
    f.guardian.baseService.notificationGateway.enqueue = async () => {
      throw new Error('Provider unavailable')
    }
    const saved = await f.guardian.conversationsWorkflow.start(teacherMessage)
    await dispatchConversationNotifications(f.application)
    const detail = await f.guardian.getConversation({ conversationId: saved.id })
    expect(detail.messages).toHaveLength(1)
    expect(detail.messages[0]?.body).toBe(teacherMessage.body)
    expect((await f.teacher.listConversations({})).unreadCount).toBe(1)
  })
})

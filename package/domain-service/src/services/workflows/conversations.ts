import type { Conversation, ConversationPlacement, ConversationReadScope } from '@edaya/core'
import type { z } from 'zod'
import type { BaseSchoolService } from '../base-school-service'
import { ActorAssuranceLevel, AuthorizationError, createAccessPolicies, createStaffActorMetadata, denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, CONVERSATION_NOTIFY_KIND, conversationDetailQuerySchema, conversationRecipientsQuerySchema, conversationsQuerySchema, markConversationReadSchema, Permission, replyConversationSchema, resolveConversationSchema, startConversationSchema, startTeacherConversationSchema, teacherGuardianRecipientsQuerySchema } from '@edaya/core'
import { schoolCommandScope } from '../commands/school-command-scope'

export class ConversationsWorkflow {
  constructor(private readonly base: BaseSchoolService) {}
  private get actor() { return this.base.actor }
  private get store() { return this.base.repositories.conversations }
  private get access() { return this.base.access.conversations }
  private human() {
    const actor = this.actor
    if (actor.kind !== 'guardian' && actor.kind !== 'teacher' && actor.kind !== 'staff')
      denyResourceAccess()
    if (actor.kind === 'staff' && actor.accountKind !== 'human')
      denyResourceAccess()
    return actor
  }

  private async placement(id: string) { return await this.store.placement(this.actor.schoolId, id) ?? denyResourceAccess() }
  private async read(id: string, access = this.access): Promise<{ row: Conversation, scope: ConversationReadScope }> {
    const scope = await access.readScope([await this.placement(id)])
    return { row: await this.store.find(scope, id) ?? denyResourceAccess(), scope }
  }

  private async actions(row: ConversationPlacement, access = this.access, hasSchoolRecipient = async () => (await this.schoolRecipients()).length > 0) {
    let reply = false
    let resolve = false
    let reason: string | null = null
    try {
      await access.assertReply(row)
      reply = true
    }
    catch (e) {
      if (!(e instanceof AuthorizationError))
        throw e
      reason = e.message
    }
    if (row.destination === 'school' && this.actor.kind === 'guardian' && !await hasSchoolRecipient()) {
      reply = false
      reason = 'School messaging is currently unavailable'
    }
    try {
      await access.assertResolve(row)
      resolve = true
    }
    catch (e) {
      if (!(e instanceof AuthorizationError))
        throw e
    }
    return { reply, resolve, reason }
  }

  async schoolRecipients() {
    const members = await this.base.repositories.staffMembers.forSchool!(this.actor.schoolId).list({ isActive: true })
    const result: typeof members = []
    for (const member of members) {
      if (member.accountKind !== 'human' || !member.subjectId)
        continue
      const actor = createStaffActorMetadata({ schoolId: this.actor.schoolId, staffMemberId: member.id, subjectId: member.subjectId, requestId: this.actor.requestId, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
      const policy = createAccessPolicies({ actor, repositories: this.base.repositories }).conversations
      if (await policy.staffCan(Permission.SCHOOL_MESSAGES_READ) && await policy.staffCan(Permission.SCHOOL_MESSAGES_REPLY))
        result.push(member)
    }
    return result
  }

  async recipients(input: z.input<typeof conversationRecipientsQuerySchema>) {
    const parsed = conversationRecipientsQuerySchema.parse(input)
    await this.access.assertStart({ destination: 'school', studentId: parsed.studentId })
    const school = await this.base.repositories.schools.forSchool!(this.actor.schoolId).findById(this.actor.schoolId)
    return { schoolAvailable: (await this.schoolRecipients()).length > 0, schoolName: school?.name ?? '', teachers: parsed.studentId ? (await this.access.eligibleTeachers(parsed.studentId)).map(({ assignmentIds: _, ...teacher }) => teacher) : [] }
  }

  async guardianRecipients(input: z.input<typeof teacherGuardianRecipientsQuerySchema>) {
    const { studentId, classGroupId } = teacherGuardianRecipientsQuerySchema.parse(input)
    const { guardians } = await this.access.familyContacts(studentId, classGroupId)
    return { guardians }
  }

  async startTeacher(input: z.input<typeof startTeacherConversationSchema>) {
    const parsed = startTeacherConversationSchema.parse(input)
    const recipient = async () => {
      const contacts = await this.access.familyContacts(parsed.studentId, parsed.classGroupId)
      const guardian = contacts.guardians.find(person => person.id === parsed.guardianId)
      if (!guardian)
        return denyResourceAccess()
      return { guardian, assignmentIds: contacts.assignmentIds }
    }
    return this.command('startTeacherConversation', parsed, async () => {
      await recipient()
    }, async () => {
      const { guardian, assignmentIds } = await recipient()
      const author = await this.author()
      const school = await this.base.repositories.schools.forSchool!(this.actor.schoolId).findById(this.actor.schoolId)
      const student = await this.base.repositories.students.forSchool!(this.actor.schoolId).findById(parsed.studentId)
      if (!student || this.actor.kind !== 'teacher')
        return denyResourceAccess()
      const now = new Date().toISOString()
      const row: Conversation = {
        id: crypto.randomUUID(),
        schoolId: this.actor.schoolId,
        destination: 'teacher',
        teacherId: this.actor.teacherId,
        guardianId: guardian.id,
        studentId: student.id,
        assignmentIds,
        teacherName: author.authorName,
        guardianName: guardian.name,
        studentName: student.fullName,
        schoolName: school?.name ?? '',
        subject: parsed.subject,
        status: 'awaiting_guardian',
        version: 1,
        lastSequence: 1,
        lastMessage: parsed.body.slice(0, 160),
        createdAt: now,
        updatedAt: now,
        awaitingSince: now,
      }
      await this.store.save(row)
      await this.store.append({ id: crypto.randomUUID(), schoolId: row.schoolId, conversationId: row.id, sequence: 1, ...author, body: parsed.body, createdAt: now })
      return row
    }, true)
  }

  async list(input: z.input<typeof conversationsQuerySchema>) {
    const query = conversationsQuerySchema.parse(input)
    const access = this.access.forReadOperation()
    const scope = await access.collectionScope()
    const page = await this.store.list(scope, query)
    let recipients: Promise<boolean> | undefined
    const hasSchoolRecipient = () => recipients ??= this.schoolRecipients().then(rows => rows.length > 0)
    const items = await Promise.all(page.items.map(async row => ({ ...row, allowedActions: await this.actions(row, access, hasSchoolRecipient) })))
    return { ...page, items, offset: query.offset, limit: query.limit }
  }

  async unreadCount() {
    return { count: await this.store.unreadCount(await this.access.forReadOperation().collectionScope()) }
  }

  async unresolvedCount() {
    return { count: await this.store.unresolvedCount(await this.access.forReadOperation().collectionScope()) }
  }

  async detail(input: z.input<typeof conversationDetailQuerySchema>) {
    const query = conversationDetailQuerySchema.parse(input)
    const access = this.access.forReadOperation()
    const { row, scope } = await this.read(query.conversationId, access)
    const messages = await this.store.messages(scope, row.id, query.beforeSequence, query.limit + 1)
    const hasMore = messages.length > query.limit
    return { conversation: { ...row, unread: await this.store.unread(scope, row.id), allowedActions: await this.actions(row, access) }, messages: hasMore ? messages.slice(1) : messages, hasMore }
  }

  private async author() {
    const actor = this.human()
    const repo = actor.kind === 'guardian' ? this.base.repositories.guardians : actor.kind === 'teacher' ? this.base.repositories.teachers : this.base.repositories.staffMembers
    const profile = await repo.forSchool!(actor.schoolId).findById(actor.actorId)
    if (!profile)
      denyResourceAccess()
    return { authorKind: actor.kind, authorId: actor.actorId, authorSubjectId: actor.subjectId, authorName: `${profile.firstName} ${profile.lastName}`.trim() }
  }

  private async command(command: string, input: { requestId: string }, authorize: () => Promise<void>, execute: () => Promise<Conversation>, notify: boolean) {
    this.human()
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.actor, command, input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [`conversations:${this.actor.schoolId}`],
      authorize,
      execute,
      persistResult: row => ({ id: row.id }),
      replay: async saved => (await this.read(saved.id)).row,
      audit: row => [{ event: command, resourceType: 'conversation', resourceId: row.id }],
      outbox: row => notify ? [{ id: `${row.id}:${row.lastSequence}`, kind: CONVERSATION_NOTIFY_KIND, version: 1, resourceType: 'conversation', resourceId: `${row.id}:${row.lastSequence}` }] : [],
    })
  }

  async start(input: z.input<typeof startConversationSchema>) {
    const parsed = startConversationSchema.parse(input)
    return this.command('startConversation', parsed, async () => {
      await this.access.assertStart(parsed)
    }, async () => {
      if (parsed.destination === 'school' && !(await this.schoolRecipients()).length)
        throw new BusinessRuleViolationError('SCHOOL_MESSAGES_UNAVAILABLE', 'School messaging is currently unavailable')
      const assignmentIds = await this.access.assertStart(parsed)
      const author = await this.author()
      const school = await this.base.repositories.schools.forSchool!(this.actor.schoolId).findById(this.actor.schoolId)
      const student = parsed.studentId ? await this.base.repositories.students.forSchool!(this.actor.schoolId).findById(parsed.studentId) : undefined
      const teacher = parsed.teacherId ? await this.base.repositories.teachers.forSchool!(this.actor.schoolId).findById(parsed.teacherId) : undefined
      const now = new Date().toISOString()
      const row: Conversation = { id: crypto.randomUUID(), schoolId: this.actor.schoolId, guardianId: this.human().actorId, destination: parsed.destination, teacherId: parsed.teacherId, studentId: parsed.studentId, assignmentIds, subject: parsed.subject, schoolName: school?.name ?? '', guardianName: author.authorName, teacherName: teacher?.fullName, studentName: student ? `${student.firstName} ${student.lastName}`.trim() : undefined, status: 'awaiting_school', version: 1, lastSequence: 1, lastMessage: parsed.body.slice(0, 160), createdAt: now, updatedAt: now, awaitingSince: now }
      await this.store.save(row)
      await this.store.append({ id: crypto.randomUUID(), schoolId: row.schoolId, conversationId: row.id, sequence: 1, ...author, body: parsed.body, createdAt: now })
      return row
    }, true)
  }

  async reply(input: z.input<typeof replyConversationSchema>) {
    const parsed = replyConversationSchema.parse(input)
    return this.command('replyConversation', parsed, async () => {
      await this.access.assertReply(await this.placement(parsed.conversationId))
    }, async () => {
      const { row } = await this.read(parsed.conversationId)
      this.assertVersion(row, parsed.expectedVersion)
      if (row.destination === 'school' && this.actor.kind === 'guardian' && !(await this.schoolRecipients()).length)
        throw new BusinessRuleViolationError('SCHOOL_MESSAGES_UNAVAILABLE', 'School messaging is currently unavailable')
      const now = new Date().toISOString()
      const author = await this.author()
      const status = this.actor.kind === 'guardian' ? 'awaiting_school' : 'awaiting_guardian'
      const updated: Conversation = { ...row, status, awaitingSince: row.status === status ? row.awaitingSince : now, version: row.version + 1, lastSequence: row.lastSequence + 1, lastMessage: parsed.body.slice(0, 160), updatedAt: now }
      await this.store.append({ id: crypto.randomUUID(), schoolId: row.schoolId, conversationId: row.id, sequence: updated.lastSequence, ...author, body: parsed.body, createdAt: now })
      await this.store.save(updated)
      return updated
    }, true)
  }

  private assertVersion(row: Conversation, expected: number) {
    if (row.version !== expected)
      throw new BusinessRuleViolationError('CONVERSATION_CHANGED', 'New activity is available. Review it before sending again.')
  }

  async resolve(input: z.input<typeof resolveConversationSchema>) {
    const parsed = resolveConversationSchema.parse(input)
    return this.command('resolveConversation', parsed, async () => {
      await this.access.assertResolve(await this.placement(parsed.conversationId))
    }, async () => {
      const { row } = await this.read(parsed.conversationId)
      this.assertVersion(row, parsed.expectedVersion)
      const updated: Conversation = { ...row, status: 'resolved', version: row.version + 1, updatedAt: new Date().toISOString() }
      await this.store.save(updated)
      return updated
    }, false)
  }

  async markRead(input: z.input<typeof markConversationReadSchema>) {
    const parsed = markConversationReadSchema.parse(input)
    return this.base.atomicExecution.execute(async () => {
      const { row, scope } = await this.read(parsed.conversationId)
      if (parsed.throughSequence > row.lastSequence)
        throw new BusinessRuleViolationError('CONVERSATION_READ_INVALID', 'Cannot mark unseen future messages read')
      await this.store.markRead(scope, row.id, parsed.throughSequence)
      return { conversationId: row.id, throughSequence: parsed.throughSequence }
    })
  }
}

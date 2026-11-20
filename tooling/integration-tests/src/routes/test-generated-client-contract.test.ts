import type { components } from '@maya-invest/edaya-api-client/schema'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { createSchoolClient } from '@maya-invest/edaya-api-client'
import { expect, it } from 'bun:test'
import { createInProcessSchoolClient, createInProcessTransport } from '../support/in-process-school-client'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('generated school client contract', (getContext) => {
  it('lists schools and reads effective grants through createSchoolClient', async () => {
    const { app, application, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const client = createInProcessSchoolClient(app, {
      headers: { authorization },
    })

    const schools = await client.entities.schools.list({ $limit: 1 })
    expect(schools.length).toBeGreaterThan(0)

    const grants = await client.authorization.effectiveGrants()
    expect(grants).toMatchObject({
      kind: 'staff',
      actorId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      schoolId: staff?.schoolId,
      assuranceLevel: 'verified',
    })
    expect(grants).toHaveProperty('grants', expect.any(Array))
  })

  it('round-trips a single-token guardian through generated registration and update APIs', async () => {
    const { app, application, authHeaders } = getContext()
    const school = (await application.repositories.schools.list({ $limit: 1 }))[0]!
    const client = createSchoolClient<components['schemas']>(createInProcessTransport(app, { headers: { ...await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL), 'x-actor-kind': 'staff', 'x-school-id': school.id } }))
    const attemptId = crypto.randomUUID()
    const creation = { requestId: attemptId, schoolId: school.id, firstName: '', lastName: 'Koné', hasAccess: false, sendAccountInvitation: false }
    const guardian = await client.commands.registerGuardian(creation)
    expect((await client.commands.registerGuardian(creation)).id).toBe(guardian.id)
    expect(guardian.identifier ?? null).toBeNull()
    expect(guardian.firstName).toBe('')
    await client.commands.updateGuardianProfile({ guardianId: guardian.id, occupation: 'Teacher', hasAccess: false, phone: '+22501020304', alternativePhone: '+22505060708', smsNotificationsEnabled: false })
    await client.commands.updateGuardianProfile({ guardianId: guardian.id, phone: null })
    const cleared = await client.entities.guardians.get(guardian.id)
    expect(cleared.phone ?? null).toBeNull()
    expect(cleared.alternativePhone).toBe('+22505060708')
    expect(cleared.smsNotificationsEnabled).toBe(false)
    expect(cleared.pushNotificationsEnabled).toBe(true)
    const saved = (await application.repositories.guardians.findById(guardian.id))!
    expect(saved.firstName).toBe('')
    expect(saved.fullName).toBe('Koné')
    expect(saved.occupation).toBe('Teacher')
    await expect(client.commands.updateGuardianProfile({ guardianId: guardian.id, lastName: '', hasAccess: false })).rejects.toMatchObject({ status: 422 })
  })

  it('returns 401 from generated authorization routes without a session cookie', async () => {
    const { app } = getContext()
    const client = createInProcessSchoolClient(app)

    await expect(client.authorization.effectiveGrants()).rejects.toMatchObject({
      status: 401,
    })
  })

  it('persists guardian-school conversations across generated clients, rejects stale replies and isolates recipients', async () => {
    const { app, authHeaders, application } = getContext()
    const school = (await application.repositories.schools.list({ $limit: 1 }))[0]!
    const client = async (email: string, kind: string) => createSchoolClient<components['schemas']>(createInProcessTransport(app, {
      headers: { ...await authHeaders(email), 'x-actor-kind': kind, 'x-school-id': school.id },
    }))
    const family = await client(DEV_AUTH_GUARDIAN_ACCOUNTS[0].email, 'guardian')
    const otherFamily = await client(DEV_AUTH_GUARDIAN_ACCOUNTS[1].email, 'guardian')
    const staff = await client(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, 'staff')
    const input = { requestId: 'http-family-enquiry', destination: 'school' as const, subject: 'Office opening hours', body: 'When can we collect the certificate?' }
    const conversation = await family.commands.startConversation(input)
    expect((await family.commands.startConversation(input)).id).toBe(conversation.id)
    const query = { conversationId: conversation.id, limit: 50 }
    expect((await staff.queries.getConversation(query)).messages.map(message => message.body)).toEqual([input.body])
    const reply = { requestId: 'http-school-reply', conversationId: conversation.id, expectedVersion: conversation.version, body: 'Tomorrow at eight.' }
    const answered = await staff.commands.replyConversation(reply)
    await staff.commands.replyConversation(reply)
    await expect(staff.commands.replyConversation({ ...reply, requestId: 'http-stale-reply', body: 'A stale duplicate' })).rejects.toMatchObject({ status: 409 })
    const reconnected = await client(DEV_AUTH_GUARDIAN_ACCOUNTS[0].email, 'guardian')
    const detail = await reconnected.queries.getConversation(query)
    expect(detail.conversation.status).toBe('awaiting_guardian')
    expect(detail.messages.map(message => message.body)).toEqual([input.body, reply.body])
    expect(detail.messages.map(message => message.sequence)).toEqual([1, 2])
    await reconnected.commands.markConversationRead({ conversationId: conversation.id, throughSequence: answered.lastSequence })
    expect((await family.queries.getConversation(query)).conversation.unread).toBe(false)
    expect((await otherFamily.queries.listConversations({ order: 'latest', offset: 0, limit: 25 })).items.some(row => row.id === conversation.id)).toBe(false)
    await expect(otherFamily.queries.getConversation(query)).rejects.toMatchObject({ status: 403 })
    await expect(otherFamily.commands.replyConversation({ ...reply, requestId: 'http-foreign-reply', expectedVersion: answered.version })).rejects.toMatchObject({ status: 403 })
    expect((await family.queries.getConversation(query)).messages).toHaveLength(2)
  })
}, { isolate: true })

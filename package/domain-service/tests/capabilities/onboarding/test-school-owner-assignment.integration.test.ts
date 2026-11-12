import { EDAYA_SPARK_S2S_CLIENT_ID, encodeS2sApiKey, localEdayaSparkS2sApiKey } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway } from '@edaya/core'
import { registerSchoolWithOwner, SchoolApplication } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('school registration with a central identity owner', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let application: SchoolApplication
  const session = { user: { id: 'new-owner', email: 'owner@example.com', name: 'New Owner' } }
  const input = { id: 'new-school', name: 'New school', timeZone: 'UTC', ownerStaffId: 'new-staff', requestId: 'onboarding' }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    application = new SchoolApplication({ commandJournal: new PostgresCommandJournal(), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage, accountInvitationsEnabled: false })
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  it('registers the school and links its human owner through the identity policy', async () => {
    const result = await registerSchoolWithOwner(application, session, input)
    expect(result.school.ownerSubjectId).toBe('new-owner')
    expect(result.school.pendingOwnerStaffId).toBeUndefined()
    expect((await fixture.repositories.staffMembers.findById('new-staff'))?.subjectId).toBe('new-owner')
    expect(await fixture.repositories.staffPermissionAssignments.count()).toBe(0)
    const s2s = await fixture.repositories.s2sClients.findActiveBySchoolAndClientId(result.school.id, EDAYA_SPARK_S2S_CLIENT_ID)
    expect(s2s?.keyHash).toBe(encodeS2sApiKey(localEdayaSparkS2sApiKey(result.school.id)).hash)
  })

  it('registers another school for its active owner without replacing an existing school or staff profile', async () => {
    await registerSchoolWithOwner(application, session, input)
    const selected = { schoolId: input.id, staffMemberId: input.ownerStaffId }
    const next = { ...input, id: 'second-school', ownerStaffId: 'second-owner-staff' }
    await expect(registerSchoolWithOwner(application, session, { ...next, id: 'school-b' }, selected)).rejects.toMatchObject({ code: 'ONBOARDING_ID_ALREADY_USED' })
    await expect(registerSchoolWithOwner(application, session, { ...next, ownerStaffId: input.ownerStaffId }, selected)).rejects.toMatchObject({ code: 'ONBOARDING_ID_ALREADY_USED' })
    await expect(registerSchoolWithOwner(application, session, next, { ...selected, staffMemberId: 'staff-b' })).rejects.toMatchObject({ code: 'SUBJECT_ALREADY_LINKED' })
    await registerSchoolWithOwner(application, session, next, selected)
    for (const school of [input, next]) {
      expect((await fixture.repositories.schools.findById(school.id))?.ownerSubjectId).toBe(session.user.id)
      expect((await fixture.repositories.staffMembers.findById(school.ownerStaffId))?.subjectId).toBe(session.user.id)
    }
  })

  it('rejects an identity already linked to a school profile', async () => {
    const linked = { user: { ...session.user, id: 'person-a' } }
    await expect(registerSchoolWithOwner(application, linked, input)).rejects.toMatchObject({ code: 'SUBJECT_ALREADY_LINKED' })
    await expect(registerSchoolWithOwner(application, linked, input, { schoolId: 'school-a', staffMemberId: 'staff-a' })).rejects.toMatchObject({ code: 'SUBJECT_ALREADY_LINKED' })
    expect(await fixture.repositories.schools.findById('new-school')).toBeUndefined()
  })

  it('rolls back school registration when the staff identity conflicts with another tenant', async () => {
    await expect(registerSchoolWithOwner(application, session, { ...input, ownerStaffId: 'staff-b' })).rejects.toThrow()
    expect(await fixture.repositories.schools.findById('new-school')).toBeUndefined()
    expect((await fixture.repositories.staffMembers.findById('staff-b'))?.subjectId).toBe('person-b')
  })
})

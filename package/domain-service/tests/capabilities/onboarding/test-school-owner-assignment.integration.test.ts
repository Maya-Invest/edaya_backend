import { EDAYA_SPARK_S2S_CLIENT_ID, encodeS2sApiKey, localEdayaSparkS2sApiKey } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { registerSchoolWithOwner } from '../../../src/capabilities/onboarding/register-school-with-owner'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('school registration with a central identity owner', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let application: SchoolApplication
  const session = { user: { id: 'new-owner', email: 'owner@example.com', name: 'New Owner' } }
  const input = { id: 'new-school', name: 'New school', timeZone: 'UTC', ownerStaffId: 'new-staff', requestId: 'onboarding' }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage, accountInvitationsEnabled: false })
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

  it('rejects an identity already linked to a school profile', async () => {
    await expect(registerSchoolWithOwner(application, { user: { ...session.user, id: 'person-a' } }, input)).rejects.toMatchObject({ code: 'SUBJECT_ALREADY_LINKED' })
    expect(await fixture.repositories.schools.findById('new-school')).toBeUndefined()
  })

  it('rolls back school registration when the staff identity conflicts with another tenant', async () => {
    await expect(registerSchoolWithOwner(application, session, { ...input, ownerStaffId: 'staff-b' })).rejects.toThrow()
    expect(await fixture.repositories.schools.findById('new-school')).toBeUndefined()
    expect((await fixture.repositories.staffMembers.findById('staff-b'))?.subjectId).toBe('person-b')
  })
})

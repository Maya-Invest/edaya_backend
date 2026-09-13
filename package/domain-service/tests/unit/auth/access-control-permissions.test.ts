import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, Permission, StaffPermissionAssignment } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../../adaptor-postgres/tests/support/authorization-database'

describe('permission administration actions', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createStaffActorMetadata({ subjectId: 'person-a', staffMemberId: 'staff-a', schoolId: 'school-a', requestId: 'admin', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
  })
  afterEach(async () => {
    await fixture.db.close()
  })
  const grant = (permission: Permission) => new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission, scopes: [{ kind: 'school' }] })
  function service() {
    return new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage }).forActor(actor).baseService.entities.staffPermissionAssignments
  }

  test('reading grant administration does not allow assigning authority', async () => {
    await fixture.repositories.staffPermissionAssignments.save(grant(Permission.ACCESS_CONTROL_READ))
    expect(await service().count()).toBe(1)
    await expect(service().save(grant(Permission.STAFF_READ))).rejects.toThrow()
    expect(await fixture.repositories.staffPermissionAssignments.count()).toBe(1)
  })

  test('an assigner must also hold every delegated action and cannot use assignment authority to read grant administration', async () => {
    await fixture.repositories.staffPermissionAssignments.save(grant(Permission.ACCESS_CONTROL_ASSIGN))
    await expect(service().list()).rejects.toThrow()
    await expect(service().save(grant(Permission.STAFF_READ))).rejects.toThrow()
    await fixture.repositories.staffPermissionAssignments.save(grant(Permission.STAFF_READ))
    const delegated = new StaffPermissionAssignment({ ...grant(Permission.STAFF_READ).data, id: 'delegated', scopes: [{ kind: 'school' }] })
    await service().save(delegated)
    expect(await fixture.repositories.staffPermissionAssignments.findById('delegated')).toBeDefined()
  })
})

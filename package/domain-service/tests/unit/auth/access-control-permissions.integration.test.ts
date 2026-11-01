import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, Permission, StaffPermissionAssignment } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('permission administration actions', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createStaffActorMetadata({ subjectId: 'person-a', staffMemberId: 'staff-a', schoolId: 'school-a', requestId: 'admin', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
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
    await fixture.repositories.staffPermissionAssignments.save(grant(Permission.ACCESS_CONTROL_MANAGE))
    await expect(service().list()).rejects.toThrow()
    await expect(service().save(grant(Permission.STAFF_READ))).rejects.toThrow()
    await fixture.repositories.staffPermissionAssignments.save(grant(Permission.STAFF_READ))
    const delegated = new StaffPermissionAssignment({ ...grant(Permission.STAFF_READ).data, id: 'delegated', scopes: [{ kind: 'school' }] })
    await expect(service().save(delegated)).rejects.toThrow()
    const workflow = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage }).forActor(actor).accessControlWorkflow
    await workflow.assignStaffPermission({ id: 'delegated-source', schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission: Permission.STAFF_READ, customScopes: [], useDefaultScopes: false })
    expect(await fixture.repositories.staffManualPermissionAssignments.findById('delegated-source')).toBeDefined()
    await expect(service().list()).rejects.toThrow()
  })
})

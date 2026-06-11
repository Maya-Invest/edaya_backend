import { describe, expect, test } from 'bun:test'
import { createSystemActorMetadata } from '../../../src/authorization'
import { createTestApp } from '../../support/create-test-app'

describe('Setup owner workflow', () => {
  test('assigns the first registered staff member as school owner', async () => {
    const { app, repositories } = createTestApp(createSystemActorMetadata({
      systemId: 'setup',
      schoolId: 'school',
      requestId: 'request',
      reason: 'bootstrap',
    }))

    await app.registerSchool({
      id: 'school',
      name: 'Edaya',
      timeZone: 'UTC',
    })

    await app.registerStaffMember({
      id: 'owner',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Owner',
    })

    expect((await repositories.schoolRepository.findById('school'))?.ownerStaffId).toBe('owner')
  })
})

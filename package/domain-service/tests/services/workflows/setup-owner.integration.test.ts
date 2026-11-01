import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createPlatformRegisterTestActor } from '../../support/test-actor'

describe('Setup owner workflow', () => {
  test('registers a school with ownerSubjectId before staff exists', async () => {
    const { app, repositories } = await createTestApp(createPlatformRegisterTestActor('school'))

    await app.setupWorkflow.registerSchool({
      id: 'school',
      name: 'Edaya',
      timeZone: 'UTC',
      ownerSubjectId: 'subject-owner',
    })

    expect((await repositories.schoolRepository.findById('school'))?.ownerSubjectId).toBe('subject-owner')
    expect(await repositories.schoolNotificationTemplates.findById('school')).toBeDefined()
  })

  test('does not auto-assign owner when registering staff after school creation', async () => {
    const { app, repositories } = await createTestApp(createPlatformRegisterTestActor('school'))

    await app.setupWorkflow.registerSchool({
      id: 'school',
      name: 'Edaya',
      timeZone: 'UTC',
    })

    await app.setupWorkflow.registerStaffMember({
      id: 'owner',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Owner',
    })

    expect((await repositories.schoolRepository.findById('school'))?.ownerSubjectId).toBeUndefined()
  })
})

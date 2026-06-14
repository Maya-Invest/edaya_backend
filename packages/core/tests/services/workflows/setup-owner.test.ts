import { describe, expect, test } from 'bun:test'
import { createSystemActorMetadata } from '../../../src/authorization'
import { createTestApp } from '../../support/create-test-app'

describe('Setup owner workflow', () => {
  test('registers a school with ownerSubjectId before staff exists', async () => {
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
      ownerSubjectId: 'subject-owner',
    })

    expect((await repositories.schoolRepository.findById('school'))?.ownerSubjectId).toBe('subject-owner')
  })

  test('does not auto-assign owner when registering staff after school creation', async () => {
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
      subjectId: 'subject-owner',
    })

    expect((await repositories.schoolRepository.findById('school'))?.ownerSubjectId).toBeUndefined()
  })
})

import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, BaseRepositoryInterface } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import { noOpNotificationGateway } from '@edaya/core'
import { BaseSchoolService, createSchoolCommandHandlers, SCHOOL_COMMAND_KEYS, SchoolService } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { testFileStorage } from '../support/test-file-storage'

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual)
  const expectedKeys = new Set(expected)
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  }
}

describe('school command keys', () => {
  test('match the handlers constructed by SchoolService', () => {
    const repository = new Proxy({}, {
      get: () => async () => undefined,
    }) as BaseRepositoryInterface<unknown>
    const repositories = new Proxy({}, {
      get: () => repository,
    }) as SchoolRepositories
    const atomicExecution: AtomicExecutionPort = {
      execute: operation => operation(),
    }

    const service = new SchoolService({
      actor: {} as SchoolScopedActorMetadata,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    expect(keyDifference(Object.keys(service.commands), SCHOOL_COMMAND_KEYS)).toEqual({
      missing: [],
      extra: [],
    })
    expect(keyDifference(Object.keys(createSchoolCommandHandlers({
      teacherCorrections: service.teacherCorrectionsWorkflow,
      setup: service.setupWorkflow,
      accessControl: service.accessControlWorkflow,
      accountInvitation: service.accountInvitationWorkflow,
      notificationTemplates: service.notificationTemplatesWorkflow,
      academics: service.academicsWorkflow,
      assessments: service.assessmentsWorkflow,
      student: service.studentWorkflow,
      scheduling: service.schedulingWorkflow,
      timetableGeneration: service.timetableGenerationWorkflow,
      communications: service.communicationsWorkflow,
      behavior: service.behaviorWorkflow,
      finance: service.financeWorkflow,
      documents: service.documentsWorkflow,
      familyFeedback: service.familyFeedbackWorkflow,
    })), SCHOOL_COMMAND_KEYS)).toEqual({
      missing: [],
      extra: [],
    })
    expect(new BaseSchoolService({
      actor: {} as SchoolScopedActorMetadata,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })).toBeTruthy()

    for (const commandKey of SCHOOL_COMMAND_KEYS) {
      expect(commandKey in service).toBe(false)
    }

    expect('getSchoolOverview' in service).toBe(true)
    expect('getOverdueFeeCount' in service).toBe(true)
    expect('getPublishedReportCardCount' in service).toBe(true)
  })
})

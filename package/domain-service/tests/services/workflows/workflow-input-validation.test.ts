import type { BaseSchoolService } from '../../../src/services/base-school-service'
import { DayOfWeek, DomainValidationError } from '@edaya/core'
import { expect, mock, test } from 'bun:test'
import { ReportConfigurationWorkflow } from '../../../src/services/workflows/report-configuration'
import { SchedulingServiceWorkflow } from '../../../src/services/workflows/scheduling'
import { createTestStaffActor } from '../../support/test-actor'

test('scheduling rejects ambiguous targets and invalid schedule kinds before a write', async () => {
  const save = mock(async () => {})
  const workflow = new SchedulingServiceWorkflow({
    actor: createTestStaffActor(),
    atomicExecution: { execute: (work: () => Promise<unknown>) => work() },
    repositories: { classGroups: { findById: async () => ({ id: 'class', schoolId: 'school' }) } },
    entities: { schedules: { save }, lessonSessions: { save }, activitySessions: { save } },
  } as unknown as BaseSchoolService)
  const times = { startsAt: new Date('2026-05-29T10:00:00Z'), endsAt: new Date('2026-05-29T11:00:00Z') }
  for (const targets of [{}, { lessonSessionId: 'lesson', activitySessionId: 'activity' }])
    await expect(workflow.rescheduleOccurrence({ ...targets, ...times })).rejects.toMatchObject({ code: 'INVALID_OCCURRENCE_TARGET' })
  await expect(workflow.saveSchedule({ schedule: { id: 'invalid', schoolId: 'school', classGroupId: 'class', scheduleKind: 'unsupported', title: 'Invalid', isRecurring: true, dayOfWeek: DayOfWeek.Thursday, startTime: '08:00', endTime: '09:00' } as never })).rejects.toBeInstanceOf(DomainValidationError)
  expect(save).not.toHaveBeenCalled()
})

test('out-of-range, non-finite and excess-precision thresholds never reach persistence', async () => {
  const save = mock(async () => {})
  const actor = createTestStaffActor()
  const level = { id: 'level', schoolId: actor.schoolId, reportSettingsFor: () => ({ revision: 1 }), gradingPolicyFor: () => ({ scale: { minScore: 0, maxScore: 20, decimalPlaces: 1 } }) }
  const workflow = new ReportConfigurationWorkflow({
    actor,
    commandExecution: { execute: async (command: { authorize: () => Promise<void>, execute: () => Promise<unknown> }) => {
      await command.authorize()
      return command.execute()
    } },
    access: { reportCards: { assertConfigureGrading: async () => {} } },
    repositories: {
      gradeLevels: { findById: async () => level, forSchool: () => ({ save }) },
      academicYears: { findById: async () => ({ schoolId: actor.schoolId }) },
      reportModules: { forSchool: () => ({}) },
    },
  } as unknown as BaseSchoolService)
  for (const passThreshold of [-1, 20.1, 10.12, NaN, Infinity])
    await expect(workflow.configure({ gradeLevelId: 'level', academicYearId: 'year', requestId: 'threshold', expectedRevision: 1, passThreshold })).rejects.toMatchObject({ code: 'INVALID_REPORT_PASS_THRESHOLD' })
  expect(save).not.toHaveBeenCalled()
})

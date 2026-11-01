import { provisionOnboarding } from '@edaya/service'
import { describe, expect, spyOn, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'
import { createOnboardingTestDataset } from '../support/onboarding-dataset'

function typicalInput(schoolId: string, requestId: string) {
  return {
    schoolId,
    requestId,
    school: {
      name: 'Lycée Replay',
      timeZone: 'Africa/Abidjan',
      city: 'Abidjan',
      country: 'CI',
      academicYearLabel: '2026-2027',
      academicYearStart: '2026-09-01',
      academicYearEnd: '2027-07-03',
      periodType: 'trimester' as const,
      periods: [{ label: 'Trimestre 1', start: '2026-09-01', end: '2026-12-19' }],
    },
    structure: {
      templates: ['ci-college'],
      dataset: createOnboardingTestDataset(),
      levels: [{
        gradeLevelId: 'ci-college:4EME',
        classCount: 1,
        capacity: 30,
        classNamingMode: 'numerical' as const,
      }],
    },
  }
}

describe('provisionOnboarding journal', () => {
  test('replays an identical committed request and rejects a changed payload', async () => {
    const fixture = await createTestApp()
    const schoolId = crypto.randomUUID()
    const requestId = crypto.randomUUID()
    const session = {
      user: {
        id: 'provision-owner',
        email: 'provision-owner@school.edu',
        name: 'Provision Owner',
        emailVerified: true,
      },
    }
    const options = { allowPublicSchoolRegistration: true }

    const first = await provisionOnboarding(
      fixture.application,
      session,
      typicalInput(schoolId, requestId),
      options,
    )
    expect(first.schoolId).toBe(schoolId)
    expect(first.replayed).toBeFalsy()
    expect(first.status.wizardCompleted).toBe(true)

    const replay = await provisionOnboarding(
      fixture.application,
      session,
      typicalInput(schoolId, requestId),
      options,
    )
    expect(replay.schoolId).toBe(schoolId)
    expect(replay.replayed).toBe(true)
    expect(await fixture.schoolRepositories.schools.count()).toBe(2)
    const changed = typicalInput(schoolId, requestId)
    changed.structure.dataset.templates[0]!.gradeLevels[0]!.subjects[0]!.coefficient = 8
    await expect(provisionOnboarding(fixture.application, session, changed, options)).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    const otherVersion = typicalInput(schoolId, requestId)
    otherVersion.structure.dataset.version = '1.0.1'
    await expect(provisionOnboarding(fixture.application, session, otherVersion, options)).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })

    await expect(provisionOnboarding(
      fixture.application,
      session,
      {
        ...typicalInput(schoolId, requestId),
        school: {
          ...typicalInput(schoolId, requestId).school,
          name: 'Changed School',
        },
      },
      options,
    )).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
  })

  test('rolls back a failed provision so a later request can succeed', async () => {
    const fixture = await createTestApp()
    const schoolId = crypto.randomUUID()
    const failedRequestId = crypto.randomUUID()
    const session = {
      user: {
        id: 'retry-owner',
        email: 'retry-owner@school.edu',
        name: 'Retry Owner',
        emailVerified: true,
      },
    }

    await expect(provisionOnboarding(
      fixture.application,
      session,
      {
        ...typicalInput(schoolId, failedRequestId),
        structure: {
          templates: ['ci-unknown'],
          dataset: createOnboardingTestDataset(),
          levels: typicalInput(schoolId, failedRequestId).structure.levels,
        },
      },
      { allowPublicSchoolRegistration: true },
    )).rejects.toMatchObject({ code: 'UNKNOWN_STRUCTURE_TEMPLATE' })

    expect(await fixture.schoolRepositories.schools.findById(schoolId)).toBeUndefined()

    const retry = await provisionOnboarding(
      fixture.application,
      session,
      typicalInput(schoolId, crypto.randomUUID()),
      { allowPublicSchoolRegistration: true },
    )
    expect(retry.schoolId).toBe(schoolId)
    expect(retry.replayed).toBeFalsy()
  })
})

test('a late provisioning failure rolls back the school and all dataset records', async () => {
  const fixture = await createTestApp()
  const schoolId = crypto.randomUUID()
  const session = { user: { id: 'late-failure-owner', email: 'late-failure@school.edu', name: 'Owner', emailVerified: true } }
  const write = spyOn(fixture.application.repositories.reportModules, 'forSchool').mockImplementation(() => {
    throw new Error('late report failure')
  })
  try {
    await expect(provisionOnboarding(fixture.application, session, typicalInput(schoolId, crypto.randomUUID()), { allowPublicSchoolRegistration: true })).rejects.toThrow('late report failure')
  }
  finally {
    write.mockRestore()
  }
  expect(await fixture.schoolRepositories.schools.findById(schoolId)).toBeUndefined()
  for (const key of ['subjectCategories', 'academicDisciplines', 'academicYears', 'academicPeriods', 'gradeLevels', 'subjects', 'classGroups', 'gradeScales', 'reportModules'] as const)
    expect(await fixture.schoolRepositories[key].count({ schoolId })).toBe(0)
  const retry = await provisionOnboarding(fixture.application, session, typicalInput(schoolId, crypto.randomUUID()), { allowPublicSchoolRegistration: true })
  expect(retry.status.wizardCompleted).toBe(true)
})

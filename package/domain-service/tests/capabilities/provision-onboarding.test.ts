import type { StructureTemplateDefinition } from '../../src/capabilities/onboarding/structure-template-types'
import { provisionOnboarding } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'

const templateSnapshot: StructureTemplateDefinition = {
  id: 'ci-college',
  countryCode: 'CI',
  label: 'Collège',
  description: 'Test college',
  cycle: 'college',
  reportCardStructure: {
    gradingScale: 20,
    passingGrade: 10,
    periods: [{ code: 'T1', name: 'Trimestre 1', weight: 1 }],
    sections: [{ role: 'subjects', label: 'Matières', order: 1 }],
  },
  gradeLevels: [{
    id: 'ci-college:4EME',
    code: '4EME',
    name: '4ème',
    shortLabel: '4ème',
    order: 1,
  }],
  subjects: [{
    code: 'MATH',
    shortName: 'Maths',
    domain: 'Sciences',
    defaultCoefficient: 1,
  }],
  curriculum: [{
    levelCode: '4EME',
    subjectCode: 'MATH',
    coefficient: 1,
    matters: ['Algèbre'],
  }],
}

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
      disciplineMappings: [{ subjectCode: 'MATH', disciplineCode: 'TEST', disciplineName: 'Reviewed test discipline' }],
      templates: ['ci-college'],
      templateSnapshots: [templateSnapshot],
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
          templateSnapshots: [templateSnapshot],
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

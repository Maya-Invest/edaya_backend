import type { OnboardingSchoolApplication } from '../../../src/capabilities/onboarding/onboarding-application'
import type { StructureTemplateDefinition } from '../../../src/capabilities/onboarding/structure-template-types'
import { describe, expect, test } from 'bun:test'
import { applyReportCardsFromTemplate } from '../../../src/capabilities/onboarding/apply-report-cards-from-template'
import { createReportCardContext } from '../../services/workflows/report-card-workflow-context'
import { createTestStaffActor } from '../../support/test-actor'

describe('onboarding report-card scales', () => {
  for (const [maximum, passing] of [[20, 10], [4, 2]] as const) {
    test(`creates immediately editable continuous intervals on a ${maximum}-point scale`, async () => {
      const f = await createReportCardContext()
      const template: StructureTemplateDefinition = {
        id: 'test-template',
        countryCode: 'CI',
        label: 'Test',
        description: 'Test',
        cycle: 'college',
        gradeLevels: [{ id: 'grade1', code: 'G1', name: 'Grade 1', shortLabel: 'G1', order: 1 }],
        subjects: [],
        curriculum: [],
        reportCardStructure: { gradingScale: maximum, passingGrade: passing, periods: [], includeSummary: false, includeComments: false },
      }
      await applyReportCardsFromTemplate({ repositories: f.repositories, forActor: () => f.service } as unknown as OnboardingSchoolApplication, createTestStaffActor('sch1', 'user1'), {
        schoolId: 'sch1',
        academicYearId: 'ay1',
        levels: [{ template, levelCode: 'G1', gradeLevelId: 'grade1', gradeLevelName: 'Grade 1', gradeLevelShortLabel: 'G1', subjects: [] }],
      })
      const scales = await f.repositories.gradeScales.list()
      let scale = scales.find(entry => entry.name === `Sur ${maximum}`)!
      expect(scale.intervalConvention).toBe('continuous')
      const ids = scale.ranges.map(row => row.id)
      expect(ids.every(Boolean)).toBe(true)
      expect(new Set(ids).size).toBe(4)
      expect(scale.findRange(passing - 0.001)?.letter).toBe('D')
      expect(scale.findRange(passing)?.letter).toBe('C')
      expect(scale.findRange(maximum)?.letter).toBe('A')
      expect(scale.findRange(maximum + 0.001)).toBeUndefined()
      const configure = f.service.assessmentsWorkflow.configureGradeScale.bind(f.service.assessmentsWorkflow)
      const row = scale.ranges[1]!
      const { maxScore: _upper, ...minimumOnly } = row
      scale = await configure({ id: scale.id, expectedRevision: scale.revision, requestId: 'edit-onboarded', action: 'interval', interval: { ...minimumOnly, id: row.id!, interpretation: 'Edited mention' } })
      const reloaded = (await f.repositories.gradeScales.findById(scale.id))!
      expect(reloaded.ranges.map(entry => entry.id)).toEqual(ids)
      expect(reloaded.ranges[1]?.interpretation).toBe('Edited mention')
      await expect(configure({ id: scale.id, expectedRevision: 0, requestId: 'stale-onboarded', action: 'interval', interval: { ...minimumOnly, id: row.id! } })).rejects.toMatchObject({ code: 'GRADE_SCALE_REVISION_CONFLICT' })
      scale = await configure({ id: scale.id, expectedRevision: scale.revision, requestId: 'add-onboarded', action: 'interval', interval: { id: 'additional', letter: 'D+', interpretation: 'Developing', minScore: passing / 2 } })
      expect(scale.findRange(passing / 2)?.id).toBe('additional')
      scale = await configure({ id: scale.id, expectedRevision: scale.revision, requestId: 'remove-onboarded', action: 'remove-interval', intervalId: 'additional' })
      expect(scale.ranges.map(entry => entry.id)).toEqual(ids)
    })
  }
})

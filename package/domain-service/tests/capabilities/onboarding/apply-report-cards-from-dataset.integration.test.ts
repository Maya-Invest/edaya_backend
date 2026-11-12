import type { OnboardingSchoolApplication } from '../../../src/capabilities/onboarding/onboarding-application'
import { describe, expect, test } from 'bun:test'
import { resolveOnboardingDataset } from '../../../../../tooling/fixtures/src/onboarding/registry'
import { applyReportCardsFromDataset } from '../../../src/capabilities/onboarding/apply-report-cards-from-dataset'
import { createReportCardContext } from '../../services/workflows/report-card-workflow-context'
import { createTestStaffActor } from '../../support/test-actor'

describe('onboarding report-card scales', () => {
  for (const [maximum, passing] of [[20, 10]] as const) {
    test(`creates immediately editable continuous intervals on a ${maximum}-point scale`, async () => {
      const f = await createReportCardContext()
      const dataset = resolveOnboardingDataset('ci-general-secondary', '1.0.0')
      await applyReportCardsFromDataset({ repositories: f.repositories, commandExecution: f.service.baseService.commandExecution, forActor: () => f.service } as unknown as OnboardingSchoolApplication, createTestStaffActor('sch1', 'user1'), {
        schoolId: 'sch1',
        academicYearId: 'ay1',
        dataset,
        levels: [{ definition: { ...dataset.templates[0]!.gradeLevels[0]!, reportModules: [] }, gradeLevelId: 'grade1', subjects: [] }],
      })
      const scales = await f.repositories.gradeScales.list()
      let scale = scales.find(entry => entry.name === `Sur ${maximum}`)!
      expect(scale.intervalConvention).toBe('continuous')
      const ids = scale.ranges.map(row => row.id)
      expect(ids.every(Boolean)).toBe(true)
      expect(new Set(ids).size).toBe(9)
      expect(scale.findRange(passing - 0.001)?.letter).toBe('I')
      expect(scale.findRange(passing)?.letter).toBe('P')
      expect(scale.findRange(maximum)?.letter).toBe('EX')
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

import { AcademicDiscipline, AcademicPeriod, AcademicPeriodType, AcademicYear, describeGrade, GradeScale } from '@edaya/core'
import { describe, expect, spyOn, test } from 'bun:test'
import { resolveOnboardingDataset } from '../../../../../tooling/fixtures/src/onboarding/registry'
import { applyStructureTemplate } from '../../../src/capabilities/onboarding/apply-structure-template'
import { ensureAcademicStructureFromDraft } from '../../../src/capabilities/onboarding/ensure-academic-structure-from-draft'
import { createTestApp } from '../../support/create-test-app'
import { createOnboardingTestDataset } from '../../support/onboarding-dataset'

async function context() {
  const f = await createTestApp()
  const actor = f.app.baseService.actor
  const schoolId = (await f.schoolRepositories.schools.list())[0]!.id
  const year = new AcademicYear({ id: 'dataset-year', schoolId, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-03'), status: 'published' })
  await f.schoolRepositories.academicYears.save(year)
  return { ...f, actor, schoolId, year }
}

function input(dataset = createOnboardingTestDataset()) {
  return { dataset, templates: dataset.templates.map(row => row.id), levels: dataset.templates.flatMap(row => row.gradeLevels.map(level => ({ gradeLevelId: level.id, classCount: 1, capacity: 30 }))) }
}

describe('canonical dataset application', () => {
  test('applies all twelve levels with shared catalogs, exact grading and subject-side module membership', async () => {
    const f = await context()
    const dataset = resolveOnboardingDataset('ci-general-secondary', '1.0.0')
    await f.schoolRepositories.academicDisciplines.save(new AcademicDiscipline({ id: 'existing-math', schoolId: f.schoolId, code: 'MATH', name: 'Mathématiques' }))
    const result = await applyStructureTemplate(f.application, f.actor, { ...input(dataset), academicYearId: f.year.id })
    expect(result.gradeLevelCount).toBe(12)
    expect(result.gradeScaleCount).toBe(1)
    expect(await f.schoolRepositories.academicDisciplines.count({ schoolId: f.schoolId })).toBe(15)
    expect(await f.schoolRepositories.subjectCategories.count({ schoolId: f.schoolId })).toBe(6)
    const subjects = await f.schoolRepositories.subjects.list({ schoolId: f.schoolId })
    expect(subjects.filter(row => row.code === 'MATH').every(row => row.disciplineId === 'existing-math')).toBe(true)
    const scales = await f.schoolRepositories.gradeScales.list({ schoolId: f.schoolId })
    const scale = scales[0]!
    expect(scale.isDefault).toBe(true)
    expect(scale.ranges.map(row => row.letter)).toEqual(['TF', 'F', 'TI', 'I', 'P', 'AB', 'B', 'TB', 'EX'])
    expect(scale.ranges.map(row => row.interpretation)).toEqual(['Très-faible', 'Faible', 'Très-insuffisant', 'Insuffisant', 'Passable', 'Assez-Bien', 'Bien', 'Très-Bien', 'Excellent'])
    for (const [index, range] of dataset.gradeScales[0]!.ranges.entries()) {
      expect(scale.findRange(range.minScore)?.letter).toBe(range.code)
      if (index > 0)
        expect(scale.findRange(range.minScore - 0.001)?.letter).toBe(dataset.gradeScales[0]!.ranges[index - 1]!.code)
    }
    expect(scale.findRange(20)?.letter).toBe('EX')
    expect(scale.findRange(-0.001)).toBeUndefined()
    expect(scale.findRange(20.001)).toBeUndefined()
    const grades = await f.schoolRepositories.gradeLevels.list({ schoolId: f.schoolId })
    const modules = await f.schoolRepositories.reportModules.list({ schoolId: f.schoolId })
    const matters = await f.schoolRepositories.subjectMatters.list()
    const offerings = await f.schoolRepositories.classSubjects.list()
    for (const template of dataset.templates) {
      for (const definition of template.gradeLevels) {
        const grade = grades.find(row => row.name === definition.name && row.cycle === template.cycle)!
        const policy = grade.gradingPolicyFor(f.year.id)!
        expect(policy.mode).toBe('numeric-first')
        expect(policy.status).toBe('completed')
        expect(policy.revision).toBe(1)
        expect(policy.aggregateLabel).toBe('Moyenne générale')
        expect(policy.scale.id).toBe(scale.id)
        expect(policy.scale.decimalPlaces).toBe(2)
        expect(policy.scale.roundingMode).toBe('nearest')
        expect(grade.reportSettingsFor(f.year.id).passThreshold).toBe(10)
        expect(describeGrade(13.995, policy).reportedValue).toBe(14)
        expect(new GradeScale(policy.scale).findRange(14)?.letter).toBe('B')
        for (const spec of definition.subjects) {
          const subject = subjects.find(row => row.gradeLevelId === grade.id && row.code === spec.code)!
          expect(subject.coefficient).toBe(spec.coefficient)
          expect(subject.isOptional).toBe(spec.isOptional)
          expect(subject.reportOrder).toBe(spec.reportOrder)
          expect(offerings.find(row => row.subjectId === subject.id)!.isOffered).toBe(!spec.isOptional)
          expect(matters.filter(row => row.subjectId === subject.id).sort((a, b) => a.sequenceOrder - b.sequenceOrder).map(row => row.name)).toEqual([...spec.chapters].sort((a, b) => a.order - b.order).map(row => row.title))
          const moduleSpec = definition.reportModules.find(row => row.code === spec.reportModuleCode)
          expect(modules.find(row => row.id === subject.reportModuleId)?.name).toBe(moduleSpec?.name)
          if (moduleSpec)
            expect(modules.find(row => row.id === subject.reportModuleId)?.order).toBe(moduleSpec.order)
        }
      }
    }
    expect(await f.schoolRepositories.academicPeriods.count({ academicYearId: f.year.id })).toBe(3)
  })

  test('preserves an existing default scale and an explicit semester calendar', async () => {
    const f = await context()
    await f.schoolRepositories.gradeScales.save(new GradeScale({ id: 'existing-scale', schoolId: f.schoolId, name: 'Existing', minScore: 0, maxScore: 20, isDefault: true, ranges: [{ letter: 'ALL', minScore: 0, maxScore: 20 }] }))
    for (const [i, start, end] of [[1, '2026-09-01', '2027-01-31'], [2, '2027-02-01', '2027-07-03']] as const)
      await f.schoolRepositories.academicPeriods.save(new AcademicPeriod({ id: `semester-${i}`, schoolId: f.schoolId, academicYearId: f.year.id, name: `Semestre ${i}`, startDate: new Date(start), endDate: new Date(end), type: AcademicPeriodType.Semester }))
    await applyStructureTemplate(f.application, f.actor, { ...input(), academicYearId: f.year.id })
    expect((await f.schoolRepositories.academicPeriods.list({ academicYearId: f.year.id })).map(row => row.type)).toEqual([AcademicPeriodType.Semester, AcademicPeriodType.Semester])
    expect((await f.schoolRepositories.gradeScales.list({ schoolId: f.schoolId })).filter(row => row.isDefault).map(row => row.id)).toEqual(['existing-scale'])
  })

  test('rolls back catalogs, calendar, curriculum, scales and modules after a late failure', async () => {
    const f = await context()
    const save = spyOn(f.application.repositories.reportModules, 'forSchool').mockImplementation(() => {
      throw new Error('report persistence failed')
    })
    try {
      await expect(applyStructureTemplate(f.application, f.actor, input())).rejects.toThrow('report persistence failed')
    }
    finally {
      save.mockRestore()
    }
    for (const key of ['subjectCategories', 'academicDisciplines', 'academicPeriods', 'gradeLevels', 'subjects', 'classGroups', 'gradeScales', 'reportModules'] as const)
      expect(await f.schoolRepositories[key].count({ schoolId: f.schoolId })).toBe(0)
  })

  test('selects the submitted academic year and rejects conflicting existing periods without writes', async () => {
    const f = await context()
    const draft = { schoolId: f.schoolId, academicYearLabel: f.year.name, academicYearStart: '2026-09-01', academicYearEnd: '2027-07-03', periodType: 'semester' as const, periods: [{ label: 'Semestre 1', start: '2026-09-01', end: '2027-01-31' }, { label: 'Semestre 2', start: '2027-02-01', end: '2027-07-03' }] }
    await f.schoolRepositories.academicYears.save(new AcademicYear({ id: 'unrelated-year', schoolId: f.schoolId, name: '2025', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') }))
    await f.schoolRepositories.academicPeriods.save(new AcademicPeriod({ id: 'unrelated-period', schoolId: f.schoolId, academicYearId: 'unrelated-year', name: 'Old', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') }))
    const result = await ensureAcademicStructureFromDraft(f.application, f.actor, draft)
    expect(result.yearId).toBe(f.year.id)
    expect(result.createdPeriodCount).toBe(2)
    expect((await ensureAcademicStructureFromDraft(f.application, f.actor, draft)).createdPeriodCount).toBe(0)
    await expect(ensureAcademicStructureFromDraft(f.application, f.actor, { ...draft, periodType: 'trimester' })).rejects.toMatchObject({ code: 'ACADEMIC_CALENDAR_CONFLICT' })
    await applyStructureTemplate(f.application, f.actor, { ...input(), academicYearId: result.yearId })
    expect((await f.schoolRepositories.subjects.list()).every(row => row.academicYearId === f.year.id)).toBe(true)
    expect(await f.schoolRepositories.academicPeriods.count({ schoolId: f.schoolId })).toBe(3)
  })
})

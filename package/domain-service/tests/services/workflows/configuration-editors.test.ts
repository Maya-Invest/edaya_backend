import { GradeScale, ReportCardDefinition, ReportCardDefinitionSection, ReportCardDefinitionStatus, ReportCardResultStatus, School, StaffMember, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestStaffActor } from '../../support/test-actor'
import { createReportCardContext } from './report-card-workflow-context'

const metadata = { name: 'GPA', minScore: 0, maxScore: 4, decimalPlaces: 2, roundingMode: 'nearest' as const }
const interval = { id: 'fail', letter: 'F', interpretation: 'Not passing', minScore: 0, gpaValue: 0 }

describe('configuration editors', () => {
  test('persists an empty scale, derives thresholds and rejects stale saves without altering previous intervals', async () => {
    const f = await createReportCardContext()
    const configure = f.service.assessmentsWorkflow.configureGradeScale.bind(f.service.assessmentsWorkflow)
    let scale = await configure({ id: 'new-scale', requestId: 'new', expectedRevision: 0, action: 'metadata', metadata })
    expect(scale.isComplete).toBe(false)
    await expect(f.service.assessmentsWorkflow.createReportCardDefinition({ id: 'bad-model', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', gradeScaleId: scale.id, name: 'Incomplete' })).rejects.toMatchObject({ code: 'GRADE_SCALE_INCOMPLETE' })
    scale = await configure({ id: scale.id, requestId: 'first', expectedRevision: 0, action: 'interval', interval })
    expect(scale.ranges[0]?.maxScore).toBe(4)
    const next = { ...interval, id: 'excellent', letter: 'A', interpretation: 'Excellent', minScore: 3.5, gpaValue: 4 }
    scale = await configure({ id: scale.id, requestId: 'second', expectedRevision: scale.revision, action: 'interval', interval: next })
    expect(scale.findRange(3.499)?.id).toBe('fail')
    expect(scale.findRange(3.5)?.id).toBe('excellent')
    expect(scale.findRange(4)?.id).toBe('excellent')
    expect(scale.findRange(4.001)).toBeUndefined()
    expect(scale.findRange(-1)).toBeUndefined()
    await expect(configure({ id: scale.id, requestId: 'stale', expectedRevision: 0, action: 'metadata', metadata })).rejects.toMatchObject({ code: 'GRADE_SCALE_REVISION_CONFLICT' })
    await expect(configure({ id: scale.id, requestId: 'base', expectedRevision: scale.revision, action: 'remove-interval', intervalId: 'fail' })).rejects.toMatchObject({ code: 'BASE_INTERVAL_REQUIRED' })
    await expect(configure({ id: scale.id, requestId: 'duplicate', expectedRevision: scale.revision, action: 'interval', interval: { ...next, id: 'other' } })).rejects.toThrow()
    await expect(configure({ id: scale.id, requestId: 'bounds', expectedRevision: scale.revision, action: 'metadata', metadata: { ...metadata, maxScore: 3 } })).rejects.toThrow()
    const before = scale.ranges
    scale = await configure({ id: scale.id, requestId: 'rename', expectedRevision: scale.revision, action: 'metadata', metadata: { ...metadata, name: 'Points' } })
    expect(scale.ranges).toEqual(before)
    scale = await configure({ id: scale.id, requestId: 'remove-top', expectedRevision: scale.revision, action: 'remove-interval', intervalId: 'excellent' })
    expect(scale.ranges[0]?.maxScore).toBe(4)
    scale = await configure({ id: scale.id, requestId: 'remove-last', expectedRevision: scale.revision, action: 'remove-interval', intervalId: 'fail' })
    expect(scale.isComplete).toBe(false)
    await expect(configure({ id: scale.id, requestId: 'stale-delete', expectedRevision: 0, action: 'delete' })).rejects.toMatchObject({ code: 'GRADE_SCALE_REVISION_CONFLICT' })
    const deletion = { id: scale.id, requestId: 'delete', expectedRevision: scale.revision, action: 'delete' as const }
    await configure(deletion)
    expect(await f.repositories.gradeScales.findById(scale.id)).toBeUndefined()
    expect((await configure(deletion)).id).toBe(scale.id)
  })

  test('requires explicit legacy conversion and keeps legacy policies and results untouched', async () => {
    const f = await createReportCardContext()
    const original = (await f.repositories.gradeScales.findById('grade-scale'))!
    await expect(f.service.assessmentsWorkflow.configureGradeScale({ id: original.id, requestId: 'legacy-write', expectedRevision: 0, action: 'interval', interval })).rejects.toMatchObject({ code: 'GRADE_SCALE_CONVERSION_REQUIRED' })
    const legacy = new GradeScale({ ...original.data, ranges: [{ letter: 'F', minScore: 0, maxScore: 9.99 }, { letter: 'A', minScore: 10, maxScore: 20 }] })
    await f.repositories.gradeScales.save(legacy)
    const scale = await f.service.assessmentsWorkflow.configureGradeScale({ id: legacy.id, requestId: 'convert', expectedRevision: 0, action: 'convert' })
    expect(scale.intervalConvention).toBe('continuous')
    expect(scale.findRange(9.999)?.letter).toBe('F')
    expect(legacy.findRange(9.999)).toBeUndefined()
    expect(scale.ranges.every(row => !!row.id && !!row.interpretation)).toBe(true)
  })

  test('model edits preserve existing reports, reject concurrent edits and apply on explicit regeneration', async () => {
    const f = await createReportCardContext()
    const request = { id: 'report', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' }
    const original = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    const configure = f.service.assessmentsWorkflow.configureReportCardDefinition.bind(f.service.assessmentsWorkflow)
    let model = await configure({ id: 'def1', requestId: 'rename', expectedRevision: 0, action: 'metadata', metadata: { name: 'Updated model', description: 'Details' } })
    expect(model.revision).toBe(1)
    expect(model.academicYearId).toBe('ay1')
    const before = (await f.repositories.sections.findById('sec-math'))!
    model = await configure({ id: model.id, requestId: 'subject', expectedRevision: model.revision, action: 'section', section: { ...before.data, name: 'Mathematics', weight: 1.5, coefficient: 2.5 } })
    expect(model.revision).toBe(2)
    const saved = (await f.repositories.sections.findById(before.id))!
    expect(saved.weight).toBe(1.5)
    expect(saved.coefficient).toBe(2.5)
    expect(saved.parentSectionId).toBe(before.parentSectionId)
    expect((await f.repositories.results.findById('report'))?.data).toEqual(original.data)
    await expect(configure({ id: model.id, requestId: 'stale-model', expectedRevision: 1, action: 'metadata', metadata: { name: 'Stale' } })).rejects.toMatchObject({ code: 'REPORT_MODEL_REVISION_CONFLICT' })
    await expect(configure({ id: model.id, requestId: 'remove-parent', expectedRevision: model.revision, action: 'remove-section', sectionId: 'sec-root' })).rejects.toMatchObject({ code: 'REPORT_CARD_SECTION_HAS_CHILDREN' })
    const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    expect(JSON.stringify(regenerated.sectionResults)).toContain('Mathematics')
    expect(original.sectionResults[0]?.subResults[0]?.name).toBe('Math')
  })

  test('report thresholds are optional, preserve omission, clear with null and validate scale bounds and precision', async () => {
    const f = await createReportCardContext()
    const configure = f.service.assessmentsWorkflow.configureReportCardDefinition.bind(f.service.assessmentsWorkflow)
    const original = (await f.repositories.definitions.findById('def1'))!
    expect(original.passThreshold).toBeUndefined()
    let model = await configure({ id: original.id, requestId: 'threshold', expectedRevision: 0, action: 'metadata', metadata: { name: original.name, passThreshold: 10.1 } })
    expect(model.passThreshold).toBe(10.1)
    model = await configure({ id: model.id, requestId: 'omitted-threshold', expectedRevision: model.revision, action: 'metadata', metadata: { name: 'Renamed' } })
    expect(model.passThreshold).toBe(10.1)
    for (const [index, value] of [-1, 20.1, 10.12, Number.NaN, Number.POSITIVE_INFINITY].entries()) {
      await expect(configure({ id: model.id, requestId: `invalid-threshold-${index}`, expectedRevision: model.revision, action: 'metadata', metadata: { name: model.name, passThreshold: value } })).rejects.toThrow()
    }
    await expect(configure({ id: model.id, requestId: 'stale-threshold', expectedRevision: 0, action: 'metadata', metadata: { name: model.name, passThreshold: 12 } })).rejects.toMatchObject({ code: 'REPORT_MODEL_REVISION_CONFLICT' })
    model = await configure({ id: model.id, requestId: 'clear-threshold', expectedRevision: model.revision, action: 'metadata', metadata: { name: model.name, passThreshold: null } })
    expect(model.passThreshold).toBeUndefined()
    for (const value of [0, 20]) {
      model = await configure({ id: model.id, requestId: `endpoint-${value}`, expectedRevision: model.revision, action: 'metadata', metadata: { name: model.name, passThreshold: value } })
      expect(model.passThreshold).toBe(value)
    }
  })

  test('report models sharing a scale capture independent thresholds only when generated', async () => {
    const f = await createReportCardContext()
    const original = (await f.repositories.definitions.findById('def1'))!
    const scale = (await f.repositories.gradeScales.findById(original.gradeScaleId))!
    await f.repositories.gradeScales.save(new GradeScale({ ...scale.data, ranges: [...scale.ranges], decimalPlaces: 3 }))
    const request = { id: 'threshold-report', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: original.id }
    const first = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    expect(first.isPassing).toBeUndefined()
    const configure = f.service.assessmentsWorkflow.configureReportCardDefinition.bind(f.service.assessmentsWorkflow)
    let model = await configure({ id: original.id, requestId: 'first-model-threshold', expectedRevision: 0, action: 'metadata', metadata: { name: original.name, passThreshold: 16.001 } })
    expect((await f.repositories.results.findById(first.id))?.passThreshold).toBeUndefined()
    let result = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    expect(result.passThreshold).toBe(16.001)
    expect(result.isPassing).toBe(false)
    const second = await f.service.assessmentsWorkflow.createReportCardDefinition({ ...original.data, id: 'second-model', passThreshold: 15.999 })
    for (const section of await f.repositories.sections.list({ reportCardDefinitionId: original.id }))
      await f.repositories.sections.save(new ReportCardDefinitionSection({ ...section.data, id: `second-${section.id}`, reportCardDefinitionId: second.id, parentSectionId: section.parentSectionId ? `second-${section.parentSectionId}` : undefined }))
    const secondResult = await f.service.assessmentsWorkflow.generateReportCardResult({ ...request, id: 'second-report', reportCardDefinitionId: second.id })
    expect(secondResult.isPassing).toBe(true)
    expect(secondResult.overallAverage).toBe(result.overallAverage)
    expect(secondResult.sectionResults.map(row => row.average)).toEqual(result.sectionResults.map(row => row.average))
    model = await configure({ id: original.id, requestId: 'equal-threshold', expectedRevision: model.revision, action: 'metadata', metadata: { name: original.name, passThreshold: 16 } })
    result = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    expect(result.isPassing).toBe(true)
    await configure({ id: original.id, requestId: 'unset-threshold', expectedRevision: model.revision, action: 'metadata', metadata: { name: original.name, passThreshold: null } })
    expect((await f.service.assessmentsWorkflow.generateReportCardResult(request)).isPassing).toBeUndefined()
  })

  test('rejects foreign subjects, cycles and reparenting under subject rows atomically', async () => {
    const f = await createReportCardContext()
    await f.repositories.schools.save(new School({ id: 'foreign', name: 'Foreign', timeZone: 'UTC' }))
    await f.repositories.subjects.save(new Subject({ id: 'foreign-subject', schoolId: 'foreign', name: 'Secret' }))
    const write = (section: any, requestId: string) => f.service.assessmentsWorkflow.configureReportCardDefinition({ id: 'def1', expectedRevision: 0, action: 'section', requestId, section })
    const math = (await f.repositories.sections.findById('sec-math'))!
    await expect(write({ ...math.data, subjectId: 'foreign-subject' }, 'foreign')).rejects.toThrow()
    const root = (await f.repositories.sections.findById('sec-root'))!
    await expect(write({ ...root.data, parentSectionId: 'sec-math' }, 'subject-parent')).rejects.toMatchObject({ code: 'SUBJECT_SECTION_HAS_CHILDREN' })
    await expect(write({ ...root.data, parentSectionId: root.id }, 'self')).rejects.toMatchObject({ code: 'REPORT_CARD_SECTION_SELF_PARENT' })
    expect((await f.repositories.definitions.findById('def1'))?.revision).toBe(0)
    expect((await f.repositories.sections.findById('sec-math'))?.subjectId).toBe('subject-math')
  })

  test('school section updates preserve short name and unrelated settings', async () => {
    const f = await createReportCardContext()
    const original = (await f.repositories.schools.findById('sch1'))!
    await f.repositories.schools.save(new School({ ...original.data, shortName: 'Saved', phone: '123', city: 'Toronto', timetableMinDayGapSameSubject: 3 }))
    const school = await f.service.setupWorkflow.updateSchoolConfiguration({ schoolId: 'sch1', name: 'A new full name' })
    expect(school.shortName).toBe('Saved')
    expect(school.phone).toBe('123')
    expect(school.city).toBe('Toronto')
    expect(school.timetableMinDayGapSameSubject).toBe(3)
    const issuing = await f.service.setupWorkflow.updateSchoolConfiguration({ schoolId: 'sch1', phone: null, issuingName: 'Official' })
    expect(issuing.phone).toBeUndefined()
    expect(issuing.name).toBe(school.name)
    expect(issuing.shortName).toBe('Saved')
  })
  test('denies configuration writes without grants and preserves all revisions', async () => {
    const f = await createReportCardContext()
    await f.repositories.staffMembers.save(new StaffMember({ id: 'reader', schoolId: 'sch1', subjectId: 'reader', firstName: 'Read', lastName: 'Only' }))
    const service = f.forActor(createTestStaffActor('sch1', 'reader'))
    await expect(service.assessmentsWorkflow.configureGradeScale({ id: 'denied', expectedRevision: 0, requestId: 'denied-scale', action: 'metadata', metadata })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(service.assessmentsWorkflow.configureReportCardDefinition({ id: 'def1', expectedRevision: 0, requestId: 'denied-model', action: 'metadata', metadata: { name: 'Denied', passThreshold: 10 } })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(service.assessmentsWorkflow.configureReportCardDefinition({ id: 'def1', expectedRevision: 0, requestId: 'denied-section', action: 'remove-section', sectionId: 'sec-math' })).rejects.toMatchObject({ code: 'forbidden' })
    expect(await f.repositories.gradeScales.findById('denied')).toBeUndefined()
    expect((await f.repositories.definitions.findById('def1'))?.revision).toBe(0)
  })

  test('published reports and model publication survive metadata and section edits', async () => {
    const f = await createReportCardContext({ existingReportCard: { id: 'published', status: ReportCardResultStatus.Published } })
    const model = (await f.repositories.definitions.findById('def1'))!
    await f.repositories.definitions.save(new ReportCardDefinition({ ...model.data, status: ReportCardDefinitionStatus.Published, isDefault: true }))
    const report = (await f.repositories.results.findById('published'))!
    const updated = await f.service.assessmentsWorkflow.configureReportCardDefinition({ id: model.id, expectedRevision: 0, requestId: 'published-edit', action: 'metadata', metadata: { name: 'Revised title', passThreshold: 10 } })
    expect(updated.status).toBe(ReportCardDefinitionStatus.Published)
    expect(updated.isDefault).toBe(true)
    expect((await f.repositories.results.findById(report.id))?.data).toEqual(report.data)
  })

  test('a referenced scale cannot lose its last interval', async () => {
    const f = await createReportCardContext()
    const scale = new GradeScale({ id: 'used', schoolId: 'sch1', ...metadata, intervalConvention: 'continuous', ranges: [{ ...interval, maxScore: 4 }] })
    await f.repositories.gradeScales.save(scale)
    const model = (await f.repositories.definitions.findById('def1'))!
    await f.repositories.definitions.save(new ReportCardDefinition({ ...model.data, gradeScaleId: scale.id }))
    await expect(f.service.assessmentsWorkflow.configureGradeScale({ id: scale.id, expectedRevision: 0, requestId: 'used-last', action: 'remove-interval', intervalId: interval.id })).rejects.toMatchObject({ code: 'GRADE_SCALE_INCOMPLETE' })
    expect((await f.repositories.gradeScales.findById(scale.id))?.ranges).toHaveLength(1)
  })
})

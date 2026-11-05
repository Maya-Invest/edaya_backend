import { GradeLevel, GradeScale, ReportCardResultStatus, School, StaffMember, withShortName } from '@edaya/core'
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
    await f.repositories.gradeScales.save(new GradeScale(withShortName({ ...original.data, intervalConvention: 'legacy-closed', ranges: [...original.ranges] })))
    await expect(f.service.assessmentsWorkflow.configureGradeScale({ id: original.id, requestId: 'legacy-write', expectedRevision: 0, action: 'interval', interval })).rejects.toMatchObject({ code: 'GRADE_SCALE_CONVERSION_REQUIRED' })
    const legacy = new GradeScale(withShortName({ ...original.data, intervalConvention: 'legacy-closed', ranges: [{ letter: 'F', minScore: 0, maxScore: 9.99 }, { letter: 'A', minScore: 10, maxScore: 20 }] }))
    await f.repositories.gradeScales.save(legacy)
    const scale = await f.service.assessmentsWorkflow.configureGradeScale({ id: legacy.id, requestId: 'convert', expectedRevision: 0, action: 'convert' })
    expect(scale.intervalConvention).toBe('continuous')
    expect(scale.findRange(9.999)?.letter).toBe('F')
    expect(legacy.findRange(9.999)).toBeUndefined()
    expect(scale.ranges.every(row => !!row.id && !!row.interpretation)).toBe(true)
  })

  test('module edits stale drafts, reject concurrent saves and apply on explicit regeneration', async () => {
    const f = await createReportCardContext()
    const request = { id: 'report', studentId: 'stu1', periodId: 'per1' }
    const original = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    const scope = { gradeLevelId: 'grade1', academicYearId: 'ay1' }
    const configure = f.service.assessmentsWorkflow.configureReportModules.bind(f.service.assessmentsWorkflow)
    const changed = await configure({ ...scope, requestId: 'rename', expectedRevision: 0, action: 'save', module: { id: 'sec-root', name: 'New module', order: 1, weightingMode: 'explicit', explicitWeight: 2 } })
    expect(changed.settings.revision).toBe(1)
    const stale = (await f.repositories.results.findById('report'))!
    expect(stale.calculationStale).toBe(true)
    expect(stale.sectionResults[0]?.name).toBe(original.sectionResults[0]?.name)
    await expect(configure({ ...scope, requestId: 'stale', expectedRevision: 0, action: 'delete', moduleId: 'sec-root' })).rejects.toMatchObject({ code: 'REPORT_CONFIGURATION_REVISION_CONFLICT' })
    const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult(request)
    expect(regenerated.reportConfigurationRevision).toBe(1)
    expect(regenerated.sectionResults[0]?.name).toBe('New module')
    await configure({ ...scope, requestId: 'delete', expectedRevision: 1, action: 'delete', moduleId: 'sec-root' })
    expect((await f.repositories.subjects.findById('subject-math'))?.reportModuleId).toBeUndefined()
    expect((await f.service.assessmentsWorkflow.generateReportCardResult(request)).sectionResults[0]?.sectionKind).toBe('subject')
  })

  test('thresholds are level/year settings and validate bounds and precision', async () => {
    const f = await createReportCardContext()
    const configure = f.service.assessmentsWorkflow.configureReportSettings.bind(f.service.assessmentsWorkflow)
    const scope = { gradeLevelId: 'grade1', academicYearId: 'ay1' }
    let saved = await configure({ ...scope, requestId: 'threshold', expectedRevision: 0, passThreshold: 10.1 })
    expect(saved.settings.passThreshold).toBe(10.1)
    for (const [index, passThreshold] of [-1, 20.1, 10.12, NaN, Infinity].entries())
      await expect(configure({ ...scope, requestId: `bad-${index}`, expectedRevision: 1, passThreshold })).rejects.toThrow()
    saved = await configure({ ...scope, requestId: 'clear', expectedRevision: 1, passThreshold: null })
    expect(saved.settings.passThreshold).toBeUndefined()
  })

  test('invalid membership rolls back module creation and configuration revision', async () => {
    const f = await createReportCardContext()
    await expect(f.service.assessmentsWorkflow.configureReportModules({ gradeLevelId: 'grade1', academicYearId: 'ay1', requestId: 'foreign', expectedRevision: 0, action: 'save', module: { id: 'new', name: 'New', order: 1 }, assignments: [{ subjectId: 'unknown', moduleId: 'new' }] })).rejects.toThrow()
    expect(await f.repositories.reportModules.findById('new')).toBeUndefined()
    expect((await f.repositories.gradeLevels.findById('grade1'))?.reportSettingsFor('ay1').revision).toBe(0)
  })

  test('school section updates preserve short name and unrelated settings', async () => {
    const f = await createReportCardContext()
    const original = (await f.repositories.schools.findById('sch1'))!
    await f.repositories.schools.save(new School(withShortName({ ...original.data, shortName: 'Saved', phone: '123', city: 'Toronto', timetableMinDayGapSameSubject: 3 })))
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
    await expect(service.assessmentsWorkflow.configureReportSettings({ gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 0, requestId: 'denied', passThreshold: 10 })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(service.getReportConfiguration({ gradeLevelId: 'grade1', academicYearId: 'ay1' })).rejects.toMatchObject({ code: 'forbidden' })
    expect(await f.repositories.gradeScales.findById('denied')).toBeUndefined()
  })

  test('published reports remain unchanged after module edits', async () => {
    const f = await createReportCardContext({ existingReportCard: { id: 'published', status: ReportCardResultStatus.Published } })
    const before = (await f.repositories.results.findById('published'))!
    await f.service.assessmentsWorkflow.configureReportModules({ gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 0, requestId: 'edit', action: 'save', module: { id: 'sec-root', name: 'Updated', order: 1 } })
    expect((await f.repositories.results.findById(before.id))?.data).toEqual(before.data)
  })

  test('a referenced scale cannot lose its last interval', async () => {
    const f = await createReportCardContext()
    const scale = new GradeScale(withShortName({ id: 'used', schoolId: 'sch1', ...metadata, intervalConvention: 'continuous', ranges: [{ ...interval, maxScore: 4 }] }))
    await f.repositories.gradeScales.save(scale)
    const level = (await f.repositories.gradeLevels.findById('grade1'))!
    await f.repositories.gradeLevels.save(new GradeLevel(withShortName({ ...level.data, gradingPolicies: level.gradingPolicies.map(policy => ({ ...policy, scale: { ...scale.data, ranges: [...scale.ranges] } })) })))
    await expect(f.service.assessmentsWorkflow.configureGradeScale({ id: scale.id, expectedRevision: 0, requestId: 'used-last', action: 'remove-interval', intervalId: interval.id })).rejects.toMatchObject({ code: 'GRADE_SCALE_INCOMPLETE' })
    expect((await f.repositories.gradeScales.findById(scale.id))?.ranges).toHaveLength(1)
  })
})

test('report configuration grants allow grouping without curriculum or chapter writes', async () => {
  const { Permission, StaffPermissionAssignment } = await import('@edaya/core')
  const f = await createReportCardContext()
  await f.repositories.staffMembers.save(new StaffMember({ id: 'configurer', schoolId: 'sch1', subjectId: 'configurer', firstName: 'Report', lastName: 'Configurer' }))
  await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'configure-reports', schoolId: 'sch1', staffId: 'configurer', academicYearId: 'ay1', permission: Permission.REPORT_CARD_CONFIGURE, scopes: [{ kind: 'grade_level', gradeLevelId: 'grade1' }] }))
  const service = f.forActor({ ...createTestStaffActor('sch1', 'configurer'), subjectId: 'configurer' })
  const scope = { gradeLevelId: 'grade1', academicYearId: 'ay1' }
  expect((await service.getReportConfiguration(scope)).subjects.map(row => row.id)).toContain('subject-math')
  await service.assessmentsWorkflow.configureReportModules({ ...scope, requestId: 'unassign', expectedRevision: 0, action: 'assign', assignments: [{ subjectId: 'subject-math', moduleId: null }] })
  expect((await f.repositories.subjects.findById('subject-math'))?.reportModuleId).toBeUndefined()
  await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subject-math', name: 'Unauthorized' })).rejects.toMatchObject({ code: 'forbidden' })
  await expect(service.baseService.entities.subjectMatters.list()).rejects.toMatchObject({ code: 'forbidden' })
})

test('curriculum-only subject/module edits roll back together and require a configuration revision', async () => {
  const { Permission, StaffPermissionAssignment } = await import('@edaya/core')
  const f = await createReportCardContext()
  await f.repositories.staffMembers.save(new StaffMember({ id: 'curriculum', schoolId: 'sch1', subjectId: 'curriculum', firstName: 'Curriculum', lastName: 'Manager' }))
  await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'curriculum-grant', schoolId: 'sch1', staffId: 'curriculum', academicYearId: 'ay1', permission: Permission.ACADEMIC_PROGRAM_MANAGE, scopes: [{ kind: 'grade_level', gradeLevelId: 'grade1' }] }))
  const service = f.forActor({ ...createTestStaffActor('sch1', 'curriculum'), subjectId: 'curriculum' })
  await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subject-math', name: 'Unauthorized grouping', reportModuleId: null, expectedReportConfigurationRevision: 0 })).rejects.toMatchObject({ code: 'forbidden' })
  expect((await f.repositories.subjects.findById('subject-math'))?.name).toBe('Math')
  expect((await f.repositories.gradeLevels.findById('grade1'))?.reportSettingsFor('ay1').revision).toBe(0)
  await expect(f.service.academicsWorkflow.updateSubject({ subjectId: 'subject-math', reportModuleId: null })).rejects.toThrow()
})

test('publication rejects absent and stale reviewed drafts instead of generating implicitly', async () => {
  const f = await createReportCardContext()
  const input = { id: 'reviewed', studentId: 'stu1', periodId: 'per1' }
  await expect(f.service.assessmentsWorkflow.publishReportCardResult(input)).rejects.toMatchObject({ code: 'REPORT_REVIEW_REQUIRED' })
  const draft = await f.service.assessmentsWorkflow.generateReportCardResult(input)
  await f.service.assessmentsWorkflow.configureReportModules({ gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 0, requestId: 'reweight', action: 'save', module: { id: 'sec-root', name: 'Academics', order: 1, weightingMode: 'explicit', explicitWeight: 2 } })
  await expect(f.service.assessmentsWorkflow.publishReportCardResult({ ...input, reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })).rejects.toMatchObject({ code: 'REPORT_REVIEW_REQUIRED' })
  expect((await f.repositories.results.findById(draft.id))?.status).toBe(ReportCardResultStatus.Draft)
})

test('regenerating after deleting a commented module retains subject comments and the published snapshot', async () => {
  const f = await createReportCardContext()
  const input = { id: 'module-comment-removal', studentId: 'stu1', periodId: 'per1' }
  let draft = await f.service.assessmentsWorkflow.generateReportCardResult(input)
  const { ReportCardResult, ReportCardResultSection } = await import('@edaya/core')
  const module = draft.sectionResults[0]!
  draft = new ReportCardResult({ ...draft.data, sectionResults: [new ReportCardResultSection({ ...module.data, comment: 'Published module feedback', subResults: module.subResults.map(section => new ReportCardResultSection({ ...section.data, comment: 'Subject feedback', subResults: [] })) })] })
  await f.repositories.results.save(draft)
  await f.service.assessmentsWorkflow.publishReportCardResult({ ...input, reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })
  await f.service.assessmentsWorkflow.configureReportModules({ gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 0, requestId: 'remove-commented-module', action: 'delete', moduleId: 'sec-root' })
  await f.service.assessmentsWorkflow.generateReportCardResult(input)
  const saved = (await f.repositories.results.findById(input.id))!
  expect(saved.sectionResults[0]!.comment).toBe('Published module feedback')
  expect(saved.revisedDraft?.sectionResults).toHaveLength(1)
  expect(saved.revisedDraft?.sectionResults[0]).toMatchObject({ sectionId: 'subject:subject-math', sectionKind: 'subject', comment: 'Subject feedback' })
})

test('optional-policy changes cannot bypass report grouping permissions or invalidation', async () => {
  const { Permission, StaffPermissionAssignment } = await import('@edaya/core')
  const f = await createReportCardContext()
  await f.repositories.staffMembers.save(new StaffMember({ id: 'curriculum-policy', schoolId: 'sch1', subjectId: 'curriculum-policy', firstName: 'Curriculum', lastName: 'Manager' }))
  await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'policy-grant', schoolId: 'sch1', staffId: 'curriculum-policy', academicYearId: 'ay1', permission: Permission.ACADEMIC_PROGRAM_MANAGE, scopes: [{ kind: 'grade_level', gradeLevelId: 'grade1' }] }))
  const service = f.forActor({ ...createTestStaffActor('sch1', 'curriculum-policy'), subjectId: 'curriculum-policy' })
  const revision = (await f.repositories.classSubjects.findById('cs1'))!.participationRevision
  await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subject-math', isOptional: true, reportModuleId: null, expectedReportConfigurationRevision: 0, expectedParticipationRevisions: { cs1: revision } })).rejects.toMatchObject({ code: 'forbidden' })
  expect((await f.repositories.subjects.findById('subject-math'))?.isOptional).toBe(false)
  await f.service.academicsWorkflow.updateSubject({ subjectId: 'subject-math', isOptional: true, coefficient: 2, expectedParticipationRevisions: { cs1: revision } })
  expect((await f.repositories.gradeLevels.findById('grade1'))!.reportSettingsFor('ay1').revision).toBe(1)
})

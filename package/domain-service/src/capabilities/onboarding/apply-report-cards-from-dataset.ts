import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { OnboardingDataset, OnboardingDatasetGradeLevel } from './onboarding-dataset'
import { randomUUID } from 'node:crypto'
import { requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError, GradeLevel, ReportModule, withShortName } from '@edaya/core'
import { datasetEntityId } from './dataset-bindings'

export interface AppliedDatasetLevel {
  definition: OnboardingDatasetGradeLevel
  gradeLevelId: string
  subjects: Array<{ subjectId: string, definition: OnboardingDatasetGradeLevel['subjects'][number] }>
}

export interface ApplyDatasetReportsInput {
  schoolId: string
  academicYearId: string
  dataset: OnboardingDataset
  levels: AppliedDatasetLevel[]
}

/** Called inside the curriculum transaction after subjects have been persisted. */
export async function applyReportCardsFromDataset(application: OnboardingSchoolApplication, actor: ActorMetadata, input: ApplyDatasetReportsInput) {
  if (requireActorSchoolId(actor) !== input.schoolId)
    throw new BusinessRuleViolationError('REPORT_CONFIGURATION_SCOPE_INVALID', 'Invalid onboarding report scope')
  const service = application.forActor(actor)
  await service.baseService.access.curriculum.assertConfigure()
  const scaleIds = new Map<string, string>()
  let hasDefault = (await application.repositories.gradeScales.list({ schoolId: input.schoolId })).some(row => row.isDefault)
  let reportModuleCount = 0
  let reportSubjectAssignmentCount = 0
  for (const level of input.levels) {
    const policy = level.definition.gradingPolicy
    let scaleId = scaleIds.get(policy.gradeScaleCode)
    if (!scaleId) {
      const spec = input.dataset.gradeScales.find(row => row.code === policy.gradeScaleCode)
      if (!spec)
        throw new BusinessRuleViolationError('STRUCTURE_GRADE_SCALE_REQUIRED', 'Dataset grade scale is missing')
      scaleId = await datasetEntityId(application, input.schoolId, input.dataset.id, 'gradeScales', [spec.code])
      await service.assessmentsWorkflow.createGradeScale({
        id: scaleId,
        schoolId: input.schoolId,
        name: spec.name,
        minScore: spec.minScore,
        maxScore: spec.maxScore,
        decimalPlaces: spec.decimalPlaces,
        roundingMode: spec.roundingMode,
        intervalConvention: spec.intervalConvention,
        isDefault: !hasDefault,
        ranges: spec.ranges.map(row => ({ id: randomUUID(), letter: row.code, interpretation: row.label, minScore: row.minScore, maxScore: row.maxScore, gpaValue: row.points })),
      })
      hasDefault = true
      scaleIds.set(policy.gradeScaleCode, scaleId)
    }
    const scale = await application.repositories.gradeScales.findById(scaleId)
    const grade = await application.repositories.gradeLevels.findById(level.gradeLevelId)
    if (!scale || !grade || grade.schoolId !== input.schoolId)
      throw new BusinessRuleViolationError('REPORT_CONFIGURATION_SCOPE_INVALID', 'Invalid onboarding report scope')
    const settings = grade.reportSettingsFor(input.academicYearId)
    await application.repositories.gradeLevels.forSchool!(input.schoolId).save(new GradeLevel(withShortName({
      ...grade.data,
      reportSettings: [...grade.reportSettings.filter(row => row.academicYearId !== input.academicYearId), { ...settings, revision: settings.revision + 1, passThreshold: policy.passThreshold }],
      gradingPolicies: [...grade.gradingPolicies.filter(row => row.academicYearId !== input.academicYearId), {
        academicYearId: input.academicYearId,
        revision: 1,
        mode: policy.mode,
        aggregateLabel: policy.aggregateLabel,
        scale: { ...scale.data, ranges: scale.ranges.map(row => ({ ...row })) },
        status: 'completed',
        numericEquivalents: {},
      }],
    })))
    const moduleIds = new Map<string, string>()
    for (const spec of [...level.definition.reportModules].sort((a, b) => a.order - b.order)) {
      const module = new ReportModule(withShortName({ id: await datasetEntityId(application, input.schoolId, input.dataset.id, 'reportModules', [input.academicYearId, grade.id, spec.code]), schoolId: input.schoolId, gradeLevelId: grade.id, academicYearId: input.academicYearId, name: spec.name, order: spec.order, weightingMode: spec.weightingMode, explicitWeight: spec.explicitWeight }))
      await application.repositories.reportModules.forSchool!(input.schoolId).save(module)
      moduleIds.set(spec.code, module.id)
      reportModuleCount += 1
    }
    for (const member of level.subjects) {
      const spec = member.definition
      const moduleId = spec.reportModuleCode ? moduleIds.get(spec.reportModuleCode) : undefined
      if (spec.reportModuleCode && !moduleId)
        throw new BusinessRuleViolationError('REPORT_MODULE_MEMBERSHIP_INVALID', 'Dataset subject references an unknown module')
      const subject = await application.repositories.subjects.findById(member.subjectId)
      if (!subject || subject.schoolId !== input.schoolId || subject.gradeLevelId !== grade.id || subject.academicYearId !== input.academicYearId)
        throw new BusinessRuleViolationError('REPORT_SUBJECT_REQUIRED', 'Dataset subject was not created in the target level and year')
      await application.repositories.subjects.forSchool!(input.schoolId).save(subject.copyWith({ reportModuleId: moduleId, reportOrder: spec.reportOrder }))
      if (moduleId)
        reportSubjectAssignmentCount += 1
    }
  }
  return { gradeScaleCount: scaleIds.size, reportModuleCount, reportSubjectAssignmentCount }
}

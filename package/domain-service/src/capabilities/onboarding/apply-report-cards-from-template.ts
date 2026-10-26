import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { StructureTemplateCurriculumEntry, StructureTemplateDefinition, StructureTemplateReportCardStructure } from './structure-template-types'
import { randomUUID } from 'node:crypto'
import { requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError, GradeLevel, rangesFromThresholds, ReportModule } from '@edaya/core'

export interface AppliedStructureLevelSubjects {
  template: StructureTemplateDefinition
  levelCode: string
  gradeLevelId: string
  gradeLevelName: string
  gradeLevelShortLabel: string
  subjects: Array<{
    subjectId: string
    subjectCode: string
    domain: string
    coefficient: number
  }>
}

export interface ApplyReportCardsFromTemplateInput {
  schoolId: string
  academicYearId: string
  levels: AppliedStructureLevelSubjects[]
}

export interface ApplyReportCardsFromTemplateResult {
  gradeScaleCount: number
  reportModuleCount: number
  reportSubjectAssignmentCount: number
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

function buildGradeScaleRanges(maxScore: number, passingGrade: number) {
  const span = maxScore - passingGrade
  const step = span / 3

  return rangesFromThresholds([
    {
      id: randomUUID(),
      letter: 'D',
      minScore: 0,

      interpretation: 'Insuffisant',
    },
    {
      id: randomUUID(),
      letter: 'C',
      minScore: passingGrade,

      interpretation: 'Passable',
    },
    {
      id: randomUUID(),
      letter: 'B',
      minScore: roundTo2(passingGrade + step),

      interpretation: 'Bien',
    },
    {
      id: randomUUID(),
      letter: 'A',
      minScore: roundTo2(passingGrade + step * 2),

      interpretation: 'Très bien',
    },
  ], maxScore)
}

async function ensureGradeScale(
  application: OnboardingSchoolApplication,
  actor: ActorMetadata,
  template: StructureTemplateDefinition,
  structure: StructureTemplateReportCardStructure,
  gradeScaleByTemplateId: Map<string, string>,
): Promise<string> {
  const existing = gradeScaleByTemplateId.get(template.id)
  if (existing) {
    return existing
  }

  const service = application.forActor(actor)
  const gradeScaleId = randomUUID()
  await service.assessmentsWorkflow.createGradeScale({
    id: gradeScaleId,
    schoolId: requireActorSchoolId(actor),
    name: `Sur ${structure.gradingScale}`,
    minScore: 0,
    maxScore: structure.gradingScale,
    decimalPlaces: structure.gradingScale <= 10 ? 1 : 2,
    intervalConvention: 'continuous',
    roundingMode: 'nearest',
    description: `Barème ${structure.gradingScale}.`,
    isDefault: gradeScaleByTemplateId.size === 0,
    ranges: buildGradeScaleRanges(structure.gradingScale, structure.passingGrade),
  })

  gradeScaleByTemplateId.set(template.id, gradeScaleId)
  return gradeScaleId
}

export async function applyReportCardsFromTemplate(application: OnboardingSchoolApplication, actor: ActorMetadata, input: ApplyReportCardsFromTemplateInput): Promise<ApplyReportCardsFromTemplateResult> {
  const gradeScaleByTemplateId = new Map<string, string>()
  let reportModuleCount = 0
  let reportSubjectAssignmentCount = 0
  for (const level of input.levels) {
    const structure = level.template.gradeLevels.find(row => row.code === level.levelCode)?.reportCardStructure ?? level.template.reportCardStructure
    if (!structure)
      continue
    const scaleId = await ensureGradeScale(application, actor, level.template, structure, gradeScaleByTemplateId)
    const scale = await application.repositories.gradeScales.findById(scaleId)
    const grade = await application.repositories.gradeLevels.findById(level.gradeLevelId)
    if (!scale || !grade || grade.schoolId !== input.schoolId || requireActorSchoolId(actor) !== input.schoolId)
      throw new BusinessRuleViolationError('REPORT_CONFIGURATION_SCOPE_INVALID', 'Invalid onboarding report scope')
    const settings = grade.reportSettingsFor(input.academicYearId)
    await application.repositories.gradeLevels.forSchool!(input.schoolId).save(new GradeLevel({ ...grade.data, reportSettings: [...grade.reportSettings.filter(row => row.academicYearId !== input.academicYearId), { ...settings, revision: settings.revision + 1, passThreshold: structure.passingGrade }], gradingPolicies: [...grade.gradingPolicies.filter(row => row.academicYearId !== input.academicYearId), { academicYearId: input.academicYearId, revision: 1, mode: 'numeric-first', aggregateLabel: 'Moyenne générale', scale: { ...scale.data, ranges: scale.ranges.map(row => ({ ...row })) }, status: 'completed', numericEquivalents: {} }] }))
    const assigned = new Set<string>()
    for (const spec of structure.modules ?? []) {
      const module = new ReportModule({ id: randomUUID(), schoolId: input.schoolId, gradeLevelId: grade.id, academicYearId: input.academicYearId, name: spec.name, order: spec.order, weightingMode: spec.weightingMode, explicitWeight: spec.explicitWeight })
      await application.repositories.reportModules.forSchool!(input.schoolId).save(module)
      reportModuleCount += 1
      for (const [order, code] of spec.subjectCodes.entries()) {
        const member = level.subjects.find(row => row.subjectCode === code)
        if (!member || assigned.has(member.subjectId))
          throw new BusinessRuleViolationError('REPORT_MODULE_MEMBERSHIP_INVALID', 'Preset module membership must reference each subject at most once')
        const subject = await application.repositories.subjects.findById(member.subjectId)
        if (!subject)
          throw new BusinessRuleViolationError('REPORT_SUBJECT_REQUIRED', 'Preset subject was not created')
        await application.repositories.subjects.forSchool!(input.schoolId).save(subject.copyWith({ reportModuleId: module.id, reportOrder: order + 1 }))
        assigned.add(subject.id)
        reportSubjectAssignmentCount += 1
      }
    }
  }
  return { gradeScaleCount: gradeScaleByTemplateId.size, reportModuleCount, reportSubjectAssignmentCount }
}

export function collectLevelSubjects(
  template: StructureTemplateDefinition,
  _levelCode: string,
  entries: StructureTemplateCurriculumEntry[],
  resolveSubjectId: (entry: StructureTemplateCurriculumEntry) => string | undefined,
): AppliedStructureLevelSubjects['subjects'] {
  const subjects: AppliedStructureLevelSubjects['subjects'] = []

  for (const entry of entries) {
    const subjectId = resolveSubjectId(entry)
    const subject = template.subjects.find(item => item.code === entry.subjectCode)
    if (!subjectId || !subject) {
      continue
    }
    subjects.push({
      subjectId,
      subjectCode: subject.code,
      domain: subject.domain,
      coefficient: entry.coefficient,
    })
  }

  return subjects
}

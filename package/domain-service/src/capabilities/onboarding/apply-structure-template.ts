import type { ActorMetadata } from '@edaya/authorization'
import type { AppliedDatasetLevel } from './apply-report-cards-from-dataset'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { OnboardingDataset, OnboardingDatasetGradeLevel } from './onboarding-dataset'
import type { ClassNamingMode } from './structure-naming'
import { requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, GradeLevel, Subject, SubjectColor, SubjectMatter, withShortName } from '@edaya/core'
import { ensureDatasetCatalog, ensureDatasetSubjectCategories } from '../academics/dataset-subject-categories'

import { applyReportCardsFromDataset } from './apply-report-cards-from-dataset'
import { datasetEntityId } from './dataset-bindings'
import { ensureAcademicPeriodsFromDataset, resolveDatasetCalendar } from './ensure-academic-periods-from-dataset'
import { onboardingDatasetSchema } from './onboarding-dataset'
import { classNameFromLabel } from './structure-naming'

export interface ApplyStructureLevelInput {
  gradeLevelId: string
  classCount: number
  capacity: number
  classNamingMode?: ClassNamingMode
}

export interface ApplyStructureTemplateInput {
  dataset: OnboardingDataset
  academicYearId?: string
  templates: string[]
  levels: ApplyStructureLevelInput[]
}

export interface ApplyStructureTemplateResult {
  gradeLevelCount: number
  classGroupCount: number
  subjectCount: number
  classSubjectCount: number
  gradeScaleCount: number
  reportModuleCount: number
  reportSubjectAssignmentCount: number
  phases: Array<{ phase: string, ms: number }>
}

export interface StructureBootstrapGraph {
  gradeLevels: GradeLevel[]
  subjects: Subject[]
  subjectMatters: SubjectMatter[]
  classGroups: ClassGroup[]
  classSubjects: ClassSubject[]
  classSubjectMatters: ClassSubjectMatter[]
  appliedLevels: AppliedDatasetLevel[]
  gradeLevelCount: number
  classGroupCount: number
  subjectCount: number
  classSubjectCount: number
}

export type NormalizedStructureLevel = ApplyStructureLevelInput & {
  template: OnboardingDataset['templates'][number]
  definition: OnboardingDatasetGradeLevel
}

/** Validate all selections before any school or curriculum writes. */
export function resolveDatasetStructure(input: ApplyStructureTemplateInput): NormalizedStructureLevel[] {
  const dataset = onboardingDatasetSchema.parse(input.dataset)
  if (!input.templates.length || new Set(input.templates).size !== input.templates.length)
    throw new BusinessRuleViolationError('STRUCTURE_TEMPLATE_REQUIRED', 'Select distinct dataset templates')
  const templates = input.templates.map((id) => {
    const template = dataset.templates.find(row => row.id === id)
    if (!template)
      throw new BusinessRuleViolationError('UNKNOWN_STRUCTURE_TEMPLATE', `Unknown dataset template: ${id}`)
    return template
  })
  resolveDatasetCalendar(templates.map(template => dataset.calendarProfiles.find(row => row.code === template.calendarProfileCode)!))
  if (!input.levels.length || new Set(input.levels.map(row => row.gradeLevelId)).size !== input.levels.length)
    throw new BusinessRuleViolationError('STRUCTURE_LEVEL_REQUIRED', 'Select distinct grade levels')
  return input.levels.map((selection) => {
    const template = templates.find(row => row.gradeLevels.some(level => level.id === selection.gradeLevelId))
    const definition = template?.gradeLevels.find(row => row.id === selection.gradeLevelId)
    if (!template || !definition)
      throw new BusinessRuleViolationError('STRUCTURE_LEVEL_NOT_ALLOWED', `Grade level ${selection.gradeLevelId} is not in the selected templates`)
    if (!Number.isInteger(selection.classCount) || selection.classCount < 1)
      throw new BusinessRuleViolationError('STRUCTURE_INVALID_CLASS_COUNT', 'Each level must have at least one class')
    if (!Number.isInteger(selection.capacity) || selection.capacity < 1)
      throw new BusinessRuleViolationError('STRUCTURE_INVALID_CAPACITY', 'Each class must have a positive capacity')
    return { ...selection, template, definition }
  })
}

export async function buildStructureBootstrapGraph(
  application: OnboardingSchoolApplication,
  schoolId: string,
  academicYearId: string,
  levels: NormalizedStructureLevel[],
  disciplineIdsByCode: ReadonlyMap<string, string>,
  categoryIdsByCode: ReadonlyMap<string, string>,
  datasetId: string,
): Promise<StructureBootstrapGraph> {
  const gradeLevels: GradeLevel[] = []
  const subjects: Subject[] = []
  const subjectMatters: SubjectMatter[] = []
  const classGroups: ClassGroup[] = []
  const classSubjects: ClassSubject[] = []
  const classSubjectMatters: ClassSubjectMatter[] = []
  const appliedLevels: AppliedDatasetLevel[] = []

  const boundId = (kind: string, ...keys: (string | number)[]) => datasetEntityId(application, schoolId, datasetId, kind, keys)

  async function ensureSubject(entry: OnboardingDatasetGradeLevel['subjects'][number], gradeLevelId: string): Promise<Subject> {
    const disciplineId = disciplineIdsByCode.get(entry.disciplineCode)
    const categoryId = categoryIdsByCode.get(entry.categoryCode)
    if (!disciplineId || !categoryId)
      throw new BusinessRuleViolationError('STRUCTURE_CATALOG_UNRESOLVED', `Unresolved catalog for subject ${entry.code}`)
    const subject = new Subject(withShortName({
      id: await boundId('subjects', academicYearId, gradeLevelId, entry.code),
      schoolId,
      academicYearId,
      gradeLevelId,
      name: entry.name,
      shortName: entry.shortName,
      disciplineId,
      categoryId,
      coefficient: entry.coefficient,
      isOptional: entry.isOptional,
      color: entry.categoryCode === 'LANGUAGES' ? SubjectColor.Sky : ['HUMANITIES', 'ARTS'].includes(entry.categoryCode) ? SubjectColor.Warm : SubjectColor.Mint,
      reportOrder: entry.reportOrder,
    }))
    subjects.push(subject)
    return subject
  }

  let classSubjectCount = 0

  for (const level of levels) {
    const gradeLevelDef = level.definition

    const gradeLevelId = await boundId('gradeLevels', level.template.id, level.gradeLevelId)

    const classNamingMode = level.classNamingMode ?? 'numerical'
    gradeLevels.push(new GradeLevel(withShortName({
      id: gradeLevelId,
      schoolId,
      name: gradeLevelDef.name,
      shortName: gradeLevelDef.shortLabel,
      order: gradeLevelDef.order,
      cycle: level.template.cycle,
    })))

    const entries = gradeLevelDef.subjects
    const levelSubjects: { subject: Subject, matterIds: string[], definition: typeof entries[number] }[] = []
    for (const entry of entries) {
      const subject = await ensureSubject(entry, gradeLevelId)
      const matterIds: string[] = []
      for (const chapter of [...entry.chapters].sort((a, b) => a.order - b.order)) {
        const id = await boundId('subjectMatters', subject.id, chapter.code)
        subjectMatters.push(new SubjectMatter(withShortName({ id, subjectId: subject.id, name: chapter.title, description: chapter.title, sequenceOrder: chapter.order, estimatedHours: 2 })))
        matterIds.push(id)
      }
      classSubjectCount += level.classCount
      levelSubjects.push({ subject, matterIds, definition: entry })
    }

    appliedLevels.push({
      definition: gradeLevelDef,
      gradeLevelId,
      subjects: levelSubjects.map(({ subject, definition }) => ({ subjectId: subject.id, definition })),
    })

    for (let index = 0; index < level.classCount; index += 1) {
      const classGroupId = await boundId('classGroups', academicYearId, gradeLevelId, index)

      classGroups.push(new ClassGroup(withShortName({
        id: classGroupId,
        schoolId,
        academicYearId,
        gradeLevelId,
        name: classNameFromLabel(gradeLevelDef.shortLabel, index, classNamingMode),
        capacity: level.capacity,
      })))

      for (const { subject, matterIds } of levelSubjects) {
        const classSubjectId = await boundId('classSubjects', classGroupId, subject.id)
        classSubjects.push(new ClassSubject({
          id: classSubjectId,
          classGroupId,
          subjectId: subject.id,
          coefficient: subject.coefficient,
          periodsPerWeek: subject.periodsPerWeek,
          minPeriodSpan: subject.minPeriodSpan,
          maxPeriodSpan: subject.maxPeriodSpan,
          completedPercentage: 0,
          isOffered: !subject.isOptional,
        }))

        for (const matterId of matterIds) {
          classSubjectMatters.push(new ClassSubjectMatter({
            id: await boundId('classSubjectMatters', classSubjectId, matterId),
            classSubjectId,
            subjectMatterId: matterId,
            status: ClassSubjectMatterStatus.NotStarted,
            completedPercentage: 0,
          }))
        }
      }
    }
  }

  return {
    gradeLevels,
    subjects,
    subjectMatters,
    classGroups,
    classSubjects,
    classSubjectMatters,
    appliedLevels,
    gradeLevelCount: gradeLevels.length,
    classGroupCount: classGroups.length,
    subjectCount: subjects.length,
    classSubjectCount,
  }
}

async function persistCurriculumEntities(
  application: OnboardingSchoolApplication,
  graph: StructureBootstrapGraph,
): Promise<void> {
  const repos = application.repositories
  await repos.gradeLevels.batchSave(graph.gradeLevels)
  await repos.subjects.batchSave(graph.subjects)
  await repos.subjectMatters.batchSave(graph.subjectMatters)
}

async function persistClassMirrorEntities(
  application: OnboardingSchoolApplication,
  graph: StructureBootstrapGraph,
): Promise<void> {
  const repos = application.repositories
  await repos.classGroups.batchSave(graph.classGroups)
  await repos.classSubjects.batchSave(graph.classSubjects)
  await repos.classSubjectMatters.batchSave(graph.classSubjectMatters)
}

export async function applyStructureTemplate(
  application: OnboardingSchoolApplication,
  actor: ActorMetadata,
  input: ApplyStructureTemplateInput,
): Promise<ApplyStructureTemplateResult> {
  const dataset = onboardingDatasetSchema.parse(input.dataset)
  const levels = resolveDatasetStructure({ ...input, dataset })
  const schoolId = requireActorSchoolId(actor)
  const service = application.forActor(actor)
  const phases: Array<{ phase: string, ms: number }> = []

  const track = async <T>(phase: string, run: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await run()
    }
    finally {
      phases.push({ phase, ms: performance.now() - started })
    }
  }

  const existingLevels = await application.repositories.gradeLevels.list({ schoolId })
  if (existingLevels.length > 0) {
    throw new BusinessRuleViolationError(
      'STRUCTURE_ALREADY_CONFIGURED',
      'This school already has grade levels configured',
    )
  }

  const academicYears = await application.repositories.academicYears.list({ schoolId })
  const academicYear = input.academicYearId
    ? academicYears.find(year => year.id === input.academicYearId)
    : academicYears.find(year => year.status === 'published') ?? academicYears[0]
  if (!academicYear) {
    throw new BusinessRuleViolationError(
      'NO_ACADEMIC_YEAR',
      'Create an academic year before applying the structure template',
    )
  }

  let gradeLevelCount = 0
  let classGroupCount = 0
  let classSubjectCount = 0
  let subjectCount = 0
  let gradeScaleCount = 0
  let reportModuleCount = 0
  let reportSubjectAssignmentCount = 0

  await service.baseService.atomicExecution.execute(async () => {
    const uniqueTemplates = [...new Map(levels.map(level => [level.template.id, level.template])).values()]
    await ensureAcademicPeriodsFromDataset(application, actor, {
      schoolId,
      datasetId: dataset.id,
      academicYearId: academicYear.id,
      academicYearStart: academicYear.startDate,
      academicYearEnd: academicYear.endDate,
      profiles: uniqueTemplates.map(template => dataset.calendarProfiles.find(profile => profile.code === template.calendarProfileCode)!),
    })

    await service.baseService.access.curriculum.assertConfigure()
    const categoryIdsByCode = await ensureDatasetSubjectCategories(application.repositories, schoolId, dataset.subjectCategories, application.commandExecution, dataset.id)
    const disciplineIdsByCode = await ensureDatasetCatalog(application.repositories, application.commandExecution, schoolId, 'academicDisciplines', dataset.disciplines, dataset.id)
    const graph = await buildStructureBootstrapGraph(
      application,
      schoolId,
      academicYear.id,
      levels,
      disciplineIdsByCode,
      categoryIdsByCode,
      dataset.id,
    )

    await application.forActor(actor).baseService.access.curriculum.assertConfigure()

    await track('structure.curriculum', async () => {
      await persistCurriculumEntities(application, graph)
    })

    await track('structure.classMirrors', async () => {
      await persistClassMirrorEntities(application, graph)
    })

    gradeLevelCount = graph.gradeLevelCount
    classGroupCount = graph.classGroupCount
    subjectCount = graph.subjectCount
    classSubjectCount = graph.classSubjectCount

    const reportCardCounts = await track('structure.reportCards', async () => {
      return applyReportCardsFromDataset(application, actor, {
        schoolId,
        academicYearId: academicYear.id,
        levels: graph.appliedLevels,
        dataset,
      })
    })
    gradeScaleCount = reportCardCounts.gradeScaleCount
    reportModuleCount = reportCardCounts.reportModuleCount
    reportSubjectAssignmentCount = reportCardCounts.reportSubjectAssignmentCount
  })

  return {
    gradeLevelCount,
    classGroupCount,
    subjectCount,
    classSubjectCount,
    gradeScaleCount,
    reportModuleCount,
    reportSubjectAssignmentCount,
    phases,
  }
}

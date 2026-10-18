import type { ActorMetadata } from '@edaya/authorization'
import type { AppliedStructureLevelSubjects } from './apply-report-cards-from-template'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { ClassNamingMode } from './structure-naming'
import type { StructureTemplateCurriculumEntry, StructureTemplateDefinition, StructureTemplateId } from './structure-template-types'
import { randomUUID } from 'node:crypto'
import { requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, GradeLevel, Subject, SubjectCategory, SubjectColor, SubjectMatter } from '@edaya/core'

import { applyReportCardsFromTemplate, collectLevelSubjects } from './apply-report-cards-from-template'
import { ensureAcademicPeriodsFromTemplates } from './ensure-academic-periods-from-template'
import { nextOnboardingClassGroupId } from './next-class-group-id'
import { classDisplayName, parseGradeLevelTemplateId, resolveOnboardingStructureTemplates } from './structure-naming'
import { structureGradeLevelSeedId } from './structure-seed-ids'

export interface ApplyStructureLevelInput {
  gradeLevelId: string
  classCount: number
  capacity: number
  classNamingMode?: ClassNamingMode
}

export interface ApplyStructureTemplateInput {
  templates: StructureTemplateId[]
  templateSnapshots?: StructureTemplateDefinition[]
  levels: ApplyStructureLevelInput[]
}

export interface ApplyStructureTemplateResult {
  gradeLevelCount: number
  classGroupCount: number
  subjectCount: number
  classSubjectCount: number
  gradeScaleCount: number
  reportCardDefinitionCount: number
  reportCardSectionCount: number
  phases: Array<{ phase: string, ms: number }>
}

export interface StructureBootstrapGraph {
  gradeLevels: GradeLevel[]
  subjects: Subject[]
  subjectMatters: SubjectMatter[]
  classGroups: ClassGroup[]
  classSubjects: ClassSubject[]
  classSubjectMatters: ClassSubjectMatter[]
  appliedLevels: AppliedStructureLevelSubjects[]
  gradeLevelCount: number
  classGroupCount: number
  subjectCount: number
  classSubjectCount: number
}

type NormalizedStructureLevel = ApplyStructureLevelInput & {
  template: StructureTemplateDefinition
  levelCode: string
}

const DOMAIN_TO_CATEGORY: Record<string, SubjectCategory> = {
  'Sciences': SubjectCategory.Scientific,
  'Langues': SubjectCategory.Languages,
  'Univers Social': SubjectCategory.Humanities,
  'Arts': SubjectCategory.Arts,
  'Développement Physique': SubjectCategory.Sport,
}

const DOMAIN_TO_COLOR: Record<string, SubjectColor> = {
  'Sciences': SubjectColor.Mint,
  'Langues': SubjectColor.Sky,
  'Univers Social': SubjectColor.Warm,
  'Arts': SubjectColor.Warm,
  'Développement Physique': SubjectColor.Mint,
}

function subjectCategory(domain: string): SubjectCategory {
  return DOMAIN_TO_CATEGORY[domain] ?? SubjectCategory.Scientific
}

function subjectColor(domain: string): SubjectColor {
  return DOMAIN_TO_COLOR[domain] ?? SubjectColor.Mint
}

function catalogSubjectName(
  subject: StructureTemplateDefinition['subjects'][number],
  entry: StructureTemplateCurriculumEntry,
): string {
  return entry.longName ?? subject.shortName
}

export function curriculumEntriesForLevel(
  template: StructureTemplateDefinition,
  levelCode: string,
): StructureTemplateCurriculumEntry[] {
  const specific = template.curriculum.filter(entry => entry.levelCode === levelCode)
  if (specific.length > 0) {
    return specific
  }
  return template.subjects.map(subject => ({
    levelCode,
    subjectCode: subject.code,
    coefficient: subject.defaultCoefficient,
    matters: ['Programme de base'],
  }))
}

function parseStructureInput(
  input: ApplyStructureTemplateInput,
  templates: StructureTemplateDefinition[],
): NormalizedStructureLevel[] {
  if (!input.templates.length) {
    throw new BusinessRuleViolationError(
      'STRUCTURE_TEMPLATE_REQUIRED',
      'At least one school template must be selected',
    )
  }

  const templateById = new Map(templates.map(template => [template.id, template]))
  const allowedLevelIds = new Set(
    templates.flatMap(template => template.gradeLevels.map(level => level.id)),
  )

  const normalized: NormalizedStructureLevel[] = []
  for (const level of input.levels) {
    const parsed = parseGradeLevelTemplateId(level.gradeLevelId)
    if (!parsed || !allowedLevelIds.has(level.gradeLevelId)) {
      throw new BusinessRuleViolationError(
        'STRUCTURE_LEVEL_NOT_ALLOWED',
        `Grade level ${level.gradeLevelId} is not allowed for the selected templates`,
      )
    }
    const template = templateById.get(parsed.templateId)
    if (!template) {
      throw new BusinessRuleViolationError(
        'STRUCTURE_LEVEL_NOT_ALLOWED',
        `Template ${parsed.templateId} is not selected`,
      )
    }
    if (!Number.isInteger(level.classCount) || level.classCount < 1) {
      throw new BusinessRuleViolationError(
        'STRUCTURE_INVALID_CLASS_COUNT',
        'Each level must have at least one class',
      )
    }
    if (!Number.isInteger(level.capacity) || level.capacity < 1) {
      throw new BusinessRuleViolationError(
        'STRUCTURE_INVALID_CAPACITY',
        'Each class must have a positive capacity',
      )
    }
    normalized.push({
      ...level,
      template,
      levelCode: parsed.levelCode,
    })
  }

  if (!normalized.length) {
    throw new BusinessRuleViolationError(
      'STRUCTURE_LEVEL_REQUIRED',
      'At least one grade level must be configured',
    )
  }

  return normalized
}

async function allocateUniqueId(
  preferredId: string,
  schoolId: string,
  findById: (id: string) => Promise<{ id: string, schoolId?: string } | undefined>,
): Promise<string> {
  const existing = await findById(preferredId)
  if (!existing) {
    return preferredId
  }
  if (existing.schoolId === schoolId) {
    return preferredId
  }
  return `${preferredId}--${schoolId.slice(0, 8)}`
}

export async function buildStructureBootstrapGraph(
  application: OnboardingSchoolApplication,
  schoolId: string,
  academicYearId: string,
  levels: NormalizedStructureLevel[],
): Promise<StructureBootstrapGraph> {
  const gradeLevels: GradeLevel[] = []
  const subjects: Subject[] = []
  const subjectMatters: SubjectMatter[] = []
  const classGroups: ClassGroup[] = []
  const classSubjects: ClassSubject[] = []
  const classSubjectMatters: ClassSubjectMatter[] = []
  const appliedLevels: AppliedStructureLevelSubjects[] = []

  const matterIdsByKey = new Map<string, string>()
  const usedClassGroupIds = new Set<string>()
  const classSiblingCountByGradeSeed = new Map<string, number>()

  function ensureSubject(
    template: StructureTemplateDefinition,
    entry: StructureTemplateCurriculumEntry,
    gradeLevelId: string,
  ): string {
    const subject = template.subjects.find(item => item.code === entry.subjectCode)
    if (!subject) {
      throw new BusinessRuleViolationError(
        'STRUCTURE_SUBJECT_UNKNOWN',
        `Unknown subject code ${entry.subjectCode}`,
      )
    }
    const subjectId = randomUUID()
    subjects.push(new Subject({
      id: subjectId,
      schoolId,
      name: catalogSubjectName(subject, entry),
      shortName: subject.shortName,
      code: subject.code,
      gradeLevelId,
      academicYearId,
      coefficient: entry.coefficient ?? subject.defaultCoefficient,
      isOptional: entry.isOptional ?? false,
      category: subjectCategory(subject.domain),
      color: subjectColor(subject.domain),
    }))
    return subjectId
  }

  function ensureMatter(
    subjectId: string,
    matterName: string,
    sequenceOrder: number,
  ): string {
    const key = `${subjectId}::${matterName}`
    const existing = matterIdsByKey.get(key)
    if (existing) {
      return existing
    }
    const matterId = randomUUID()
    matterIdsByKey.set(key, matterId)
    subjectMatters.push(new SubjectMatter({
      id: matterId,
      subjectId,
      name: matterName,
      description: matterName,
      sequenceOrder,
      estimatedHours: 2,
    }))
    return matterId
  }

  let classSubjectCount = 0

  for (const level of levels) {
    const gradeLevelDef = level.template.gradeLevels.find(entry => entry.code === level.levelCode)
    if (!gradeLevelDef) {
      continue
    }

    const preferredGradeLevelId = structureGradeLevelSeedId(level.gradeLevelId)
    const gradeLevelId = await allocateUniqueId(
      preferredGradeLevelId,
      schoolId,
      id => application.repositories.gradeLevels.findById(id),
    )

    const classNamingMode = level.classNamingMode ?? 'numerical'
    gradeLevels.push(new GradeLevel({
      id: gradeLevelId,
      schoolId,
      name: gradeLevelDef.name,
      label: gradeLevelDef.shortLabel,
      order: gradeLevelDef.order,
      cycle: level.template.cycle,
    }))

    const entries = curriculumEntriesForLevel(level.template, level.levelCode)
    const levelSubjects: Array<{
      subject: Subject
      matterIds: string[]
    }> = []

    const levelSubjectIds = new Map<StructureTemplateCurriculumEntry, string>()
    for (const entry of entries) {
      const subjectId = ensureSubject(level.template, entry, gradeLevelId)
      levelSubjectIds.set(entry, subjectId)
      const subject = subjects.find(candidate => candidate.id === subjectId)!

      const matterIds: string[] = []
      for (const [matterIndex, matterName] of entry.matters.entries()) {
        const matterId = ensureMatter(subjectId, matterName, matterIndex + 1)
        matterIds.push(matterId)
      }
      levelSubjects.push({ subject, matterIds })
      classSubjectCount += level.classCount
    }

    appliedLevels.push({
      template: level.template,
      levelCode: level.levelCode,
      gradeLevelId,
      gradeLevelName: gradeLevelDef.name,
      gradeLevelShortLabel: gradeLevelDef.shortLabel,
      subjects: collectLevelSubjects(
        level.template,
        level.levelCode,
        entries,
        entry => levelSubjectIds.get(entry),
      ),
    })

    for (let index = 0; index < level.classCount; index += 1) {
      const preferredClassGroupId = nextOnboardingClassGroupId(
        level.gradeLevelId,
        usedClassGroupIds,
        classSiblingCountByGradeSeed,
      )
      const classGroupId = await allocateUniqueId(
        preferredClassGroupId,
        schoolId,
        id => application.repositories.classGroups.findById(id),
      )
      usedClassGroupIds.add(classGroupId)

      classGroups.push(new ClassGroup({
        id: classGroupId,
        schoolId,
        academicYearId,
        gradeLevelId,
        name: classDisplayName(
          level.template,
          level.levelCode,
          index,
          classNamingMode,
        ),
        capacity: level.capacity,
      }))

      for (const { subject, matterIds } of levelSubjects) {
        const classSubjectId = randomUUID()
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
            id: randomUUID(),
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

export async function persistStructureBootstrapGraph(
  application: OnboardingSchoolApplication,
  actor: ActorMetadata,
  graph: StructureBootstrapGraph,
): Promise<void> {
  await application.forActor(actor).baseService.access.curriculum.assertConfigure()
  await persistCurriculumEntities(application, graph)
  await persistClassMirrorEntities(application, graph)
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
  const templates = resolveOnboardingStructureTemplates(input.templates, input.templateSnapshots ?? [])
  const levels = parseStructureInput(input, templates)
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
  const academicYear = academicYears.find(year => year.status === 'published') ?? academicYears[0]
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
  let reportCardDefinitionCount = 0
  let reportCardSectionCount = 0

  await service.baseService.atomicExecution.execute(async () => {
    const uniqueTemplates = [...new Map(levels.map(level => [level.template.id, level.template])).values()]
    await ensureAcademicPeriodsFromTemplates(application, actor, {
      schoolId,
      academicYearId: academicYear.id,
      academicYearStart: academicYear.startDate,
      academicYearEnd: academicYear.endDate,
      templates: uniqueTemplates,
    })

    const graph = await buildStructureBootstrapGraph(
      application,
      schoolId,
      academicYear.id,
      levels,
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
      return applyReportCardsFromTemplate(application, actor, {
        schoolId,
        academicYearId: academicYear.id,
        levels: graph.appliedLevels,
      })
    })
    gradeScaleCount = reportCardCounts.gradeScaleCount
    reportCardDefinitionCount = reportCardCounts.reportCardDefinitionCount
    reportCardSectionCount = reportCardCounts.reportCardSectionCount
  })

  return {
    gradeLevelCount,
    classGroupCount,
    subjectCount,
    classSubjectCount,
    gradeScaleCount,
    reportCardDefinitionCount,
    reportCardSectionCount,
    phases,
  }
}

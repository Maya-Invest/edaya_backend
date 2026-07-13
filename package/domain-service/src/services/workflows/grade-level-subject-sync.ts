import type { ClassGroup, GradeLevelSubject, GradeLevelSubjectMatter } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { randomUUID } from 'node:crypto'
import {
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  GradeLevelSubject as GradeLevelSubjectEntity,
  GradeLevelSubjectMatter as GradeLevelSubjectMatterEntity,
} from '@edaya/core'

export interface SyncClassSubjectOptions {
  classSubjectId?: string
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export async function syncGradeLevelSubjectToClassGroup(
  baseService: BaseSchoolService,
  gradeLevelSubject: GradeLevelSubject,
  classGroup: ClassGroup,
  options: SyncClassSubjectOptions = {},
): Promise<ClassSubject> {
  const existing = await baseService.repositories.classSubjects.findOne({
    classGroupId: classGroup.id,
    gradeLevelSubjectId: gradeLevelSubject.id,
  }) ?? await baseService.repositories.classSubjects.findOne({
    classGroupId: classGroup.id,
    subjectId: gradeLevelSubject.subjectId,
  })

  const classSubject = new ClassSubject({
    id: existing?.id ?? options.classSubjectId ?? randomUUID(),
    classGroupId: classGroup.id,
    subjectId: gradeLevelSubject.subjectId,
    gradeLevelSubjectId: gradeLevelSubject.id,
    coefficient: gradeLevelSubject.coefficient,
    periodsPerWeek: gradeLevelSubject.periodsPerWeek,
    minPeriodSpan: gradeLevelSubject.minPeriodSpan,
    maxPeriodSpan: gradeLevelSubject.maxPeriodSpan,
    completedPercentage: existing?.completedPercentage ?? 0,
    isOffered: existing?.isOffered ?? !gradeLevelSubject.isOptional,
    createdAt: existing?.createdAt ?? new Date(),
  })

  await baseService.repositories.classSubjects.save(classSubject)

  const gradeMatters = await baseService.repositories.gradeLevelSubjectMatters.list({
    gradeLevelSubjectId: gradeLevelSubject.id,
  })
  for (const gradeMatter of gradeMatters) {
    await syncGradeLevelSubjectMatterToClassSubject(baseService, classSubject, gradeMatter, options)
  }

  return classSubject
}

export async function syncGradeLevelSubjectMatterToClassSubject(
  baseService: BaseSchoolService,
  classSubject: ClassSubject,
  gradeLevelSubjectMatter: GradeLevelSubjectMatter,
  options: SyncClassSubjectOptions = {},
): Promise<ClassSubjectMatter> {
  const existing = await baseService.repositories.classSubjectMatters.findOne({
    classSubjectId: classSubject.id,
    subjectMatterId: gradeLevelSubjectMatter.subjectMatterId,
  })

  const matter = new ClassSubjectMatter({
    id: existing?.id
      ?? options.classSubjectMatterIdsByClassGroupId?.[classSubject.classGroupId]
      ?? randomUUID(),
    classSubjectId: classSubject.id,
    subjectMatterId: gradeLevelSubjectMatter.subjectMatterId,
    status: existing?.status ?? ClassSubjectMatterStatus.NotStarted,
    completedPercentage: existing?.completedPercentage ?? 0,
    updatedByStaffId: existing?.updatedByStaffId,
    startedAt: existing?.startedAt,
    completedAt: existing?.completedAt,
    notes: existing?.notes,
    updatedAt: existing?.updatedAt ?? new Date(),
  })

  await baseService.repositories.classSubjectMatters.save(matter)
  return matter
}

export async function syncGradeLevelSubjectsToClassGroup(
  baseService: BaseSchoolService,
  classGroup: ClassGroup,
  optionsByGradeLevelSubjectId: Record<string, SyncClassSubjectOptions> = {},
): Promise<ClassSubject[]> {
  const gradeLevelSubjects = await baseService.repositories.gradeLevelSubjects.list({
    gradeLevelId: classGroup.gradeLevelId,
    academicYearId: classGroup.academicYearId,
  })

  const synced: ClassSubject[] = []
  for (const gradeLevelSubject of gradeLevelSubjects) {
    synced.push(await syncGradeLevelSubjectToClassGroup(
      baseService,
      gradeLevelSubject,
      classGroup,
      optionsByGradeLevelSubjectId[gradeLevelSubject.id] ?? {},
    ))
  }
  return synced
}

export async function syncGradeLevelSubjectToAllClassGroups(
  baseService: BaseSchoolService,
  gradeLevelSubject: GradeLevelSubject,
  optionsByClassGroupId: Record<string, SyncClassSubjectOptions> = {},
): Promise<ClassSubject[]> {
  const classGroups = await baseService.repositories.classGroups.list({
    gradeLevelId: gradeLevelSubject.gradeLevelId,
    academicYearId: gradeLevelSubject.academicYearId,
  })

  const synced: ClassSubject[] = []
  for (const classGroup of classGroups) {
    synced.push(await syncGradeLevelSubjectToClassGroup(
      baseService,
      gradeLevelSubject,
      classGroup,
      optionsByClassGroupId[classGroup.id] ?? {},
    ))
  }
  return synced
}

export async function removeMirroredClassSubjects(
  baseService: BaseSchoolService,
  gradeLevelSubjectId: string,
): Promise<void> {
  const classSubjects = await baseService.repositories.classSubjects.list({ gradeLevelSubjectId })
  for (const classSubject of classSubjects) {
    const matters = await baseService.repositories.classSubjectMatters.list({ classSubjectId: classSubject.id })
    for (const matter of matters) {
      await baseService.repositories.classSubjectMatters.delete(matter.id)
    }
    await baseService.repositories.classSubjects.delete(classSubject.id)
  }
}

export async function saveGradeLevelSubjectEntity(
  baseService: BaseSchoolService,
  input: ConstructorParameters<typeof GradeLevelSubjectEntity>[0],
): Promise<GradeLevelSubject> {
  const gradeLevelSubject = new GradeLevelSubjectEntity(input)
  await baseService.repositories.gradeLevelSubjects.save(gradeLevelSubject)
  return gradeLevelSubject
}

export async function saveGradeLevelSubjectMatterEntity(
  baseService: BaseSchoolService,
  input: ConstructorParameters<typeof GradeLevelSubjectMatterEntity>[0],
): Promise<GradeLevelSubjectMatter> {
  const matter = new GradeLevelSubjectMatterEntity(input)
  await baseService.repositories.gradeLevelSubjectMatters.save(matter)
  return matter
}

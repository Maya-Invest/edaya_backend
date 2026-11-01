import type { ClassGroup, Subject, SubjectMatter } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { randomUUID } from 'node:crypto'
import { ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { reconcileOffering } from '../../capabilities/subject-enrollment/reconcile'
import { assertClassSubjectGradingMutable, assertClassSubjectUnused } from '../entities/config/academics/class-subject'

export interface SyncClassSubjectOptions {
  classSubjectId?: string
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export async function syncSubjectToClassGroup(baseService: BaseSchoolService, subject: Subject, group: ClassGroup, options: SyncClassSubjectOptions = {}): Promise<ClassSubject> {
  return baseService.atomicExecution.execute(async () => {
    if (subject.schoolId !== group.schoolId || subject.gradeLevelId !== group.gradeLevelId || subject.academicYearId !== group.academicYearId)
      throw new Error('Subject and class must belong to the same school, grade and academic year')
    const existing = await baseService.repositories.classSubjects.findOne({ classGroupId: group.id, subjectId: subject.id })
    const offering = existing ?? new ClassSubject({
      id: options.classSubjectId ?? randomUUID(),
      classGroupId: group.id,
      subjectId: subject.id,
      coefficient: subject.coefficient,
      periodsPerWeek: subject.periodsPerWeek,
      minPeriodSpan: subject.minPeriodSpan,
      maxPeriodSpan: subject.maxPeriodSpan,
      completedPercentage: 0,
      isOffered: !subject.isOptional,
    })
    const scope = await baseService.access.curriculum.assertMirrorSubject(offering, existing)
    if (!existing) {
      await assertClassSubjectGradingMutable(offering, undefined, baseService.repositories)
      await baseService.repositories.classSubjects.forAccess(scope).save(offering)
      await reconcileOffering(baseService.repositories, offering, undefined, baseService.actor)
    }
    for (const matter of await baseService.repositories.subjectMatters.list({ subjectId: subject.id }))
      await syncSubjectMatterToClassSubject(baseService, offering, matter, options)
    return offering
  }, { lockKeys: [academicStateLock(baseService.actor.schoolId)] })
}

export async function syncSubjectMatterToClassSubject(baseService: BaseSchoolService, offering: ClassSubject, chapter: SubjectMatter, options: SyncClassSubjectOptions = {}): Promise<ClassSubjectMatter> {
  if (chapter.subjectId !== offering.subjectId)
    throw new Error('Chapter and class offering must belong to the same subject')
  const existing = await baseService.repositories.classSubjectMatters.findOne({ classSubjectId: offering.id, subjectMatterId: chapter.id })
  const matter = existing ?? new ClassSubjectMatter({
    id: options.classSubjectMatterIdsByClassGroupId?.[offering.classGroupId] ?? `csm-${offering.id}-${chapter.id}`,
    classSubjectId: offering.id,
    subjectMatterId: chapter.id,
    status: ClassSubjectMatterStatus.NotStarted,
    completedPercentage: 0,
  })
  const scope = await baseService.access.curriculum.assertMirrorMatter(matter, existing)
  if (!existing)
    await baseService.repositories.classSubjectMatters.forAccess(scope).save(matter)
  return matter
}

export async function syncSubjectsToClassGroup(baseService: BaseSchoolService, group: ClassGroup, optionsBySubjectId: Record<string, SyncClassSubjectOptions> = {}): Promise<ClassSubject[]> {
  const subjects = await baseService.repositories.subjects.list({ gradeLevelId: group.gradeLevelId, academicYearId: group.academicYearId })
  const offerings: ClassSubject[] = []
  for (const subject of subjects)
    offerings.push(await syncSubjectToClassGroup(baseService, subject, group, optionsBySubjectId[subject.id]))
  return offerings
}

export async function syncSubjectToAllClassGroups(baseService: BaseSchoolService, subject: Subject, optionsByClassGroupId: Record<string, SyncClassSubjectOptions> = {}): Promise<ClassSubject[]> {
  const groups = await baseService.repositories.classGroups.list({ gradeLevelId: subject.gradeLevelId, academicYearId: subject.academicYearId })
  const offerings: ClassSubject[] = []
  for (const group of groups)
    offerings.push(await syncSubjectToClassGroup(baseService, subject, group, optionsByClassGroupId[group.id]))
  return offerings
}

export async function removeMirroredClassSubjects(baseService: BaseSchoolService, subjectId: string): Promise<void> {
  for (const offering of await baseService.repositories.classSubjects.list({ subjectId })) {
    for (const matter of await baseService.repositories.classSubjectMatters.list({ classSubjectId: offering.id }))
      await baseService.entities.classSubjectMatters.delete(matter.id)
    const scope = await baseService.access.entity('classSubjects').assertDelete([offering.id])
    await assertClassSubjectUnused(offering, baseService.repositories)
    await baseService.repositories.classSubjects.forAccess(scope).delete(offering.id)
  }
}

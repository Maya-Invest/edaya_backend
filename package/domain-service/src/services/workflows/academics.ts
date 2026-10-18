import type { Subject, SubjectCategoryEntity, SubjectCategoryInput, SubjectInput, SubjectMatter, SubjectMatterInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { AcademicsWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import type { SyncClassSubjectOptions } from './subject-sync'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, SubjectCategoryEntity as SubjectCategoryRecord, Subject as SubjectEntity, SubjectMatter as SubjectMatterEntity } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'

import { assertTeacherWorkflowWrite } from '../../capabilities/academics/teacher-workflow-boundaries'
import { assertClassSubjectGradingMutable } from '../entities/config/academics/class-subject'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import { removeMirroredClassSubjects, syncSubjectMatterToClassSubject, syncSubjectsToClassGroup, syncSubjectToAllClassGroups } from './subject-sync'

export interface RecordLessonSessionProgressInput {
  id: string
  classSubjectMatterId: string
  lessonSessionId: string
  completedPercentage: number
  notes?: string
  recordedAt?: Date
}

export interface RemoveSubjectMatterInput { subjectMatterId: string }
export interface RemoveSubjectInput { subjectId: string }
export type UpdateSubjectInput = Partial<Omit<SubjectInput, 'id' | 'schoolId' | 'gradeLevelId' | 'academicYearId' | 'createdAt'>> & { subjectId: string }

export interface SetClassSubjectOfferedInput {
  classSubjectId: string
  isOffered: boolean
}

export interface ConfigureClassSubjectTimetableInput {
  classSubjectId: string
  periodsPerWeek?: number | null
  minPeriodSpan?: number | null
  maxPeriodSpan?: number | null
}

export type ConfigureSubjectInput = SubjectInput & {
  classSubjectIdsByClassGroupId?: Record<string, string>
}
export type ConfigureSubjectCategoryInput = SubjectCategoryInput & { schoolId?: string }
export type ConfigureSubjectMatterInput = SubjectMatterInput

export class AcademicsServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AcademicsWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('academics', base.repositories)
  }

  async configureSubject(input: ConfigureSubjectInput): Promise<Subject> {
    return this.baseService.atomicExecution.execute(async () => {
      const { classSubjectIdsByClassGroupId, ...data } = input
      const schoolId = data.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const existing = await this.repositories.subjects.findById(data.id)
      if (existing) {
        if (existing.schoolId !== schoolId || existing.gradeLevelId !== data.gradeLevelId || existing.academicYearId !== data.academicYearId)
          throw new BusinessRuleViolationError('SUBJECT_PLACEMENT_IMMUTABLE', 'A subject cannot move between schools, grades or academic years')
        return this.updateSubject({ ...data, subjectId: data.id })
      }
      const subject = new SubjectEntity({ ...data, schoolId })
      await this.baseService.entities.subjects.save(subject)
      await syncSubjectToAllClassGroups(this.baseService, subject, Object.fromEntries(
        Object.entries(classSubjectIdsByClassGroupId ?? {}).map(([id, classSubjectId]) => [id, { classSubjectId }]),
      ))
      return subject
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async configureSubjectCategory(input: ConfigureSubjectCategoryInput): Promise<SubjectCategoryEntity> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const category = new SubjectCategoryRecord({ ...input, schoolId })
      await this.baseService.entities.subjectCategories.save(category)
      return category
    })
  }

  async configureSubjectMatter(input: SubjectMatterInput): Promise<SubjectMatter> {
    return this.baseService.atomicExecution.execute(async () => {
      const chapter = new SubjectMatterEntity(input)
      await this.baseService.entities.subjectMatters.save(chapter)
      for (const offering of await this.repositories.classSubjects.list({ subjectId: chapter.subjectId }))
        await syncSubjectMatterToClassSubject(this.baseService, offering, chapter)
      return chapter
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async removeSubjectMatter({ subjectMatterId }: RemoveSubjectMatterInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.entities.subjectMatters.delete(subjectMatterId)
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async removeSubject({ subjectId }: RemoveSubjectInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const subject = await this.requireSubject(subjectId)
      await this.baseService.access.entity('subjects').assertDelete([subject.id])
      if (await this.repositories.sections.count({ subjectId }))
        throw new BusinessRuleViolationError('SUBJECT_HAS_DEPENDENCIES', 'Subject is referenced by report-card definitions')
      await removeMirroredClassSubjects(this.baseService, subjectId)
      for (const chapter of await this.repositories.subjectMatters.list({ subjectId }))
        await this.baseService.entities.subjectMatters.delete(chapter.id)
      await this.baseService.entities.subjects.delete(subjectId)
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async updateSubject({ subjectId, ...changes }: UpdateSubjectInput): Promise<Subject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireSubject(subjectId)
      const updated = existing.copyWith(changes)
      await this.baseService.entities.subjects.save(updated)
      for (const offering of await this.repositories.classSubjects.list({ subjectId })) {
        const workload = Object.fromEntries(['coefficient', 'periodsPerWeek', 'minPeriodSpan', 'maxPeriodSpan']
          .filter(key => key in changes).map(key => [key, updated.data[key as keyof typeof updated.data]]))
        const next = new ClassSubject({ ...offering.data, ...workload, isOffered: existing.isOptional !== updated.isOptional ? !updated.isOptional : offering.isOffered })
        if (next.minPeriodSpan !== undefined && next.maxPeriodSpan !== undefined && next.maxPeriodSpan < next.minPeriodSpan)
          throw new BusinessRuleViolationError('CLASS_SUBJECT_PERIOD_SPAN_INVALID', 'maxPeriodSpan must be greater than or equal to minPeriodSpan')
        const scope = await this.baseService.access.curriculum.assertUpdateSubject(next, offering)
        await assertClassSubjectGradingMutable(next, offering, this.repositories)
        await this.repositories.classSubjects.forAccess(scope).save(next)
      }
      await syncSubjectToAllClassGroups(this.baseService, updated)
      return updated
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async setClassSubjectOffered({ classSubjectId, isOffered }: SetClassSubjectOfferedInput): Promise<ClassSubject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireClassSubject(classSubjectId)
      const updated = new ClassSubject({
        id: existing.id,
        classGroupId: existing.classGroupId,
        subjectId: existing.subjectId,
        coefficient: existing.coefficient,
        periodsPerWeek: existing.periodsPerWeek,
        minPeriodSpan: existing.minPeriodSpan,
        maxPeriodSpan: existing.maxPeriodSpan,
        completedPercentage: existing.completedPercentage,
        isOffered,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.classSubjects.save(updated)
      return updated
    })
  }

  async configureClassSubjectTimetable({
    classSubjectId,
    periodsPerWeek,
    minPeriodSpan,
    maxPeriodSpan,
  }: ConfigureClassSubjectTimetableInput): Promise<ClassSubject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireClassSubject(classSubjectId)
      const nextMinPeriodSpan = minPeriodSpan === undefined
        ? existing.minPeriodSpan
        : (minPeriodSpan ?? undefined)
      const nextMaxPeriodSpan = maxPeriodSpan === undefined
        ? existing.maxPeriodSpan
        : (maxPeriodSpan ?? undefined)
      if (nextMinPeriodSpan !== undefined
        && nextMaxPeriodSpan !== undefined
        && nextMaxPeriodSpan < nextMinPeriodSpan) {
        throw new BusinessRuleViolationError(
          'CLASS_SUBJECT_PERIOD_SPAN_INVALID',
          'maxPeriodSpan must be greater than or equal to minPeriodSpan',
        )
      }
      const updated = new ClassSubject({
        id: existing.id,
        classGroupId: existing.classGroupId,
        subjectId: existing.subjectId,
        coefficient: existing.coefficient,
        periodsPerWeek: periodsPerWeek === undefined
          ? existing.periodsPerWeek
          : (periodsPerWeek ?? undefined),
        minPeriodSpan: nextMinPeriodSpan,
        maxPeriodSpan: nextMaxPeriodSpan,
        completedPercentage: existing.completedPercentage,
        isOffered: existing.isOffered,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.classSubjects.save(updated)
      return updated
    })
  }

  async syncSubjectsToClassGroup(classGroupId: string, optionsBySubjectId: Record<string, SyncClassSubjectOptions> = {}) {
    return this.baseService.atomicExecution.execute(async () => {
      const scope = await this.baseService.access.curriculum.assertSyncClass(classGroupId)
      const classGroup = await this.repositories.classGroups.forAccess(scope).findById(classGroupId)
      if (!classGroup)
        denyResourceAccess()
      return syncSubjectsToClassGroup(this.baseService, classGroup, optionsBySubjectId)
    })
  }

  async recordLessonSessionProgress({
    id,
    classSubjectMatterId,
    lessonSessionId,
    completedPercentage,
    notes,
    recordedAt,
  }: RecordLessonSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.baseService.atomicExecution.execute(async () => {
      await assertTeacherWorkflowWrite(this.baseService.actor, 'classSubjectProgress', { lessonSessionId }, undefined, this.baseService.repositories)
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const lessonSession = await this.repositories.lessonSessions.findById(lessonSessionId)
      if (!lessonSession) {
        denyResourceAccess()
      }
      if (lessonSession.schoolId !== this.baseService.actor.schoolId) {
        denyResourceAccess()
      }
      if (lessonSession.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }

      await this.baseService.access.logbook.assertRecordSession(lessonSessionId)

      const existing = await this.repositories.classSubjectProgress.findOne({ classSubjectMatterId, lessonSessionId })
      if (existing) {
        throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', `Progress has already been recorded for matter ${classSubjectMatterId} and lesson session ${lessonSessionId}`)
      }
      if (completedPercentage < matter.completedPercentage) {
        throw new BusinessRuleViolationError('PROGRESS_PERCENTAGE_DECREASED', 'completedPercentage must not decrease cumulative class subject matter progress')
      }

      const snapshot = new ClassSubjectProgress({
        id,
        classSubjectMatterId,
        lessonSessionId,
        completedPercentage,
        recordedByStaffId: resolveAuditActorId(this.baseService.actor),
        notes,
        recordedAt,
      })
      const updatedMatter = new ClassSubjectMatter({
        id: matter.id,
        classSubjectId: matter.classSubjectId,
        subjectMatterId: matter.subjectMatterId,
        status: snapshot.status,
        completedPercentage: snapshot.completedPercentage,
        updatedByStaffId: snapshot.recordedByStaffId,
        startedAt: matter.startedAt ?? (snapshot.completedPercentage > 0 ? snapshot.recordedAt : undefined),
        completedAt: snapshot.status === ClassSubjectMatterStatus.Completed ? snapshot.recordedAt : undefined,
        notes: snapshot.notes ?? matter.notes,
        updatedAt: snapshot.recordedAt,
      })

      const updatedSubject = await this.buildClassSubjectAggregate(classSubject, updatedMatter)
      const scopes = await this.baseService.access.logbook.assertProgress({ snapshot, previousMatter: matter, matter: updatedMatter, previousSubject: classSubject, subject: updatedSubject })
      await this.repositories.classSubjectProgress.forAccess(scopes.snapshot).save(snapshot)
      await this.repositories.classSubjectMatters.forAccess(scopes.matter).save(updatedMatter)
      await this.repositories.classSubjects.forAccess(scopes.subject).save(updatedSubject)
      return snapshot
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  private async requireSubject(subjectId: string): Promise<Subject> {
    const subject = await this.repositories.subjects.findById(subjectId)
    if (!subject || subject.schoolId !== this.baseService.actor.schoolId)
      denyResourceAccess()
    return subject
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.repositories.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      denyResourceAccess()
    }
    const classSubject = await this.repositories.classSubjects.findById(matter.classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async buildClassSubjectAggregate(
    classSubject: ClassSubject,
    updatedMatter: ClassSubjectMatter,
  ): Promise<ClassSubject> {
    const matters = await this.repositories.classSubjectMatters.list({ classSubjectId: classSubject.id })
    const normalizedMatters = matters.map(matter => matter.id === updatedMatter.id ? updatedMatter : matter)
    if (!normalizedMatters.some(matter => matter.id === updatedMatter.id)) {
      normalizedMatters.push(updatedMatter)
    }
    const total = normalizedMatters.reduce((sum, matter) => sum + matter.completedPercentage, 0)
    const completedPercentage = Math.round(total / normalizedMatters.length)
    return new ClassSubject({ ...classSubject.data, completedPercentage })
  }
}

import { Permission } from '@edaya/core';
import type { ClassSubjectInput, ClassSubjectMatterInput, GradeLevelSubject, GradeLevelSubjectInput, GradeLevelSubjectMatter, GradeLevelSubjectMatterInput, Subject, SubjectInput, SubjectMatter, SubjectMatterInput } from '@edaya/core';
import type { BaseSchoolService } from '../base-school-service';
import type { AcademicsWorkflowRepositories } from '../runtime/workflow-repository-catalog';
import type { SyncClassSubjectOptions } from './grade-level-subject-sync';
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization';
import { BusinessRuleViolationError, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, Subject as SubjectEntity, SubjectMatter as SubjectMatterEntity } from '@edaya/core';

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog';
import { BaseServiceWorkflow } from './base-service-workflow';
import { removeMirroredClassSubjects, saveGradeLevelSubjectEntity, saveGradeLevelSubjectMatterEntity, syncGradeLevelSubjectMatterToClassSubject, syncGradeLevelSubjectsToClassGroup, syncGradeLevelSubjectToAllClassGroups } from './grade-level-subject-sync';

export interface RecordLessonSessionProgressInput {
  id: string
  classSubjectMatterId: string
  lessonSessionId: string
  completedPercentage: number
  notes?: string
  recordedAt?: Date
}

export type OfferSubjectToClassInput = ClassSubjectInput

export type AssignMatterToClassSubjectInput = ClassSubjectMatterInput

export interface OfferSubjectToGradeLevelInput extends GradeLevelSubjectInput {
  classSubjectIdsByClassGroupId?: Record<string, string>
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export interface RemoveSubjectFromGradeLevelInput {
  gradeLevelSubjectId: string
}

export interface UpdateGradeLevelSubjectInput {
  gradeLevelSubjectId: string
  coefficient?: number
  isOptional?: boolean
}

export interface AddCustomClassSubjectInput {
  id: string
  classGroupId: string
  subjectId: string
  coefficient?: number
  isOffered?: boolean
}

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

export type AssignMatterToGradeLevelSubjectInput = GradeLevelSubjectMatterInput & {
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export type ConfigureSubjectInput = SubjectInput & { schoolId?: string }
export type ConfigureSubjectMatterInput = SubjectMatterInput

export class AcademicsServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AcademicsWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('academics', base.repositories)
  }

  async configureSubject(input: SubjectInput & { schoolId?: string }): Promise<Subject> {
    const schoolId = input.schoolId ?? this.baseService.actor.schoolId
    this.checkActorSchool(schoolId)
    const subject = new SubjectEntity({ ...input, schoolId })
    await this.baseService.entities.subjects.save(subject)
    return subject
  }

  async configureSubjectMatter(input: SubjectMatterInput): Promise<SubjectMatter> {
    const subjectMatter = new SubjectMatterEntity(input)
    await this.baseService.entities.subjectMatters.save(subjectMatter)
    return subjectMatter
  }

  async offerSubjectToGradeLevel(input: OfferSubjectToGradeLevelInput): Promise<GradeLevelSubject> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    const { classSubjectIdsByClassGroupId, classSubjectMatterIdsByClassGroupId, ...gradeLevelSubjectInput } = input

    return this.baseService.atomicExecution.execute(async () => {
      const gradeLevelSubject = await saveGradeLevelSubjectEntity(this.baseService, gradeLevelSubjectInput)
      const optionsByClassGroupId = Object.fromEntries(
        Object.entries(classSubjectIdsByClassGroupId ?? {}).map(([classGroupId, classSubjectId]) => [
          classGroupId,
          {
            classSubjectId,
            classSubjectMatterIdsByClassGroupId,
          } satisfies SyncClassSubjectOptions,
        ]),
      )
      await syncGradeLevelSubjectToAllClassGroups(this.baseService, gradeLevelSubject, optionsByClassGroupId)
      return gradeLevelSubject
    })
  }

  async removeSubjectFromGradeLevel({ gradeLevelSubjectId }: RemoveSubjectFromGradeLevelInput): Promise<void> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    await this.baseService.atomicExecution.execute(async () => {
      const gradeLevelSubject = await this.requireGradeLevelSubject(gradeLevelSubjectId)
      await removeMirroredClassSubjects(this.baseService, gradeLevelSubject.id)
      const matters = await this.repositories.gradeLevelSubjectMatters.list({ gradeLevelSubjectId })
      for (const matter of matters) {
        await this.repositories.gradeLevelSubjectMatters.delete(matter.id)
      }
      await this.repositories.gradeLevelSubjects.delete(gradeLevelSubject.id)
    })
  }

  async updateGradeLevelSubject({ gradeLevelSubjectId, coefficient, isOptional }: UpdateGradeLevelSubjectInput): Promise<GradeLevelSubject> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireGradeLevelSubject(gradeLevelSubjectId)
      const updated = await saveGradeLevelSubjectEntity(this.baseService, {
        id: existing.id,
        gradeLevelId: existing.gradeLevelId,
        academicYearId: existing.academicYearId,
        subjectId: existing.subjectId,
        coefficient: coefficient ?? existing.coefficient,
        isOptional: isOptional ?? existing.isOptional,
        createdAt: existing.createdAt,
      })

      const classSubjects = await this.repositories.classSubjects.list({ gradeLevelSubjectId })
      const isOptionalChanged = updated.isOptional !== existing.isOptional
      for (const classSubject of classSubjects) {
        await this.repositories.classSubjects.save(new ClassSubject({
          id: classSubject.id,
          classGroupId: classSubject.classGroupId,
          subjectId: classSubject.subjectId,
          gradeLevelSubjectId: classSubject.gradeLevelSubjectId,
          coefficient: coefficient ?? classSubject.coefficient,
          periodsPerWeek: classSubject.periodsPerWeek,
          completedPercentage: classSubject.completedPercentage,
          isOffered: isOptionalChanged ? !updated.isOptional : classSubject.isOffered,
          createdAt: classSubject.createdAt,
        }))
      }

      return updated
    })
  }

  async addCustomClassSubject({
    id,
    classGroupId,
    subjectId,
    coefficient,
    isOffered = true,
  }: AddCustomClassSubjectInput): Promise<ClassSubject> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    const classSubject = new ClassSubject({
      id,
      classGroupId,
      subjectId,
      coefficient,
      isOffered,
      completedPercentage: 0,
    })
    await this.baseService.entities.classSubjects.save(classSubject)
    return classSubject
  }

  async setClassSubjectOffered({ classSubjectId, isOffered }: SetClassSubjectOfferedInput): Promise<ClassSubject> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    const existing = await this.requireClassSubject(classSubjectId)
    const updated = new ClassSubject({
      id: existing.id,
      classGroupId: existing.classGroupId,
      subjectId: existing.subjectId,
      gradeLevelSubjectId: existing.gradeLevelSubjectId,
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
  }

  async configureClassSubjectTimetable({
    classSubjectId,
    periodsPerWeek,
    minPeriodSpan,
    maxPeriodSpan,
  }: ConfigureClassSubjectTimetableInput): Promise<ClassSubject> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
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
      gradeLevelSubjectId: existing.gradeLevelSubjectId,
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
  }

  async assignMatterToGradeLevelSubject(input: AssignMatterToGradeLevelSubjectInput): Promise<GradeLevelSubjectMatter> {
    await this.baseService.access.assertSchool(Permission.ACADEMIC_PROGRAM_UPDATE)
    const { classSubjectMatterIdsByClassGroupId, ...matterInput } = input

    return this.baseService.atomicExecution.execute(async () => {
      const gradeLevelSubjectMatter = await saveGradeLevelSubjectMatterEntity(this.baseService, matterInput)
      const classSubjects = await this.repositories.classSubjects.list({
        gradeLevelSubjectId: gradeLevelSubjectMatter.gradeLevelSubjectId,
      })
      for (const classSubject of classSubjects) {
        await syncGradeLevelSubjectMatterToClassSubject(
          this.baseService,
          classSubject,
          gradeLevelSubjectMatter,
          { classSubjectMatterIdsByClassGroupId },
        )
      }
      return gradeLevelSubjectMatter
    })
  }

  async syncGradeLevelSubjectsToClassGroup(classGroupId: string, optionsByGradeLevelSubjectId: Record<string, SyncClassSubjectOptions> = {}) {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return syncGradeLevelSubjectsToClassGroup(this.baseService, classGroup, optionsByGradeLevelSubjectId)
  }

  /** @internal */
  async offerSubjectToClass(input: OfferSubjectToClassInput): Promise<ClassSubject> {
    const classSubject = new ClassSubject(input)
    await this.repositories.classSubjects.save(classSubject)
    return classSubject
  }

  /** @internal */
  async assignMatterToClassSubject(input: AssignMatterToClassSubjectInput): Promise<ClassSubjectMatter> {
    const matter = new ClassSubjectMatter({
      ...input,
      status: input.status ?? ClassSubjectMatterStatus.NotStarted,
      completedPercentage: input.completedPercentage ?? 0,
    })
    await this.repositories.classSubjectMatters.save(matter)
    return matter
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

      
      await this.baseService.access.assertResources(Permission.CLASS_LOGBOOK_CREATE, 'lessonSessions', [lessonSessionId], 'write')

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

      await this.baseService.entities.classSubjectProgress.save(snapshot)
      await this.baseService.entities.classSubjectMatters.save(updatedMatter)
      await this.updateClassSubjectAggregate(classSubject, updatedMatter)
      return snapshot
    })
  }

  private async requireGradeLevelSubject(gradeLevelSubjectId: string): Promise<GradeLevelSubject> {
    const gradeLevelSubject = await this.repositories.gradeLevelSubjects.findById(gradeLevelSubjectId)
    if (!gradeLevelSubject) {
      denyResourceAccess()
    }
    const gradeLevel = await this.repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId)
    if (!gradeLevel || gradeLevel.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return gradeLevelSubject
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

  private async updateClassSubjectAggregate(
    classSubject: ClassSubject,
    updatedMatter: ClassSubjectMatter,
  ): Promise<void> {
    const matters = await this.repositories.classSubjectMatters.list({ classSubjectId: classSubject.id })
    const normalizedMatters = matters.map(matter => matter.id === updatedMatter.id ? updatedMatter : matter)
    if (!normalizedMatters.some(matter => matter.id === updatedMatter.id)) {
      normalizedMatters.push(updatedMatter)
    }
    const total = normalizedMatters.reduce((sum, matter) => sum + matter.completedPercentage, 0)
    const completedPercentage = Math.round(total / normalizedMatters.length)
    await this.baseService.entities.classSubjects.save(new ClassSubject({
      id: classSubject.id,
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
      gradeLevelSubjectId: classSubject.gradeLevelSubjectId,
      coefficient: classSubject.coefficient,
      periodsPerWeek: classSubject.periodsPerWeek,
      completedPercentage,
      isOffered: classSubject.isOffered,
      createdAt: classSubject.createdAt,
    }))
  }
}

import type { ClassSubjectInput, ClassSubjectMatterInput, GradeLevelSubject, GradeLevelSubjectInput, GradeLevelSubjectMatter, GradeLevelSubjectMatterInput } from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import type { SyncClassSubjectOptions } from './grade-level-subject-sync'
import { permissionAction } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission, resolveAuditActorId } from '../../capabilities/authorization'
import {
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  ClassSubjectProgress,
} from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { roundTo2 } from '../../domain/shared/utils'
import { BaseServiceWorkflow } from './base-service-workflow'
import {
  removeMirroredClassSubjects,
  saveGradeLevelSubjectEntity,
  saveGradeLevelSubjectMatterEntity,

  syncGradeLevelSubjectMatterToClassSubject,
  syncGradeLevelSubjectsToClassGroup,
  syncGradeLevelSubjectToAllClassGroups,
} from './grade-level-subject-sync'

export interface RecordSessionProgressInput {
  id: string
  classSubjectMatterId: string
  sessionId: string
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
}

export type AssignMatterToGradeLevelSubjectInput = GradeLevelSubjectMatterInput & {
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export class AcademicsServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async offerSubjectToGradeLevel(input: OfferSubjectToGradeLevelInput): Promise<GradeLevelSubject> {
    await permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE)(this.baseService.actor)
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
    await permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE)(this.baseService.actor)
    await this.baseService.atomicExecution.execute(async () => {
      const gradeLevelSubject = await this.requireGradeLevelSubject(gradeLevelSubjectId)
      await removeMirroredClassSubjects(this.baseService, gradeLevelSubject.id)
      const matters = await this.baseService.repositories.gradeLevelSubjectMatters.list({ gradeLevelSubjectId })
      for (const matter of matters) {
        await this.baseService.repositories.gradeLevelSubjectMatters.delete(matter.id)
      }
      await this.baseService.repositories.gradeLevelSubjects.delete(gradeLevelSubject.id)
    })
  }

  async updateGradeLevelSubject({ gradeLevelSubjectId, coefficient }: UpdateGradeLevelSubjectInput): Promise<GradeLevelSubject> {
    await permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE)(this.baseService.actor)
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireGradeLevelSubject(gradeLevelSubjectId)
      const updated = await saveGradeLevelSubjectEntity(this.baseService, {
        id: existing.id,
        gradeLevelId: existing.gradeLevelId,
        academicYearId: existing.academicYearId,
        subjectId: existing.subjectId,
        coefficient,
        createdAt: existing.createdAt,
      })

      const classSubjects = await this.baseService.repositories.classSubjects.list({ gradeLevelSubjectId })
      for (const classSubject of classSubjects) {
        await this.baseService.repositories.classSubjects.save(new ClassSubject({
          id: classSubject.id,
          classGroupId: classSubject.classGroupId,
          subjectId: classSubject.subjectId,
          gradeLevelSubjectId: classSubject.gradeLevelSubjectId,
          coefficient,
          completedPercentage: classSubject.completedPercentage,
          createdAt: classSubject.createdAt,
        }))
      }

      return updated
    })
  }

  async assignMatterToGradeLevelSubject(input: AssignMatterToGradeLevelSubjectInput): Promise<GradeLevelSubjectMatter> {
    await permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE)(this.baseService.actor)
    const { classSubjectMatterIdsByClassGroupId, ...matterInput } = input

    return this.baseService.atomicExecution.execute(async () => {
      const gradeLevelSubjectMatter = await saveGradeLevelSubjectMatterEntity(this.baseService, matterInput)
      const classSubjects = await this.baseService.repositories.classSubjects.list({
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
    const classGroup = await this.baseService.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return syncGradeLevelSubjectsToClassGroup(this.baseService, classGroup, optionsByGradeLevelSubjectId)
  }

  /** @internal */
  async offerSubjectToClass(input: OfferSubjectToClassInput): Promise<ClassSubject> {
    const classSubject = new ClassSubject(input)
    await this.baseService.repositories.classSubjects.save(classSubject)
    return classSubject
  }

  /** @internal */
  async assignMatterToClassSubject(input: AssignMatterToClassSubjectInput): Promise<ClassSubjectMatter> {
    const matter = new ClassSubjectMatter({
      ...input,
      status: input.status ?? ClassSubjectMatterStatus.NotStarted,
      completedPercentage: input.completedPercentage ?? 0,
    })
    await this.baseService.repositories.classSubjectMatters.save(matter)
    return matter
  }

  async recordSessionProgress({
    id,
    classSubjectMatterId,
    sessionId,
    completedPercentage,
    notes,
    recordedAt,
  }: RecordSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.baseService.atomicExecution.execute(async () => {
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const session = await this.baseService.repositories.sessions.findById(sessionId)
      if (!session) {
        denyResourceAccess()
      }
      const classGroup = await this.baseService.repositories.classGroups.findById(session.classGroupId)
      if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
        denyResourceAccess()
      }
      if (session.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }

      await permissionAction(Permission.CLASS_LOGBOOK_CREATE)(this.baseService.actor)
      await this.baseService.authorizationPolicy.checkSessionAccess(this.baseService.actor, [sessionId])

      const existing = await this.baseService.repositories.classSubjectProgress.findOne({ classSubjectMatterId, sessionId })
      if (existing) {
        throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', `Progress has already been recorded for matter ${classSubjectMatterId} and session ${sessionId}`)
      }
      if (completedPercentage < matter.completedPercentage) {
        throw new BusinessRuleViolationError('PROGRESS_PERCENTAGE_DECREASED', 'completedPercentage must not decrease cumulative class subject matter progress')
      }

      const snapshot = new ClassSubjectProgress({
        id,
        classSubjectMatterId,
        sessionId,
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

      await this.baseService.entities.classSubjectProgress.save(snapshot, { moduleChecked: true })
      await this.baseService.entities.classSubjectMatters.save(updatedMatter, { moduleChecked: true })
      await this.updateClassSubjectAggregate(classSubject, updatedMatter)
      return snapshot
    })
  }

  private async requireGradeLevelSubject(gradeLevelSubjectId: string): Promise<GradeLevelSubject> {
    const gradeLevelSubject = await this.baseService.repositories.gradeLevelSubjects.findById(gradeLevelSubjectId)
    if (!gradeLevelSubject) {
      denyResourceAccess()
    }
    const gradeLevel = await this.baseService.repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId)
    if (!gradeLevel || gradeLevel.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return gradeLevelSubject
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.baseService.repositories.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      denyResourceAccess()
    }
    const classSubject = await this.baseService.repositories.classSubjects.findById(matter.classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.baseService.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.baseService.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.baseService.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async updateClassSubjectAggregate(
    classSubject: ClassSubject,
    updatedMatter: ClassSubjectMatter,
  ): Promise<void> {
    const matters = await this.baseService.repositories.classSubjectMatters.list({ classSubjectId: classSubject.id })
    const normalizedMatters = matters.map(matter => matter.id === updatedMatter.id ? updatedMatter : matter)
    if (!normalizedMatters.some(matter => matter.id === updatedMatter.id)) {
      normalizedMatters.push(updatedMatter)
    }
    const total = normalizedMatters.reduce((sum, matter) => sum + matter.completedPercentage, 0)
    const completedPercentage = roundTo2(total / normalizedMatters.length)
    await this.baseService.entities.classSubjects.save(new ClassSubject({
      id: classSubject.id,
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
      gradeLevelSubjectId: classSubject.gradeLevelSubjectId,
      coefficient: classSubject.coefficient,
      completedPercentage,
      createdAt: classSubject.createdAt,
    }), { moduleChecked: true })
  }
}

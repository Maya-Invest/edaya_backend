import type { BaseSchoolService } from '../base-school-service'
import { ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress } from '../../../entities'
import { roundTo2 } from '../../../entities/utils'
import { denyResourceAccess, resolveAuditActorId } from '../../authorization'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface RecordSessionProgressInput {
  id: string
  classSubjectMatterId: string
  sessionId: string
  completedPercentage: number
  notes?: string
  recordedAt?: Date
}

export class AcademicsServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async recordSessionProgress({
    id,
    classSubjectMatterId,
    sessionId,
    completedPercentage,
    notes,
    recordedAt,
  }: RecordSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.base.atomicExecution.execute(async () => {
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const session = await this.base.repositories.sessions.findById(sessionId)
      if (!session) {
        denyResourceAccess()
      }
      const classGroup = await this.base.repositories.classGroups.findById(session.classGroupId)
      if (!classGroup || classGroup.schoolId !== this.base.actor.schoolId) {
        denyResourceAccess()
      }
      if (session.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }

      await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'academics.record_progress')
      await this.base.authorizationPolicy.checkSessionAccess(this.base.actor, [sessionId])

      const existing = await this.base.repositories.classSubjectProgress.findOne({ classSubjectMatterId, sessionId })
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
        recordedByStaffId: resolveAuditActorId(this.base.actor),
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

      await this.base.classSubjectProgress.save(snapshot, { moduleChecked: true })
      await this.base.classSubjectMatters.save(updatedMatter, { moduleChecked: true })
      await this.updateClassSubjectAggregate(classSubject, updatedMatter)
      return snapshot
    })
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.base.repositories.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      denyResourceAccess()
    }
    const classSubject = await this.base.repositories.classSubjects.findById(matter.classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.base.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.base.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.base.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async updateClassSubjectAggregate(
    classSubject: ClassSubject,
    updatedMatter: ClassSubjectMatter,
  ): Promise<void> {
    const matters = await this.base.repositories.classSubjectMatters.list({ classSubjectId: classSubject.id })
    const normalizedMatters = matters.map(matter => matter.id === updatedMatter.id ? updatedMatter : matter)
    if (!normalizedMatters.some(matter => matter.id === updatedMatter.id)) {
      normalizedMatters.push(updatedMatter)
    }
    const total = normalizedMatters.reduce((sum, matter) => sum + matter.completedPercentage, 0)
    const completedPercentage = roundTo2(total / normalizedMatters.length)
    await this.base.classSubjects.save(new ClassSubject({
      id: classSubject.id,
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
      coefficient: classSubject.coefficient,
      completedPercentage,
      createdAt: classSubject.createdAt,
    }), { moduleChecked: true })
  }
}

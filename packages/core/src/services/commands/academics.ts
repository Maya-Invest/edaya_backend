import type { SubjectMatter } from '../../entities/academics/subject-matter'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../shared/service-args'
import { ClassSubject } from '../../entities/academics/class-subject'
import { ClassSubjectMatter, ClassSubjectMatterStatus } from '../../entities/academics/class-subject-matter'
import { ClassSubjectProgress } from '../../entities/academics/class-subject-progress'
import { roundTo2 } from '../../entities/utils'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BaseSchoolService } from '../entities'
import { BusinessRuleViolationError } from '../shared/business-rule-error'

export class AcademicsService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.repositories = args.repositories
    this.base = new BaseSchoolService(args)
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly actor: ActorMetadata
  private readonly authorizationPolicy: AuthorizationPolicy
  private readonly base: BaseSchoolService
  private readonly repositories: SchoolRepositories

  async offerSubjectToClass({
    id,
    classGroupId,
    subjectId,
    createdAt,
  }: {
    id: string
    classGroupId: string
    subjectId: string
    coefficient?: number
    createdAt?: Date
  }): Promise<ClassSubject> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    const subject = await this.repositories.subjects.findById(subjectId)
    if (!subject || subject.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    if (subject.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.checkClassGroupAccess(this.actor, [classGroupId])
    const existing = await this.repositories.classSubjects.findOne({ classGroupId, subjectId })
    if (existing) {
      return existing
    }
    const classSubject = new ClassSubject({ id, classGroupId, subjectId, coefficient: 1, createdAt })
    await this.base.classSubjects.save(classSubject, { moduleChecked: true })
    return classSubject
  }

  async assignMatterToClassSubject({
    id,
    classSubjectId,
    subjectMatterId,
    notes,
    updatedAt,
  }: {
    id: string
    classSubjectId: string
    subjectMatterId: string
    notes?: string
    updatedAt?: Date
  }): Promise<ClassSubjectMatter> {
    const classSubject = await this.requireClassSubject(classSubjectId)
    const subjectMatter = await this.requireSubjectMatter(subjectMatterId)
    if (subjectMatter.subjectId !== classSubject.subjectId) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorizationPolicy.checkClassGroupAccess(this.actor, [classGroup.id])
    const existing = await this.repositories.classSubjectMatters.findOne({ classSubjectId, subjectMatterId })
    if (existing) {
      return existing
    }
    const assigned = new ClassSubjectMatter({
      id,
      classSubjectId,
      subjectMatterId,
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
      updatedByStaffId: resolveAuditActorId(this.actor),
      notes,
      updatedAt,
    })
    await this.base.classSubjectMatters.save(assigned, { moduleChecked: true })
    return assigned
  }

  async recordSessionProgress({
    id,
    classSubjectMatterId,
    sessionId,
    completedPercentage,
    notes,
    recordedAt,
  }: {
    id: string
    classSubjectMatterId: string
    sessionId: string
    completedPercentage: number
    notes?: string
    recordedAt?: Date
  }): Promise<ClassSubjectProgress> {
    return this.atomicExecution.execute(async () => {
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const session = await this.repositories.sessions.findById(sessionId)
      if (!session) {
        denyResourceAccess()
      }
      const classGroup = await this.repositories.classGroups.findById(session.classGroupId)
      if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
        denyResourceAccess()
      }
      if (session.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }
      await this.authorizationPolicy.checkSessionAccess(this.actor, [sessionId])
      const existing = await this.repositories.classSubjectProgress.findOne({ classSubjectMatterId, sessionId })
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
        recordedByStaffId: resolveAuditActorId(this.actor),
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

  async listMatterProgress(classSubjectMatterId: string): Promise<ClassSubjectProgress[]> {
    const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
    const classSubject = await this.requireClassSubject(matter.classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorizationPolicy.checkClassGroupAccess(this.actor, [classGroup.id])
    return this.repositories.classSubjectProgress.list({ classSubjectMatterId })
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

  private async requireSubjectMatter(subjectMatterId: string): Promise<SubjectMatter> {
    const subjectMatter = await this.repositories.subjectMatters.findById(subjectMatterId)
    if (!subjectMatter) {
      denyResourceAccess()
    }
    const subject = await this.repositories.subjects.findById(subjectMatter.subjectId)
    if (!subject || subject.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    return subjectMatter
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
    if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
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
    if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async requireClassGroup(classGroupId: string) {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    return classGroup
  }
}

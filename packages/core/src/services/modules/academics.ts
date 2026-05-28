import type { SubjectMatterArgs } from '../../entities/academics/subject-matter'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { ClassSubject } from '../../entities/academics/class-subject'
import { ClassSubjectMatter, ClassSubjectMatterStatus } from '../../entities/academics/class-subject-matter'
import { ClassSubjectProgress } from '../../entities/academics/class-subject-progress'
import { Subject } from '../../entities/academics/subject'
import { SubjectMatter } from '../../entities/academics/subject-matter'
import { roundTo2 } from '../../entities/utils'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'

export class AcademicsService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.repositories = args.repositories
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly actor: ActorMetadata
  private readonly authorizationPolicy: AuthorizationPolicy
  private readonly repositories: SchoolRepositories

  async createSubject({
    id,
    schoolId,
    name,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    createdAt?: Date
  }): Promise<Subject> {
    await this.authorize('academics.manage_curriculum', { schoolId })
    if (!await this.repositories.schools.findById(schoolId)) {
      throw new BusinessRuleViolationError('UNKNOWN_SCHOOL', `Unknown school: ${schoolId}`)
    }
    const subject = new Subject({ id, schoolId, name, createdAt })
    await this.repositories.subjects.save(subject)
    return subject
  }

  async createSubjectMatter(input: SubjectMatterArgs): Promise<SubjectMatter> {
    const subject = await this.repositories.subjects.findById(input.subjectId)
    if (!subject) {
      denyResourceAccess()
    }
    await this.authorize('academics.manage_curriculum', { schoolId: subject.schoolId })
    const subjectMatter = new SubjectMatter(input)
    await this.repositories.subjectMatters.save(subjectMatter)
    return subjectMatter
  }

  async offerSubjectToClass({
    id,
    classGroupId,
    subjectId,
    coefficient,
    createdAt,
  }: {
    id: string
    classGroupId: string
    subjectId: string
    coefficient?: number
    createdAt?: Date
  }): Promise<ClassSubject> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    const subject = await this.repositories.subjects.findById(subjectId)
    if (!subject) {
      denyResourceAccess()
    }
    if (subject.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('academics.manage_curriculum', {
      schoolId: classGroup.schoolId,
      classGroupId,
    })
    const existing = await this.repositories.classSubjects.findByClassAndSubject(classGroupId, subjectId)
    if (existing) {
      return existing
    }
    const classSubject = new ClassSubject({ id, classGroupId, subjectId, coefficient, createdAt })
    await this.repositories.classSubjects.save(classSubject)
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
    await this.authorize('academics.manage_curriculum', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId,
    })
    const existing = await this.repositories.classSubjectMatters.findByClassSubjectAndSubjectMatter(classSubjectId, subjectMatterId)
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
    await this.repositories.classSubjectMatters.save(assigned)
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
      if (session.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }
      const classGroup = await this.requireClassGroup(session.classGroupId)
      await this.authorize('academics.record_progress', {
        schoolId: classGroup.schoolId,
        classGroupId: classGroup.id,
        classSubjectId: classSubject.id,
        sessionId,
      })
      const existing = await this.repositories.classSubjectProgress.findByClassSubjectMatterAndSession(classSubjectMatterId, sessionId)
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

      await this.repositories.classSubjectProgress.save(snapshot)
      await this.repositories.classSubjectMatters.save(updatedMatter)
      await this.updateClassSubjectAggregate(classSubject, updatedMatter)
      return snapshot
    })
  }

  async listMatterProgress(classSubjectMatterId: string): Promise<ClassSubjectProgress[]> {
    const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
    const classSubject = await this.requireClassSubject(matter.classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('academics.read_progress', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
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
    await this.repositories.classSubjects.save(new ClassSubject({
      id: classSubject.id,
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
      coefficient: classSubject.coefficient,
      completedPercentage,
      createdAt: classSubject.createdAt,
    }))
  }

  private async requireSubjectMatter(subjectMatterId: string): Promise<SubjectMatter> {
    const subjectMatter = await this.repositories.subjectMatters.findById(subjectMatterId)
    if (!subjectMatter) {
      denyResourceAccess()
    }
    return subjectMatter
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.repositories.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      denyResourceAccess()
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async requireClassGroup(classGroupId: string) {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async authorize(
    action: 'academics.manage_curriculum' | 'academics.record_progress' | 'academics.read_progress',
    resource: { schoolId: string, classGroupId?: string, classSubjectId?: string, sessionId?: string },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}

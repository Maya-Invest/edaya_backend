import type { SubjectMatterArgs } from '../../entities/academics/subject-matter'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectMatterRepository } from '../../ports/class-subject-matter-repository'
import type { ClassSubjectProgressRepository } from '../../ports/class-subject-progress-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { SubjectMatterRepository } from '../../ports/subject-matter-repository'
import type { SubjectRepository } from '../../ports/subject-repository'
import { ClassSubject } from '../../entities/academics/class-subject'
import { ClassSubjectMatter, ClassSubjectMatterStatus } from '../../entities/academics/class-subject-matter'
import { ClassSubjectProgress } from '../../entities/academics/class-subject-progress'
import { Subject } from '../../entities/academics/subject'
import { SubjectMatter } from '../../entities/academics/subject-matter'
import { roundTo2 } from '../../utils/validation'

export interface AcademicsServiceArgs {
  atomicExecution: AtomicExecutionPort
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  subjectRepository: SubjectRepository
  subjectMatterRepository: SubjectMatterRepository
  classSubjectRepository: ClassSubjectRepository
  classSubjectMatterRepository: ClassSubjectMatterRepository
  classSubjectProgressRepository: ClassSubjectProgressRepository
  sessionRepository: SessionRepository
}

export class AcademicsService {
  constructor(args: AcademicsServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.schools = args.schoolRepository
    this.classGroups = args.classGroupRepository
    this.subjects = args.subjectRepository
    this.subjectMatters = args.subjectMatterRepository
    this.classSubjects = args.classSubjectRepository
    this.classSubjectMatters = args.classSubjectMatterRepository
    this.progress = args.classSubjectProgressRepository
    this.sessions = args.sessionRepository
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly schools: SchoolRepository
  private readonly classGroups: ClassGroupRepository
  private readonly subjects: SubjectRepository
  private readonly subjectMatters: SubjectMatterRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly classSubjectMatters: ClassSubjectMatterRepository
  private readonly progress: ClassSubjectProgressRepository
  private readonly sessions: SessionRepository

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
    if (!await this.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    const subject = new Subject({ id, schoolId, name, createdAt })
    await this.subjects.save(subject)
    return subject
  }

  async createSubjectMatter(input: SubjectMatterArgs): Promise<SubjectMatter> {
    if (!await this.subjects.findById(input.subjectId)) {
      throw new Error(`Unknown subject: ${input.subjectId}`)
    }
    const subjectMatter = new SubjectMatter(input)
    await this.subjectMatters.save(subjectMatter)
    return subjectMatter
  }

  async offerSubjectToClass({
    id,
    classGroupId,
    subjectId,
    staffId,
    coefficient,
    createdAt,
  }: {
    id: string
    classGroupId: string
    subjectId: string
    staffId?: string
    coefficient?: number
    createdAt?: Date
  }): Promise<ClassSubject> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    const subject = await this.subjects.findById(subjectId)
    if (!subject) {
      throw new Error(`Unknown subject: ${subjectId}`)
    }
    if (subject.schoolId !== classGroup.schoolId) {
      throw new Error(`Subject ${subjectId} does not belong to school ${classGroup.schoolId}`)
    }
    const existing = (await this.classSubjects.listByClassGroup(classGroupId))
      .find(classSubject => classSubject.subjectId === subjectId)
    if (existing) {
      return existing
    }
    const classSubject = new ClassSubject({ id, classGroupId, subjectId, staffId, coefficient, createdAt })
    await this.classSubjects.save(classSubject)
    return classSubject
  }

  async assignMatterToClassSubject({
    id,
    classSubjectId,
    subjectMatterId,
    updatedByStaffId,
    notes,
    updatedAt,
  }: {
    id: string
    classSubjectId: string
    subjectMatterId: string
    updatedByStaffId?: string
    notes?: string
    updatedAt?: Date
  }): Promise<ClassSubjectMatter> {
    const classSubject = await this.requireClassSubject(classSubjectId)
    const subjectMatter = await this.requireSubjectMatter(subjectMatterId)
    if (subjectMatter.subjectId !== classSubject.subjectId) {
      throw new Error(`Subject matter ${subjectMatterId} is not valid for class subject ${classSubjectId}`)
    }
    const existing = await this.classSubjectMatters.findByClassSubjectAndSubjectMatter(classSubjectId, subjectMatterId)
    if (existing) {
      return existing
    }
    const assigned = new ClassSubjectMatter({
      id,
      classSubjectId,
      subjectMatterId,
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
      updatedByStaffId,
      notes,
      updatedAt,
    })
    await this.classSubjectMatters.save(assigned)
    return assigned
  }

  async recordSessionProgress({
    id,
    classSubjectMatterId,
    sessionId,
    completedPercentage,
    recordedByStaffId,
    notes,
    recordedAt,
  }: {
    id: string
    classSubjectMatterId: string
    sessionId: string
    completedPercentage: number
    recordedByStaffId?: string
    notes?: string
    recordedAt?: Date
  }): Promise<ClassSubjectProgress> {
    return this.atomicExecution.execute(async () => {
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const session = await this.sessions.findById(sessionId)
      if (!session) {
        throw new Error(`Unknown session: ${sessionId}`)
      }
      if (session.classSubjectId !== classSubject.id) {
        throw new Error(`Session ${sessionId} is not linked to class subject ${classSubject.id}`)
      }
      const existing = await this.progress.findByClassSubjectMatterAndSession(classSubjectMatterId, sessionId)
      if (existing) {
        throw new Error(`Progress has already been recorded for matter ${classSubjectMatterId} and session ${sessionId}`)
      }
      if (completedPercentage < matter.completedPercentage) {
        throw new Error('completedPercentage must not decrease cumulative class subject matter progress')
      }

      const snapshot = new ClassSubjectProgress({
        id,
        classSubjectMatterId,
        sessionId,
        completedPercentage,
        recordedByStaffId,
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

      await this.progress.save(snapshot)
      await this.classSubjectMatters.save(updatedMatter)
      await this.updateClassSubjectAggregate(classSubject, updatedMatter)
      return snapshot
    })
  }

  async listMatterProgress(classSubjectMatterId: string): Promise<ClassSubjectProgress[]> {
    await this.requireClassSubjectMatter(classSubjectMatterId)
    return this.progress.listByClassSubjectMatter(classSubjectMatterId)
  }

  private async updateClassSubjectAggregate(
    classSubject: ClassSubject,
    updatedMatter: ClassSubjectMatter,
  ): Promise<void> {
    const matters = await this.classSubjectMatters.listByClassSubject(classSubject.id)
    const normalizedMatters = matters.map(matter => matter.id === updatedMatter.id ? updatedMatter : matter)
    if (!normalizedMatters.some(matter => matter.id === updatedMatter.id)) {
      normalizedMatters.push(updatedMatter)
    }
    const total = normalizedMatters.reduce((sum, matter) => sum + matter.completedPercentage, 0)
    const completedPercentage = roundTo2(total / normalizedMatters.length)
    await this.classSubjects.save(new ClassSubject({
      id: classSubject.id,
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
      staffId: classSubject.staffId,
      coefficient: classSubject.coefficient,
      completedPercentage,
      createdAt: classSubject.createdAt,
    }))
  }

  private async requireSubjectMatter(subjectMatterId: string): Promise<SubjectMatter> {
    const subjectMatter = await this.subjectMatters.findById(subjectMatterId)
    if (!subjectMatter) {
      throw new Error(`Unknown subject matter: ${subjectMatterId}`)
    }
    return subjectMatter
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      throw new Error(`Unknown class subject matter: ${classSubjectMatterId}`)
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      throw new Error(`Unknown class subject: ${classSubjectId}`)
    }
    return classSubject
  }
}

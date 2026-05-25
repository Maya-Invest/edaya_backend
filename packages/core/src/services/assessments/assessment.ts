import type { AssessmentKind } from '../../entities/assessments/assessment'
import type { Session } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { ClassGroup } from '../../entities/school/class-group'
import type {
  SetupRepositories,
  AcademicsRepositories,
  SchedulingRepositories,
  AssessmentRepositories,
} from '../../ports/school-repositories'
import { Assessment } from '../../entities/assessments/assessment'

export interface AssessmentServiceArgs {
  classGroupRepository: AcademicsRepositories['classGroups']
  classSubjectRepository: AcademicsRepositories['classSubjects']
  academicPeriodRepository: SetupRepositories['academicPeriods']
  sessionRepository: SchedulingRepositories['sessions']
  assessmentRepository: AssessmentRepositories['assessments']
}

export class AssessmentService {
  constructor(args: AssessmentServiceArgs) {
    this.classGroups = args.classGroupRepository
    this.classSubjects = args.classSubjectRepository
    this.academicPeriods = args.academicPeriodRepository
    this.sessions = args.sessionRepository
    this.assessments = args.assessmentRepository
  }

  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly classSubjects: AcademicsRepositories['classSubjects']
  private readonly academicPeriods: SetupRepositories['academicPeriods']
  private readonly sessions: SchedulingRepositories['sessions']
  private readonly assessments: AssessmentRepositories['assessments']

  async createAssessment({
    id,
    classGroupId,
    classSubjectId,
    periodId,
    title,
    kind,
    maxScore,
    sessionId,
    dueAt,
    createdAt,
    coefficient = 1,
  }: {
    id: string
    classGroupId: string
    classSubjectId: string
    periodId: string
    title: string
    kind: AssessmentKind
    maxScore: number
    coefficient?: number
    sessionId?: string
    dueAt?: Date
    createdAt?: Date
  }): Promise<Assessment> {
    const classGroup = await this.requireClassGroup(classGroupId)
    const period = await this.requireAcademicPeriod(periodId)
    if (period.schoolId !== classGroup.schoolId || period.academicYearId !== classGroup.academicYearId) {
      throw new Error(`Academic period ${periodId} is not valid for classGroup ${classGroupId}`)
    }
    const classSubject = await this.classSubjects.findById(classSubjectId)
    if (!classSubject || classSubject.classGroupId !== classGroupId) {
      throw new Error(`Class subject ${classSubjectId} is not valid for classGroup ${classGroupId}`)
    }
    if (sessionId) {
      const session = await this.requireSession(sessionId)
      if (session.classGroupId !== classGroupId) {
        throw new Error(`Session ${sessionId} is not valid for classGroup ${classGroupId}`)
      }
      if (session.classSubjectId && session.classSubjectId !== classSubjectId) {
        throw new Error(`Session ${sessionId} is not linked to class subject ${classSubjectId}`)
      }
    }

    const assessment = new Assessment({
      id,
      classGroupId,
      classSubjectId,
      periodId,
      title,
      kind,
      maxScore,
      coefficient,
      sessionId,
      dueAt,
      createdAt,
    })
    await this.assessments.save(assessment)
    return assessment
  }

  async completeAssessment({
    assessmentId,
    metAt,
  }: {
    assessmentId: string
    metAt?: Date
  }): Promise<Assessment> {
    const existing = await this.requireAssessment(assessmentId)
    const completed = new Assessment({
      id: existing.id,
      classGroupId: existing.classGroupId,
      classSubjectId: existing.classSubjectId,
      periodId: existing.periodId,
      title: existing.title,
      kind: existing.kind,
      maxScore: existing.maxScore,
      coefficient: existing.coefficient,
      examId: existing.examId,
      sessionId: existing.sessionId,
      dueAt: existing.dueAt,
      metAt: metAt ?? new Date(),
      date: existing.date,
      createdAt: existing.createdAt,
    })
    await this.assessments.save(completed)
    return completed
  }

  private async requireAssessment(assessmentId: string): Promise<Assessment> {
    const assessment = await this.assessments.findById(assessmentId)
    if (!assessment) {
      throw new Error(`Unknown assessment: ${assessmentId}`)
    }
    return assessment
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }

  private async requireAcademicPeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.academicPeriods.findById(periodId)
    if (!period) {
      throw new Error(`Unknown academic period: ${periodId}`)
    }
    return period
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.sessions.findById(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    return session
  }
}

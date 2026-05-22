import type { Module } from '$lib/core/entities/academics/module'
import type { AssessmentKind } from '$lib/core/entities/assessments/assessment'
import type { Deadline } from '$lib/core/entities/assessments/deadline'
import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { Classroom } from '$lib/core/entities/core/classroom'
import type { Session } from '$lib/core/entities/scheduling/session'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { DeadlineRepository } from '$lib/core/ports/deadline-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import { Assessment } from '$lib/core/entities/assessments/assessment'

export interface AssessmentServiceArgs {
  classroomRepository: ClassroomRepository
  moduleRepository: ModuleRepository
  academicPeriodRepository: AcademicPeriodRepository
  sessionRepository: SessionRepository
  assessmentRepository: AssessmentRepository
  deadlineRepository: DeadlineRepository
}

export class AssessmentService {
  constructor(args: AssessmentServiceArgs) {
    this.classrooms = args.classroomRepository
    this.modules = args.moduleRepository
    this.academicPeriods = args.academicPeriodRepository
    this.sessions = args.sessionRepository
    this.assessments = args.assessmentRepository
    this.deadlines = args.deadlineRepository
  }

  private readonly classrooms: ClassroomRepository
  private readonly modules: ModuleRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly sessions: SessionRepository
  private readonly assessments: AssessmentRepository
  private readonly deadlines: DeadlineRepository

  async createAssessment({
    id,
    classroomId,
    moduleId,
    periodId,
    title,
    kind,
    maxScore,
    sessionId,
    deadlineId,
    createdAt,
    coefficient = 1,
  }: {
    id: string
    schoolId: string
    classroomId: string
    moduleId: string
    periodId: string
    title: string
    kind: AssessmentKind
    maxScore: number
    coefficient?: number
    sessionId?: string
    deadlineId?: string
    createdAt?: Date
  }): Promise<Assessment> {
    const classroom = await this.requireClassroom(classroomId)
    const module = await this.requireModule(moduleId)
    const period = await this.requireAcademicPeriod(periodId)
    if (module.classroomId !== classroomId) {
      throw new Error(`Module ${moduleId} does not belong to classroom ${classroomId}`)
    }
    if (period.schoolId !== classroom.schoolId || period.academicYearId !== classroom.academicYearId) {
      throw new Error(`Academic period ${periodId} is not valid for classroom ${classroomId}`)
    }
    if (sessionId) {
      const session = await this.requireSession(sessionId)
      if (session.classroomId !== classroomId) {
        throw new Error(`Session ${sessionId} is not valid for classroom ${classroomId}`)
      }
      if (session.moduleId && session.moduleId !== moduleId) {
        throw new Error(`Session ${sessionId} is not linked to module ${moduleId}`)
      }
    }
    if (deadlineId) {
      const deadline = await this.requireDeadline(deadlineId)
      if (deadline.schoolId !== classroom.schoolId) {
        throw new Error(`Deadline ${deadlineId} does not belong to school ${classroom.schoolId}`)
      }
      if (deadline.classroomId && deadline.classroomId !== classroomId) {
        throw new Error(`Deadline ${deadlineId} is not valid for classroom ${classroomId}`)
      }
      if (deadline.moduleId && deadline.moduleId !== moduleId) {
        throw new Error(`Deadline ${deadlineId} is not linked to module ${moduleId}`)
      }
    }

    const assessment = new Assessment({
      id,
      classroomId,
      moduleId,
      periodId,
      title,
      kind,
      maxScore,
      coefficient,
      sessionId,
      deadlineId,
      createdAt,
    })
    await this.assessments.save(assessment)
    return assessment
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }

  private async requireModule(moduleId: string): Promise<Module> {
    const module = await this.modules.findById(moduleId)
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`)
    }
    return module
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

  private async requireDeadline(deadlineId: string): Promise<Deadline> {
    const deadline = await this.deadlines.findById(deadlineId)
    if (!deadline) {
      throw new Error(`Unknown deadline: ${deadlineId}`)
    }
    return deadline
  }
}

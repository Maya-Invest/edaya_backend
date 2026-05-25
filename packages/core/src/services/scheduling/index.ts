import type { SessionKind } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { AuthorizedServiceArgs } from '../authorization'
import { GroupedSession } from '../../entities/scheduling/grouped-session'
import { PeriodDefinition } from '../../entities/scheduling/period-definition'
import { Session } from '../../entities/scheduling/session'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { AttendanceService } from './attendance'
import { ScheduleService } from './schedule'

export interface SchedulingServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
}

export class SchedulingService {
  private readonly schools: SchoolRepositories['setup']['schools']
  private readonly academicYears: SchoolRepositories['setup']['academicYears']
  private readonly academicPeriods: SchoolRepositories['setup']['academicPeriods']
  private readonly groupedSessions: SchoolRepositories['scheduling']['groupedSessions']
  private readonly periodDefinitions: SchoolRepositories['setup']['periodDefinitions']
  private readonly classGroups: SchoolRepositories['academics']['classGroups']
  private readonly classSubjects: SchoolRepositories['academics']['classSubjects']
  private readonly schedules: ScheduleService
  private readonly sessions: SchoolRepositories['scheduling']['sessions']
  private readonly students: SchoolRepositories['students']['students']
  private readonly attendance: AttendanceService
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  constructor(args: SchedulingServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schools = args.repositories.setup.schools
    this.academicYears = args.repositories.setup.academicYears
    this.academicPeriods = args.repositories.setup.academicPeriods
    this.groupedSessions = args.repositories.scheduling.groupedSessions
    this.periodDefinitions = args.repositories.setup.periodDefinitions
    this.classGroups = args.repositories.academics.classGroups
    this.classSubjects = args.repositories.academics.classSubjects
    this.schedules = new ScheduleService({
      atomicExecution: args.atomicExecution,
      classGroupRepository: args.repositories.academics.classGroups,
      scheduleRepository: args.repositories.scheduling.schedules,
      calendarEventRepository: args.repositories.scheduling.calendarEvents,
      sessionRepository: args.repositories.scheduling.sessions,
    })
    this.sessions = args.repositories.scheduling.sessions
    this.students = args.repositories.students.students
    this.attendance = new AttendanceService({
      atomicExecution: args.atomicExecution,
      studentRepository: args.repositories.students.students,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      sessionRepository: args.repositories.scheduling.sessions,
      attendanceRepository: args.repositories.scheduling.attendance,
    })
  }

  async definePeriod({
    id,
    schoolId,
    academicYearId,
    label,
    order,
    startTime,
    endTime,
    isBreak,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    label: string
    order: number
    startTime: string
    endTime: string
    isBreak?: boolean
    createdAt?: Date
  }): Promise<PeriodDefinition> {
    await this.authorize('scheduling.manage', { schoolId, academicYearId })
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const period = new PeriodDefinition({
      id,
      schoolId,
      academicYearId,
      label,
      order,
      startTime,
      endTime,
      isBreak,
      createdAt,
    })
    await this.periodDefinitions.save(period)
    return period
  }

  async createGroupedSession({
    id,
    schoolId,
    academicYearId,
    academicPeriodId,
    title,
    kind,
    startsAt,
    endsAt,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    academicPeriodId?: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    createdAt?: Date
  }): Promise<GroupedSession> {
    await this.authorize('scheduling.manage', { schoolId, academicYearId })
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    if (academicPeriodId) {
      const academicPeriod = await this.requireAcademicPeriod(academicPeriodId)
      if (academicPeriod.schoolId !== schoolId || academicPeriod.academicYearId !== academicYearId) {
        denyResourceAccess()
      }
    }
    const groupedSession = new GroupedSession({
      id,
      schoolId,
      academicYearId,
      academicPeriodId,
      title,
      kind,
      startsAt,
      endsAt,
      createdAt,
    })
    await this.groupedSessions.save(groupedSession)
    return groupedSession
  }

  async createSchedule(input: Parameters<ScheduleService['createSchedule']>[0]) {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('scheduling.manage', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
    })
    await this.requireValidClassSubject(input.classSubjectId ?? undefined, classGroup.id)
    return this.schedules.createSchedule(input)
  }

  async generateSessions(input: Parameters<ScheduleService['generateSessions']>[0]) {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('scheduling.manage', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
    })
    return this.schedules.generateSessions(input)
  }

  async createSession({
    id,
    classGroupId,
    title,
    kind,
    startsAt,
    endsAt,
    classSubjectId,
    createdAt,
  }: {
    id: string
    schoolId: string
    classGroupId: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    classSubjectId?: string
    createdAt?: Date
  }): Promise<Session> {
    const classGroup = await this.requireClassGroup(classGroupId)
    await this.authorize('scheduling.manage', {
      schoolId: classGroup.schoolId,
      classGroupId,
      classSubjectId,
    })
    await this.requireValidClassSubject(classSubjectId, classGroup.id)
    const session = new Session({
      id,
      classGroupId,
      title,
      kind,
      startsAt,
      endsAt,
      classSubjectId,
      createdAt,
    })
    await this.sessions.save(session)
    return session
  }

  async recordAttendance(input: Omit<Parameters<AttendanceService['recordAttendance']>[0], 'createdBy'>) {
    const session = await this.requireSession(input.sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
      studentId: input.studentId,
    })
    await this.requireStudentInSchool(input.studentId, classGroup.schoolId)
    return this.attendance.recordAttendance({ ...input, createdBy: resolveAuditActorId(this.actor) })
  }

  async recordSessionAttendance(input: Omit<Parameters<AttendanceService['recordSessionAttendance']>[0], 'createdBy'>) {
    const session = await this.requireSession(input.sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
    })
    for (const studentId of Object.keys(input.attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
    }
    return this.attendance.recordSessionAttendance({ ...input, createdBy: resolveAuditActorId(this.actor) })
  }

  async buildAttendanceSummary(input: Parameters<AttendanceService['buildAttendanceSummary']>[0]) {
    const student = await this.requireStudent(input.studentId)
    await this.authorize('attendance.read', {
      schoolId: student.schoolId,
      studentId: student.id,
    })
    return this.attendance.buildAttendanceSummary(input)
  }

  async listSessionAttendance(input: Parameters<AttendanceService['listSessionAttendance']>[0]) {
    const session = await this.requireSession(input)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.read', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
    })
    return this.attendance.listSessionAttendance(input)
  }

  private async requireSchool(schoolId: string): Promise<void> {
    if (!await this.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
  }

  private async requireAcademicYear(academicYearId: string): Promise<AcademicYear> {
    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    return academicYear
  }

  private async requireAcademicPeriod(academicPeriodId: string): Promise<AcademicPeriod> {
    const academicPeriod = await this.academicPeriods.findById(academicPeriodId)
    if (!academicPeriod) {
      denyResourceAccess()
    }
    return academicPeriod
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    return session
  }

  private async requireStudent(studentId: string) {
    const student = await this.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireValidClassSubject(classSubjectId: string | undefined, classGroupId: string): Promise<void> {
    if (!classSubjectId) {
      return
    }
    const classSubject = await this.classSubjects.findById(classSubjectId)
    if (!classSubject || classSubject.classGroupId !== classGroupId) {
      denyResourceAccess()
    }
  }

  private async authorize(
    action: 'scheduling.manage' | 'attendance.record' | 'attendance.read',
    resource: {
      schoolId: string
      academicYearId?: string
      classGroupId?: string
      classSubjectId?: string
      sessionId?: string
      studentId?: string
    },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}

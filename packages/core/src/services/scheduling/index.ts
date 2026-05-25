import type { SessionKind } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { AcademicPeriodRepository } from '../../ports/academic-period-repository'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { AttendanceRepository } from '../../ports/attendance-repository'
import type { CalendarEventRepository } from '../../ports/calendar-event-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { GroupedSessionRepository } from '../../ports/grouped-session-repository'
import type { PeriodDefinitionRepository } from '../../ports/period-definition-repository'
import type { ScheduleRepository } from '../../ports/schedule-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import type { AuthorizedServiceArgs } from '../authorization'
import { GroupedSession } from '../../entities/scheduling/grouped-session'
import { PeriodDefinition } from '../../entities/scheduling/period-definition'
import { Session } from '../../entities/scheduling/session'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { AttendanceService } from './attendance'
import { ScheduleService } from './schedule'

export interface SchedulingServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  classGroupRepository: ClassGroupRepository
  classSubjectRepository: ClassSubjectRepository
  groupedSessionRepository: GroupedSessionRepository
  periodDefinitionRepository: PeriodDefinitionRepository
  scheduleRepository: ScheduleRepository
  calendarEventRepository: CalendarEventRepository
  sessionRepository: SessionRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  attendanceRepository: AttendanceRepository
}

export class SchedulingService {
  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly groupedSessions: GroupedSessionRepository
  private readonly periodDefinitions: PeriodDefinitionRepository
  private readonly classGroups: ClassGroupRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly schedules: ScheduleService
  private readonly sessions: SessionRepository
  private readonly students: StudentRepository
  private readonly attendance: AttendanceService
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  constructor(args: SchedulingServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
    this.groupedSessions = args.groupedSessionRepository
    this.periodDefinitions = args.periodDefinitionRepository
    this.classGroups = args.classGroupRepository
    this.classSubjects = args.classSubjectRepository
    this.schedules = new ScheduleService(args)
    this.sessions = args.sessionRepository
    this.students = args.studentRepository
    this.attendance = new AttendanceService(args)
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

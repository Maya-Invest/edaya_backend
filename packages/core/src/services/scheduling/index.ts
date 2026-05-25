import type { SessionKind } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { AcademicPeriodRepository } from '../../ports/academic-period-repository'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { AttendanceRepository } from '../../ports/attendance-repository'
import type { CalendarEventRepository } from '../../ports/calendar-event-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { GroupedSessionRepository } from '../../ports/grouped-session-repository'
import type { PeriodDefinitionRepository } from '../../ports/period-definition-repository'
import type { ScheduleRepository } from '../../ports/schedule-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import { GroupedSession } from '../../entities/scheduling/grouped-session'
import { PeriodDefinition } from '../../entities/scheduling/period-definition'
import { Session } from '../../entities/scheduling/session'
import { AttendanceService } from './attendance'
import { ScheduleService } from './schedule'

export interface SchedulingServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  classGroupRepository: ClassGroupRepository
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
  private readonly schedules: ScheduleService
  private readonly sessions: SessionRepository
  private readonly attendance: AttendanceService

  constructor(args: SchedulingServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
    this.groupedSessions = args.groupedSessionRepository
    this.periodDefinitions = args.periodDefinitionRepository
    this.classGroups = args.classGroupRepository
    this.schedules = new ScheduleService(args)
    this.sessions = args.sessionRepository
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
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} is not valid for school ${schoolId}`)
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
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} is not valid for school ${schoolId}`)
    }
    if (academicPeriodId) {
      const academicPeriod = await this.requireAcademicPeriod(academicPeriodId)
      if (academicPeriod.schoolId !== schoolId || academicPeriod.academicYearId !== academicYearId) {
        throw new Error(`Academic period ${academicPeriodId} is not valid for academic year ${academicYearId}`)
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

  createSchedule(input: Parameters<ScheduleService['createSchedule']>[0]) {
    return this.schedules.createSchedule(input)
  }

  generateSessions(input: Parameters<ScheduleService['generateSessions']>[0]) {
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
    await this.requireClassGroup(classGroupId)
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

  recordAttendance(input: Parameters<AttendanceService['recordAttendance']>[0]) {
    return this.attendance.recordAttendance(input)
  }

  recordSessionAttendance(input: Parameters<AttendanceService['recordSessionAttendance']>[0]) {
    return this.attendance.recordSessionAttendance(input)
  }

  buildAttendanceSummary(input: Parameters<AttendanceService['buildAttendanceSummary']>[0]) {
    return this.attendance.buildAttendanceSummary(input)
  }

  listSessionAttendance(input: Parameters<AttendanceService['listSessionAttendance']>[0]) {
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
      throw new Error(`Unknown academic year: ${academicYearId}`)
    }
    return academicYear
  }

  private async requireAcademicPeriod(academicPeriodId: string): Promise<AcademicPeriod> {
    const academicPeriod = await this.academicPeriods.findById(academicPeriodId)
    if (!academicPeriod) {
      throw new Error(`Unknown academic period: ${academicPeriodId}`)
    }
    return academicPeriod
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }
}

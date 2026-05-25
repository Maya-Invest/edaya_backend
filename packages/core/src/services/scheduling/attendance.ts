import type { Session } from '../../entities/scheduling/session'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type {
  SchedulingRepositories,
  StudentRepositories,
} from '../../ports/school-repositories'
import { AttendanceRecord, AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { normalizeDate } from '../../utils/validation'
import { AttendanceSummary } from '../../value_object/attendance-summary'

export interface AttendanceServiceArgs {
  atomicExecution: AtomicExecutionPort
  studentRepository: StudentRepositories['students']
  StudentClassEnrollmentRepository: StudentRepositories['enrollments']
  sessionRepository: SchedulingRepositories['sessions']
  attendanceRepository: SchedulingRepositories['attendance']
}

export class AttendanceService {
  constructor(args: AttendanceServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.students = args.studentRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.sessions = args.sessionRepository
    this.attendance = args.attendanceRepository
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly students: StudentRepositories['students']
  private readonly enrollments: StudentRepositories['enrollments']
  private readonly sessions: SchedulingRepositories['sessions']
  private readonly attendance: SchedulingRepositories['attendance']

  async recordAttendance({
    id,
    studentId,
    sessionId,
    status,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    sessionId: string
    status: AttendanceStatus
    createdBy?: string
    createdAt?: Date
  }): Promise<AttendanceRecord> {
    await this.requireStudent(studentId)
    const session = await this.requireSession(sessionId)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: session.classGroupId })

    const existing = await this.attendance.findByStudentAndSession(studentId, sessionId)
    const record = new AttendanceRecord({
      id: existing?.id ?? id,
      studentId,
      sessionId,
      date: session.startsAt,
      status,
      createdBy: createdBy ?? existing?.createdBy,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.attendance.save(record)
    return record
  }

  async recordSessionAttendance({
    sessionId,
    attendanceByStudent,
    createdBy,
    createdAt,
  }: {
    sessionId: string
    attendanceByStudent: Record<string, AttendanceStatus>
    createdBy?: string
    createdAt?: Date
  }): Promise<AttendanceRecord[]> {
    return this.atomicExecution.execute(async () => {
      const records: AttendanceRecord[] = []
      for (const [studentId, status] of Object.entries(attendanceByStudent)) {
        records.push(
          await this.recordAttendance({
            id: `${studentId}-${sessionId}`,
            studentId,
            sessionId,
            status,
            createdBy,
            createdAt,
          }),
        )
      }
      return records
    })
  }

  async buildAttendanceSummary({
    studentId,
    startDate,
    endDate,
  }: {
    studentId: string
    startDate: Date
    endDate: Date
  }): Promise<AttendanceSummary> {
    await this.requireStudent(studentId)
    const records = await this.attendance.listByStudentBetween(
      studentId,
      normalizeDate(startDate),
      normalizeDate(endDate),
    )
    let presentCount = 0
    let absenceCount = 0
    let lateCount = 0

    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }

    return new AttendanceSummary({ presentCount, absenceCount, lateCount })
  }

  async listSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    await this.requireSession(sessionId)
    return this.attendance.listBySession(sessionId)
  }

  private async requireStudent(studentId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.sessions.findById(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    return session
  }

  private async requireEnrollmentForClassGroup({
    studentId,
    classGroupId,
  }: {
    studentId: string
    classGroupId: string
  }): Promise<void> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    const enrollment = enrollments.find(e => e.classGroupId === classGroupId)
    if (!enrollment) {
      throw new Error(`Student ${studentId} is not enrolled in classGroup ${classGroupId}`)
    }
  }
}

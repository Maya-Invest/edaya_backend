import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { Student } from '$lib/core/entities/core/student'
import type { AttendanceRecord } from '$lib/core/entities/scheduling/attendance-record'
import type { Session } from '$lib/core/entities/scheduling/session'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { AttendanceRepository } from '$lib/core/ports/attendance-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { AttendanceStatus } from '$lib/core/entities/scheduling/attendance-record'
import { isSameDate } from '$lib/core/utils/validation'

export interface AttendanceReviewServiceArgs {
  academicYearRepository: AcademicYearRepository
  classGroupRepository: ClassGroupRepository
  sessionRepository: SessionRepository
  attendanceRepository: AttendanceRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  studentRepository: StudentRepository
}

export interface AttendanceSessionOption {
  session: Session
  label: string
}

export interface AttendanceReviewRow {
  student: Student
  record?: AttendanceRecord
  status: AttendanceStatus
}

export interface AttendanceReviewSummary {
  present: number
  absent: number
  late: number
  total: number
}

export interface AttendanceReview {
  classGroup?: ClassGroup
  availableSessions: AttendanceSessionOption[]
  selectedSession?: Session
  selectedDate: Date
  rows: AttendanceReviewRow[]
  summary: AttendanceReviewSummary
}

export class AttendanceReviewService {
  constructor(args: AttendanceReviewServiceArgs) {
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
    this.sessions = args.sessionRepository
    this.attendance = args.attendanceRepository
    this.enrollments = args.studentEnrollmentRepository
    this.students = args.studentRepository
  }

  private readonly academicYears: AcademicYearRepository
  private readonly classGroups: ClassGroupRepository
  private readonly sessions: SessionRepository
  private readonly attendance: AttendanceRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly students: StudentRepository

  async getAttendanceSessionReview({
    schoolId,
    date,
    sessionId,
  }: {
    schoolId: string
    date: Date
    sessionId?: string
  }): Promise<AttendanceReview> {
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const classGroups = activeAcademicYear
      ? await this.classGroups.listByAcademicYear(activeAcademicYear.id)
      : []
    const classGroup = classGroups[0]

    if (!classGroup) {
      return {
        classGroup: undefined,
        availableSessions: [],
        selectedSession: undefined,
        selectedDate: date,
        rows: [],
        summary: { present: 0, absent: 0, late: 0, total: 0 },
      }
    }

    const allSessions = await this.sessions.listByClassGroup(classGroup.id)
    const datedSessions = allSessions.filter(session => isSameDate(session.startsAt, date))
    const availableSessions = datedSessions.length > 0 ? datedSessions : allSessions
    const selectedSession
      = (sessionId ? availableSessions.find(candidate => candidate.id === sessionId) : undefined)
        ?? availableSessions[0]
    const sessionOptions = await Promise.all(
      availableSessions.map(async session => ({
        session,
        label: await this.resolveSessionLabel(session),
      })),
    )

    if (!selectedSession) {
      return {
        classGroup,
        availableSessions: sessionOptions,
        selectedSession: undefined,
        selectedDate: date,
        rows: [],
        summary: { present: 0, absent: 0, late: 0, total: 0 },
      }
    }

    const [records, enrollments] = await Promise.all([
      this.attendance.listBySession(selectedSession.id),
      this.enrollments.listByClassGroup(selectedSession.classGroupId),
    ])
    const recordByStudentId = new Map(records.map(record => [record.studentId, record]))
    const rows = (
      await Promise.all(
        enrollments.map(async (enrollment) => {
          const student = await this.students.findById(enrollment.studentId)
          if (!student) {
            return undefined
          }
          const record = recordByStudentId.get(student.id)
          return {
            student,
            record,
            status: record?.status ?? AttendanceStatus.Present,
          }
        }),
      )
    )
    const attendanceRows: AttendanceReviewRow[] = []
    for (const row of rows) {
      if (row) {
        attendanceRows.push(row)
      }
    }

    const summary = attendanceRows.reduce<AttendanceReviewSummary>(
      (acc, row) => {
        if (row.status === AttendanceStatus.Present)
          acc.present += 1
        if (row.status === AttendanceStatus.Absent)
          acc.absent += 1
        if (row.status === AttendanceStatus.Late)
          acc.late += 1
        acc.total += 1
        return acc
      },
      { present: 0, absent: 0, late: 0, total: 0 },
    )

    return {
      classGroup,
      availableSessions: sessionOptions,
      selectedSession,
      selectedDate: date,
      rows: attendanceRows,
      summary,
    }
  }

  private async resolveSessionLabel(session: Session): Promise<string> {
    return session.title
  }

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.listBySchool(schoolId)
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }
}

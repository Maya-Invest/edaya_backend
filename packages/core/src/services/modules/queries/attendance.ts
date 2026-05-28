import type { AttendanceRecord } from '../../../entities/scheduling/attendance-record'
import type { Session } from '../../../entities/scheduling/session'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../../entities/scheduling/attendance-record'
import { AttendanceMode } from '../../../entities/school/class-group'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { isSameDate } from '../../../entities/utils'
import { denyResourceAccess } from '../../authorization'

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
  excusedAbsent: number
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
  constructor(args: ServiceArgs) {
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
    this.attendance = args.repositories.attendance
    this.enrollments = args.repositories.enrollments
    this.students = args.repositories.students
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']
  private readonly attendance: SchoolRepositories['attendance']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly students: SchoolRepositories['students']

  async getAttendanceSessionReview({
    schoolId,
    classGroupId,
    date,
    sessionId,
  }: {
    schoolId: string
    classGroupId: string
    academicYearId?: string
    date: Date
    sessionId?: string
  }): Promise<AttendanceReview> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }

    const allSessions = await this.sessions.list({ classGroupId: classGroup.id })
    const datedSessions = allSessions.filter(session => isSameDate(session.startsAt, date))
    const availableSessions = classGroup.attendanceMode === AttendanceMode.Daily
      ? datedSessions
      : datedSessions.length > 0 ? datedSessions : allSessions
    const selectedSession
      = (sessionId ? availableSessions.find(candidate => candidate.id === sessionId) : undefined)
        ?? availableSessions[0]
    const sessionOptions = await Promise.all(
      availableSessions.map(async session => ({
        session,
        label: await this.resolveSessionLabel(session),
      })),
    )

    if (!selectedSession && classGroup.attendanceMode !== AttendanceMode.Daily) {
      return {
        classGroup,
        availableSessions: sessionOptions,
        selectedSession: undefined,
        selectedDate: date,
        rows: [],
        summary: { present: 0, absent: 0, excusedAbsent: 0, late: 0, total: 0 },
      }
    }

    const [records, enrollments] = await Promise.all([
      selectedSession ? this.attendance.list({ sessionId: selectedSession.id }) : [],
      this.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active }),
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
        if (
          row.status === AttendanceStatus.Absent
          && row.record?.justificationStatus === AttendanceJustificationStatus.Excused
        ) {
          acc.excusedAbsent += 1
        }
        if (row.status === AttendanceStatus.Late)
          acc.late += 1
        acc.total += 1
        return acc
      },
      { present: 0, absent: 0, excusedAbsent: 0, late: 0, total: 0 },
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
}

import type { AttendanceRecord } from '../../entities/scheduling/attendance-record'
import type { Session } from '../../entities/scheduling/session'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { Student } from '../../entities/students/student'
import type {
  AcademicsRepositories,
  SchedulingRepositories,
  SetupRepositories,
  StudentRepositories,
} from '../../ports/school-repositories'
import { AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { isSameDate } from '../../utils/validation'

export interface AttendanceReviewServiceArgs {
  academicYearRepository: SetupRepositories['academicYears']
  classGroupRepository: AcademicsRepositories['classGroups']
  sessionRepository: SchedulingRepositories['sessions']
  attendanceRepository: SchedulingRepositories['attendance']
  StudentClassEnrollmentRepository: StudentRepositories['enrollments']
  studentRepository: StudentRepositories['students']
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
    this.enrollments = args.StudentClassEnrollmentRepository
    this.students = args.studentRepository
  }

  private readonly academicYears: SetupRepositories['academicYears']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly sessions: SchedulingRepositories['sessions']
  private readonly attendance: SchedulingRepositories['attendance']
  private readonly enrollments: StudentRepositories['enrollments']
  private readonly students: StudentRepositories['students']

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

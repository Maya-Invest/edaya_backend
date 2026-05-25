import type { ClassSubject } from '../../entities/academics/class-subject'
import type { Subject } from '../../entities/academics/subject'
import type { Session } from '../../entities/scheduling/session'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { StaffMember } from '../../entities/school/staff-member'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StaffAssignmentRepository } from '../../ports/staff-assignment-repository'
import type { StaffMemberRepository } from '../../ports/staff-member-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { SubjectRepository } from '../../ports/subject-repository'
import { StaffRole } from '../../entities/school/staff-member'

export interface ClassGroupReadServiceArgs {
  academicYearRepository: AcademicYearRepository
  classGroupRepository: ClassGroupRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  classSubjectRepository: ClassSubjectRepository
  staffAssignmentRepository: StaffAssignmentRepository
  staffMemberRepository: StaffMemberRepository
  subjectRepository: SubjectRepository
  sessionRepository: SessionRepository
}

export interface ClassGroupCourseAssignment {
  classSubject: ClassSubject
  subject: Subject
  teacher?: StaffMember
  teacherName: string
}

export interface ClassGroupTimetableEntry {
  session: Session
  courseName: string
  teacherName: string
  roomName: string
}

export interface ClassGroupOverviewRow {
  classGroup: ClassGroup
  studentCount: number
  courseCount: number
  teacherNames: string[]
}

export interface ClassGroupDirectory {
  activeAcademicYear?: AcademicYear
  rows: ClassGroupOverviewRow[]
}

export class ClassGroupReadService {
  constructor(args: ClassGroupReadServiceArgs) {
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.classSubjects = args.classSubjectRepository
    this.staffAssignments = args.staffAssignmentRepository
    this.staffMembers = args.staffMemberRepository
    this.subjects = args.subjectRepository
    this.sessions = args.sessionRepository
  }

  private readonly academicYears: AcademicYearRepository
  private readonly classGroups: ClassGroupRepository
  private readonly enrollments: StudentClassEnrollmentRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly staffAssignments: StaffAssignmentRepository
  private readonly staffMembers: StaffMemberRepository
  private readonly subjects: SubjectRepository
  private readonly sessions: SessionRepository

  async listClassGroups({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<ClassGroupDirectory> {
    const activeAcademicYear = await this.resolveAcademicYear({ schoolId, academicYearId })
    const classGroups = activeAcademicYear
      ? await this.classGroups.listByAcademicYear(activeAcademicYear.id)
      : []
    const rows = await Promise.all(
      classGroups.map(async (classGroup) => {
        const [courseAssignments, enrollments] = await Promise.all([
          this.listClassGroupCourses(classGroup.id),
          this.enrollments.listByClassGroup(classGroup.id),
        ])
        const teacherNames = [...new Set(courseAssignments.map(row => row.teacherName).filter(name => name !== 'Unassigned'))]

        return {
          classGroup,
          studentCount: enrollments.length,
          courseCount: courseAssignments.length,
          teacherNames,
        }
      }),
    )

    return {
      activeAcademicYear,
      rows,
    }
  }

  async listClassGroupCourses(classGroupId: string): Promise<ClassGroupCourseAssignment[]> {
    await this.requireClassGroup(classGroupId)
    const classSubjects = await this.classSubjects.listByClassGroup(classGroupId)
    const rows = await Promise.all(
      classSubjects.map(async (classSubject) => {
        const subject = await this.subjects.findById(classSubject.subjectId)
        if (!subject) {
          return undefined
        }
        const teacher = await this.resolveTeacher(classSubject.id, classSubject.staffId)
        return {
          classSubject,
          subject,
          teacher,
          teacherName: teacher?.fullName ?? 'Unassigned',
        }
      }),
    )
    const courseAssignments: ClassGroupCourseAssignment[] = []
    for (const row of rows) {
      if (row) {
        courseAssignments.push(row)
      }
    }
    return courseAssignments
  }

  async listClassGroupTimetable(classGroupId: string): Promise<ClassGroupTimetableEntry[]> {
    const classGroup = await this.requireClassGroup(classGroupId)
    const [courseAssignments, sessions] = await Promise.all([
      this.listClassGroupCourses(classGroupId),
      this.sessions.listByClassGroup(classGroupId),
    ])
    const courseByClassSubjectId = new Map(courseAssignments.map(row => [row.classSubject.id, row]))

    return sessions.map((session) => {
      const courseAssignment = session.classSubjectId
        ? courseByClassSubjectId.get(session.classSubjectId)
        : undefined
      return {
        session,
        courseName: courseAssignment?.subject.name ?? session.title,
        teacherName: courseAssignment?.teacherName ?? 'Unassigned',
        roomName: classGroup.name,
      }
    })
  }

  private async resolveTeacher(classSubjectId: string, fallbackStaffId?: string): Promise<StaffMember | undefined> {
    const assignments = await this.staffAssignments.listByClassSubject(classSubjectId)
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    const teacherId = teacherAssignment?.staffId ?? fallbackStaffId
    return teacherId ? this.staffMembers.findById(teacherId) : undefined
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }

  private async resolveAcademicYear({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<AcademicYear | undefined> {
    if (!academicYearId) {
      const academicYears = await this.academicYears.listBySchool(schoolId)
      return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
    }

    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    return academicYear
  }
}

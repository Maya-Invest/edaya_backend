import type { AcademicYear } from '$lib/core/entities/academic-year'
import type { Classroom } from '$lib/core/entities/classroom'
import type { Module } from '$lib/core/entities/module'
import type { Session } from '$lib/core/entities/session'
import type { StaffMember } from '$lib/core/entities/staff-member'
import type { Subject } from '$lib/core/entities/subject'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { ModuleStaffAssignmentRepository } from '$lib/core/ports/module-staff-assignment-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { StaffRole } from '$lib/core/entities/staff-member'

export interface ClassroomReadServiceArgs {
  academicYearRepository: AcademicYearRepository
  classroomRepository: ClassroomRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  moduleRepository: ModuleRepository
  moduleStaffAssignmentRepository: ModuleStaffAssignmentRepository
  staffMemberRepository: StaffMemberRepository
  subjectRepository: SubjectRepository
  sessionRepository: SessionRepository
}

export interface ClassroomCourseAssignment {
  module: Module
  subject: Subject
  teacher?: StaffMember
  teacherName: string
}

export interface ClassroomTimetableEntry {
  session: Session
  courseName: string
  teacherName: string
  roomName: string
}

export interface ClassroomOverviewRow {
  classroom: Classroom
  studentCount: number
  courseCount: number
  teacherNames: string[]
}

export interface ClassroomDirectory {
  activeAcademicYear?: AcademicYear
  rows: ClassroomOverviewRow[]
}

export class ClassroomReadService {
  constructor(args: ClassroomReadServiceArgs) {
    this.academicYears = args.academicYearRepository
    this.classrooms = args.classroomRepository
    this.enrollments = args.studentEnrollmentRepository
    this.modules = args.moduleRepository
    this.moduleStaffAssignments = args.moduleStaffAssignmentRepository
    this.staffMembers = args.staffMemberRepository
    this.subjects = args.subjectRepository
    this.sessions = args.sessionRepository
  }

  private readonly academicYears: AcademicYearRepository
  private readonly classrooms: ClassroomRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly modules: ModuleRepository
  private readonly moduleStaffAssignments: ModuleStaffAssignmentRepository
  private readonly staffMembers: StaffMemberRepository
  private readonly subjects: SubjectRepository
  private readonly sessions: SessionRepository

  async listClassrooms({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<ClassroomDirectory> {
    const activeAcademicYear = await this.resolveAcademicYear({ schoolId, academicYearId })
    const classrooms = activeAcademicYear
      ? await this.classrooms.listByAcademicYear(activeAcademicYear.id)
      : []
    const rows = await Promise.all(
      classrooms.map(async (classroom) => {
        const [courseAssignments, enrollments] = await Promise.all([
          this.listClassroomCourses(classroom.id),
          this.enrollments.listByClassroom(classroom.id),
        ])
        const teacherNames = [...new Set(courseAssignments.map(row => row.teacherName).filter(name => name !== 'Unassigned'))]

        return {
          classroom,
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

  async listClassroomCourses(classroomId: string): Promise<ClassroomCourseAssignment[]> {
    await this.requireClassroom(classroomId)
    const modules = (await this.modules.listByClassroom(classroomId)).filter(module => module.subjectId != null)
    const rows = await Promise.all(
      modules.map(async (module) => {
        const subject = module.subjectId ? await this.subjects.findById(module.subjectId) : undefined
        if (!subject) {
          return undefined
        }
        const teacher = await this.resolveTeacher(module.id, module.staffId)
        return {
          module,
          subject,
          teacher,
          teacherName: teacher?.fullName ?? 'Unassigned',
        }
      }),
    )
    const courseAssignments: ClassroomCourseAssignment[] = []
    for (const row of rows) {
      if (row) {
        courseAssignments.push(row)
      }
    }
    return courseAssignments
  }

  async listClassroomTimetable(classroomId: string): Promise<ClassroomTimetableEntry[]> {
    const classroom = await this.requireClassroom(classroomId)
    const [courseAssignments, sessions] = await Promise.all([
      this.listClassroomCourses(classroomId),
      this.sessions.listByClassroom(classroomId),
    ])
    const courseByModuleId = new Map(courseAssignments.map(row => [row.module.id, row]))

    return sessions.map((session) => {
      const courseAssignment = session.moduleId ? courseByModuleId.get(session.moduleId) : undefined
      return {
        session,
        courseName: courseAssignment?.subject.name ?? session.title,
        teacherName: courseAssignment?.teacherName ?? 'Unassigned',
        roomName: classroom.name,
      }
    })
  }

  private async resolveTeacher(moduleId: string, fallbackStaffId?: string): Promise<StaffMember | undefined> {
    const assignments = await this.moduleStaffAssignments.listByModule(moduleId)
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    const teacherId = teacherAssignment?.staffId ?? fallbackStaffId
    return teacherId ? this.staffMembers.findById(teacherId) : undefined
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
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

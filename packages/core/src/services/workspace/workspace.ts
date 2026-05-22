import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { Classroom } from '$lib/core/entities/core/classroom'
import type { School } from '$lib/core/entities/core/school'
import type { StaffMember } from '$lib/core/entities/core/staff-member'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { ModuleStaffAssignmentRepository } from '$lib/core/ports/module-staff-assignment-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import { StaffRole } from '$lib/core/entities/core/staff-member'

export interface WorkspaceServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  classroomRepository: ClassroomRepository
  staffMemberRepository: StaffMemberRepository
  moduleRepository: ModuleRepository
  moduleStaffAssignmentRepository: ModuleStaffAssignmentRepository
}

export interface TeacherCourseLoad {
  teacher: StaffMember
  assignedCourseCount: number
}

export interface WorkspaceContext {
  school: School
  activeAcademicYear?: AcademicYear
  academicPeriods: AcademicPeriod[]
  selectedAcademicPeriod?: AcademicPeriod
  classrooms: Classroom[]
  selectedClassroom?: Classroom
  teacherCourseLoads: TeacherCourseLoad[]
}

export class WorkspaceService {
  constructor(args: WorkspaceServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
    this.classrooms = args.classroomRepository
    this.staffMembers = args.staffMemberRepository
    this.modules = args.moduleRepository
    this.moduleStaffAssignments = args.moduleStaffAssignmentRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly classrooms: ClassroomRepository
  private readonly staffMembers: StaffMemberRepository
  private readonly modules: ModuleRepository
  private readonly moduleStaffAssignments: ModuleStaffAssignmentRepository

  async getWorkspaceContext({
    schoolId,
    classroomId,
  }: {
    schoolId: string
    classroomId?: string
  }): Promise<WorkspaceContext> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const classrooms = activeAcademicYear
      ? await this.classrooms.listByAcademicYear(activeAcademicYear.id)
      : []
    const academicPeriods = activeAcademicYear
      ? await this.academicPeriods.listByAcademicYear(activeAcademicYear.id)
      : []
    const selectedClassroom
      = (classroomId ? classrooms.find(candidate => candidate.id === classroomId) : undefined)
        ?? classrooms[0]
    const selectedAcademicPeriod = academicPeriods[0]
    const staffMembers = await this.staffMembers.listBySchool(schoolId)
    const teacherCourseLoads = await this.buildTeacherCourseLoads({
      classrooms,
      staffMembers,
    })

    return {
      school,
      activeAcademicYear,
      academicPeriods,
      selectedAcademicPeriod,
      classrooms,
      selectedClassroom,
      teacherCourseLoads,
    }
  }

  private async buildTeacherCourseLoads({
    classrooms,
    staffMembers,
  }: {
    classrooms: readonly Classroom[]
    staffMembers: readonly StaffMember[]
  }): Promise<TeacherCourseLoad[]> {
    const teacherIdsToCourseCount = new Map<string, number>()

    for (const classroom of classrooms) {
      const modules = (await this.modules.listByClassroom(classroom.id)).filter(
        module => module.subjectId != null,
      )

      for (const module of modules) {
        const teacherId = await this.resolveTeacherId(module.id, module.staffId)
        if (!teacherId) {
          continue
        }
        teacherIdsToCourseCount.set(teacherId, (teacherIdsToCourseCount.get(teacherId) ?? 0) + 1)
      }
    }

    return staffMembers
      .filter(staffMember => staffMember.hasRole(StaffRole.Teacher))
      .map(teacher => ({
        teacher,
        assignedCourseCount: teacherIdsToCourseCount.get(teacher.id) ?? 0,
      }))
  }

  private async resolveTeacherId(moduleId: string, fallbackStaffId?: string): Promise<string | undefined> {
    const assignments = await this.moduleStaffAssignments.listByModule(moduleId)
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    return teacherAssignment?.staffId ?? fallbackStaffId
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.listBySchool(schoolId)
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }
}

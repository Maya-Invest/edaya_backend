import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { School } from '$lib/core/entities/core/school'
import type { StaffMember } from '$lib/core/entities/core/staff-member'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassSubjectRepository } from '$lib/core/ports/class-subject-repository'
import type { ClassSubjectStaffAssignmentRepository } from '$lib/core/ports/class-subject-staff-assignment-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import { StaffRole } from '$lib/core/entities/core/staff-member'

export interface WorkspaceServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  classGroupRepository: ClassGroupRepository
  staffMemberRepository: StaffMemberRepository
  classSubjectRepository: ClassSubjectRepository
  classSubjectStaffAssignmentRepository: ClassSubjectStaffAssignmentRepository
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
  classGroups: ClassGroup[]
  selectedClassGroup?: ClassGroup
  teacherCourseLoads: TeacherCourseLoad[]
}

export class WorkspaceService {
  constructor(args: WorkspaceServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
    this.classGroups = args.classGroupRepository
    this.staffMembers = args.staffMemberRepository
    this.classSubjects = args.classSubjectRepository
    this.classSubjectStaffAssignments = args.classSubjectStaffAssignmentRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly classGroups: ClassGroupRepository
  private readonly staffMembers: StaffMemberRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly classSubjectStaffAssignments: ClassSubjectStaffAssignmentRepository

  async getWorkspaceContext({
    schoolId,
    classGroupId,
  }: {
    schoolId: string
    classGroupId?: string
  }): Promise<WorkspaceContext> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const classGroups = activeAcademicYear
      ? await this.classGroups.listByAcademicYear(activeAcademicYear.id)
      : []
    const academicPeriods = activeAcademicYear
      ? await this.academicPeriods.listByAcademicYear(activeAcademicYear.id)
      : []
    const selectedClassGroup
      = (classGroupId ? classGroups.find(candidate => candidate.id === classGroupId) : undefined)
        ?? classGroups[0]
    const selectedAcademicPeriod = academicPeriods[0]
    const staffMembers = await this.staffMembers.listBySchool(schoolId)
    const teacherCourseLoads = await this.buildTeacherCourseLoads({
      classGroups,
      staffMembers,
    })

    return {
      school,
      activeAcademicYear,
      academicPeriods,
      selectedAcademicPeriod,
      classGroups,
      selectedClassGroup,
      teacherCourseLoads,
    }
  }

  private async buildTeacherCourseLoads({
    classGroups,
    staffMembers,
  }: {
    classGroups: readonly ClassGroup[]
    staffMembers: readonly StaffMember[]
  }): Promise<TeacherCourseLoad[]> {
    const teacherIdsToCourseCount = new Map<string, number>()

    for (const classGroup of classGroups) {
      const classSubjects = await this.classSubjects.listByClassGroup(classGroup.id)

      for (const classSubject of classSubjects) {
        const teacherId = await this.resolveTeacherId(classSubject.id, classSubject.staffId)
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

  private async resolveTeacherId(classSubjectId: string, fallbackStaffId?: string): Promise<string | undefined> {
    const assignments = await this.classSubjectStaffAssignments.listByClassSubject(classSubjectId)
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

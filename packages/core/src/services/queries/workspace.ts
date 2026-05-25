import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { StaffMember } from '../../entities/school/staff-member'
import type { AcademicsRepositories, SetupRepositories } from '../../ports/school-repositories'
import { StaffRole } from '../../entities/school/staff-member'

export interface WorkspaceServiceArgs {
  schoolRepository: SetupRepositories['schools']
  academicYearRepository: SetupRepositories['academicYears']
  academicPeriodRepository: SetupRepositories['academicPeriods']
  classGroupRepository: AcademicsRepositories['classGroups']
  staffMemberRepository: SetupRepositories['staffMembers']
  classSubjectRepository: AcademicsRepositories['classSubjects']
  staffAssignmentRepository: SetupRepositories['staffAssignments']
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
    this.staffAssignments = args.staffAssignmentRepository
  }

  private readonly schools: SetupRepositories['schools']
  private readonly academicYears: SetupRepositories['academicYears']
  private readonly academicPeriods: SetupRepositories['academicPeriods']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly staffMembers: SetupRepositories['staffMembers']
  private readonly classSubjects: AcademicsRepositories['classSubjects']
  private readonly staffAssignments: SetupRepositories['staffAssignments']

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
    const assignments = await this.staffAssignments.listByClassSubject(classSubjectId)
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

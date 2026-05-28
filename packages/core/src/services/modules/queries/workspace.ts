import type { Subject } from '../../../entities/academics/subject'
import type { AcademicPeriod } from '../../../entities/school/academic-period'
import type { AcademicYear } from '../../../entities/school/academic-year'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { GradeLevel } from '../../../entities/school/grade-level'
import type { GradeScale } from '../../../entities/school/grade-scale'
import type { School } from '../../../entities/school/school'
import type { StaffMember } from '../../../entities/school/staff-member'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { StaffRole } from '../../../entities/school/staff-member'
import { findActiveAcademicYear } from '../../shared/academic-year'
import { requireSchool } from '../../shared/require-school'

export interface TeacherCourseLoad {
  teacher: StaffMember
  assignedCourseCount: number
}

export interface WorkspaceContext {
  school: School
  activeAcademicYear?: AcademicYear
  academicPeriods: AcademicPeriod[]
  selectedAcademicPeriod?: AcademicPeriod
  gradeLevels: GradeLevel[]
  classGroups: ClassGroup[]
  selectedClassGroup?: ClassGroup
  staffMembers: StaffMember[]
  subjects: Subject[]
  gradeScales: GradeScale[]
  teacherCourseLoads: TeacherCourseLoad[]
}

export class WorkspaceService {
  constructor(args: ServiceArgs) {
    this.schools = args.repositories.schools
    this.academicYears = args.repositories.academicYears
    this.academicPeriods = args.repositories.academicPeriods
    this.gradeLevels = args.repositories.gradeLevels
    this.classGroups = args.repositories.classGroups
    this.staffMembers = args.repositories.staffMembers
    this.subjects = args.repositories.subjects
    this.gradeScales = args.repositories.gradeScales
    this.classSubjects = args.repositories.classSubjects
    this.staffAssignments = args.repositories.staffAssignments
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly gradeScales: SchoolRepositories['gradeScales']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']

  async getWorkspaceContext({
    schoolId,
    classGroupId,
  }: {
    schoolId: string
    classGroupId?: string
  }): Promise<WorkspaceContext> {
    const school = await requireSchool(this.schools, schoolId)
    const activeAcademicYear = await findActiveAcademicYear(this.academicYears, schoolId)
    const [classGroups, academicPeriods, gradeLevels, staffMembers, subjects, gradeScales] = await Promise.all([
      activeAcademicYear ? this.classGroups.list({ academicYearId: activeAcademicYear.id }) : [],
      activeAcademicYear ? this.academicPeriods.list({ academicYearId: activeAcademicYear.id }) : [],
      this.gradeLevels.list({ schoolId }),
      this.staffMembers.list({ schoolId }),
      this.subjects.list({ schoolId }),
      this.gradeScales.list({ schoolId }),
    ])
    classGroups.sort((left, right) => left.name.localeCompare(right.name))
    academicPeriods.sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
    gradeLevels.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    staffMembers.sort((left, right) => left.fullName.localeCompare(right.fullName))
    subjects.sort((left, right) => left.name.localeCompare(right.name))
    gradeScales.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name))
    const selectedClassGroup
      = (classGroupId ? classGroups.find(candidate => candidate.id === classGroupId) : undefined)
        ?? classGroups[0]
    const selectedAcademicPeriod = academicPeriods[0]
    const teacherCourseLoads = await this.buildTeacherCourseLoads({ classGroups, staffMembers })

    return {
      school,
      activeAcademicYear,
      academicPeriods,
      selectedAcademicPeriod,
      gradeLevels,
      classGroups,
      selectedClassGroup,
      staffMembers,
      subjects,
      gradeScales,
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
      const classSubjects = await this.classSubjects.list({ classGroupId: classGroup.id })
      for (const classSubject of classSubjects) {
        const teacherId = await this.resolveTeacherId(classSubject.id)
        if (!teacherId)
          continue
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

  private async resolveTeacherId(classSubjectId: string): Promise<string | undefined> {
    const assignments = await this.staffAssignments.list({ classSubjectId })
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    return teacherAssignment?.staffId
  }
}

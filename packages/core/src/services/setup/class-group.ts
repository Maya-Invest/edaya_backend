import type { AcademicYear } from '../../entities/school/academic-year'
import type { GradeLevel } from '../../entities/school/grade-level'
import type { School } from '../../entities/school/school'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { ClassGroup } from '../../entities/school/class-group'

export interface ClassGroupServiceArgs {
  schoolRepository: SchoolRepositories['schools']
  academicYearRepository: SchoolRepositories['academicYears']
  gradeLevelRepository: SchoolRepositories['gradeLevels']
  classGroupRepository: SchoolRepositories['classGroups']
}

export class ClassGroupService {
  constructor(args: ClassGroupServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.gradeLevels = args.gradeLevelRepository
    this.classGroups = args.classGroupRepository
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly classGroups: SchoolRepositories['classGroups']

  async createClassGroup({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    gradeLevelId: string
    name: string
    createdAt?: Date
  }): Promise<ClassGroup> {
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    const gradeLevel = await this.requireGradeLevel(gradeLevelId)
    if (gradeLevel.schoolId !== schoolId) {
      throw new Error(`Grade level ${gradeLevelId} does not belong to school ${schoolId}`)
    }
    const classGroup = new ClassGroup({
      id,
      schoolId,
      academicYearId,
      gradeLevelId,
      name,
      createdAt,
    })
    await this.classGroups.save(classGroup)
    return classGroup
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async requireAcademicYear(academicYearId: string): Promise<AcademicYear> {
    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear) {
      throw new Error(`Unknown academic year: ${academicYearId}`)
    }
    return academicYear
  }

  private async requireGradeLevel(gradeLevelId: string): Promise<GradeLevel> {
    const gradeLevel = await this.gradeLevels.findById(gradeLevelId)
    if (!gradeLevel) {
      throw new Error(`Unknown grade level: ${gradeLevelId}`)
    }
    return gradeLevel
  }
}

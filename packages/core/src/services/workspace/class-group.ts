import type { AcademicYear } from '$lib/core/entities/school/academic-year'
import type { School } from '$lib/core/entities/school/school'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import { ClassGroup } from '$lib/core/entities/school/class-group'

export interface ClassGroupServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classGroupRepository: ClassGroupRepository
}

export class ClassGroupService {
  constructor(args: ClassGroupServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classGroups: ClassGroupRepository

  async createClassGroup({
    id,
    schoolId,
    academicYearId,
    name,
    level,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    name: string
    level?: string
    createdAt?: Date
  }): Promise<ClassGroup> {
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    const classGroup = new ClassGroup({
      id,
      schoolId,
      academicYearId,
      gradeLevelId: level ?? 'unknown',
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
}

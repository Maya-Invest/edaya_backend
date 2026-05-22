import type { AcademicYear } from '$lib/core/entities/academic-year'
import type { School } from '$lib/core/entities/school'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import { Classroom } from '$lib/core/entities/classroom'

export interface ClassroomServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classroomRepository: ClassroomRepository
}

export class ClassroomService {
  constructor(args: ClassroomServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.classrooms = args.classroomRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classrooms: ClassroomRepository

  async createClassroom({
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
  }): Promise<Classroom> {
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    const classroom = new Classroom({
      id,
      schoolId,
      academicYearId,
      gradeLevelId: level ?? 'unknown',
      name,
      createdAt,
    })
    await this.classrooms.save(classroom)
    return classroom
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

import type { AcademicPeriodType } from '$lib/core/entities/school/academic-period'
import type { School } from '$lib/core/entities/school/school'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import { AcademicPeriod } from '$lib/core/entities/school/academic-period'
import { AcademicYear } from '$lib/core/entities/school/academic-year'

export interface AcademicCalendarServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
}

export class AcademicCalendarService {
  constructor(args: AcademicCalendarServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly academicPeriods: AcademicPeriodRepository

  async createAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    isActive = true,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    startDate: Date
    endDate: Date
    isActive?: boolean
    createdAt?: Date
  }): Promise<AcademicYear> {
    await this.requireSchool(schoolId)
    const academicYear = new AcademicYear({
      id,
      schoolId,
      name,
      startDate,
      endDate,
      isActive,
      createdAt,
    })
    await this.academicYears.save(academicYear)
    return academicYear
  }

  async createAcademicPeriod({
    id,
    schoolId,
    academicYearId,
    name,
    type,
    startDate,
    endDate,
    isPublished = false,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    name: string
    type: AcademicPeriodType
    startDate: Date
    endDate: Date
    isPublished?: boolean
    createdAt?: Date
  }): Promise<AcademicPeriod> {
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    if (
      startDate.getTime() < academicYear.startDate.getTime()
      || endDate.getTime() > academicYear.endDate.getTime()
    ) {
      throw new Error(`Academic period ${id} must fit within academic year ${academicYearId}`)
    }

    const period = new AcademicPeriod({
      id,
      schoolId,
      academicYearId,
      name,
      type,
      startDate,
      endDate,
      isPublished,
      createdAt,
    })
    await this.academicPeriods.save(period)
    return period
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

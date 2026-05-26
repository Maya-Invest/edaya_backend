import type { AcademicPeriodType } from '../../entities/school/academic-period'
import type { School } from '../../entities/school/school'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AcademicPeriod } from '../../entities/school/academic-period'
import { AcademicYear } from '../../entities/school/academic-year'

export interface AcademicCalendarServiceArgs {
  schoolRepository: SchoolRepositories['schools']
  academicYearRepository: SchoolRepositories['academicYears']
  academicPeriodRepository: SchoolRepositories['academicPeriods']
}

export class AcademicCalendarService {
  constructor(args: AcademicCalendarServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.academicPeriods = args.academicPeriodRepository
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']

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

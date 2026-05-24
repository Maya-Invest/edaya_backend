import type { Announcement } from '$lib/core/entities/messaging/announcement'
import type { AcademicYear } from '$lib/core/entities/school/academic-year'
import type { School } from '$lib/core/entities/school/school'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ReportCardResultRepository } from '$lib/core/ports/report-card-result-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentFeeRepository } from '$lib/core/ports/student-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { ReportCardResultStatus } from '$lib/core/entities/assessments/report-card-result'
import { FeeStatus } from '$lib/core/entities/finances/student-fee'

export interface SchoolOverviewServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  announcementRepository: AnnouncementRepository
  studentFeeRepository: StudentFeeRepository
  reportCardResultRepository: ReportCardResultRepository
}

export interface SchoolOverview {
  school: School
  activeAcademicYear?: AcademicYear
  classCount: number
  studentCount: number
  overdueFeeCount: number
  publishedReportCardCount: number
  recentAnnouncements: Announcement[]
}

export class SchoolOverviewService {
  constructor(args: SchoolOverviewServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.announcements = args.announcementRepository
    this.fees = args.studentFeeRepository
    this.reportCardResults = args.reportCardResultRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classGroups: ClassGroupRepository
  private readonly students: StudentRepository
  private readonly announcements: AnnouncementRepository
  private readonly fees: StudentFeeRepository
  private readonly reportCardResults: ReportCardResultRepository

  async getSchoolOverview({ schoolId }: { schoolId: string }): Promise<SchoolOverview> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const [classGroups, students, announcements] = await Promise.all([
      activeAcademicYear ? this.classGroups.listByAcademicYear(activeAcademicYear.id) : [],
      this.students.listBySchool(schoolId),
      this.announcements.listBySchool(schoolId),
    ])

    let overdueFeeCount = 0
    let publishedReportCardCount = 0

    for (const student of students) {
      const [fees, reportCardResults] = await Promise.all([
        this.fees.listByStudent(student.id),
        this.reportCardResults.listByStudent(student.id),
      ])
      overdueFeeCount += fees.filter(fee => fee.status === FeeStatus.Overdue).length
      publishedReportCardCount += reportCardResults.filter(
        reportCardResult => reportCardResult.status === ReportCardResultStatus.Published,
      ).length
    }

    return {
      school,
      activeAcademicYear,
      classCount: classGroups.length,
      studentCount: students.length,
      overdueFeeCount,
      publishedReportCardCount,
      recentAnnouncements: announcements
        .slice()
        .sort((left, right) => {
          const leftDate = left.publishedAt ?? left.createdAt
          const rightDate = right.publishedAt ?? right.createdAt
          return rightDate.getTime() - leftDate.getTime()
        })
        .slice(0, 4),
    }
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

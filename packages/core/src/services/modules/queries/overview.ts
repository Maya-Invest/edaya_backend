import type { Announcement } from '../../../entities/messaging/announcement'
import type { AcademicYear } from '../../../entities/school/academic-year'
import type { School } from '../../../entities/school/school'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { ReportCardResultStatus } from '../../../entities/assessments/report-card-result'
import { FeeStatus } from '../../../entities/finances/student-fee'
import { requireSchool } from '../../shared/require-school'

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
  constructor(args: ServiceArgs) {
    this.schools = args.repositories.schools
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.students = args.repositories.students
    this.announcements = args.repositories.announcements
    this.fees = args.repositories.studentFees
    this.reportCardResults = args.repositories.results
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly students: SchoolRepositories['students']
  private readonly announcements: SchoolRepositories['announcements']
  private readonly fees: SchoolRepositories['studentFees']
  private readonly reportCardResults: SchoolRepositories['results']

  async getSchoolOverview({ schoolId }: { schoolId: string }): Promise<SchoolOverview> {
    const school = await requireSchool(this.schools, schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const [classGroups, students, announcements] = await Promise.all([
      activeAcademicYear ? this.classGroups.list({ academicYearId: activeAcademicYear.id }) : [],
      this.students.list({ schoolId }),
      this.announcements.list({ schoolId }),
    ])

    let overdueFeeCount = 0
    let publishedReportCardCount = 0

    for (const student of students) {
      const [fees, reportCardResults] = await Promise.all([
        this.fees.list({ studentId: student.id }),
        this.reportCardResults.list({ studentId: student.id }),
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

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.list({ schoolId })
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }
}

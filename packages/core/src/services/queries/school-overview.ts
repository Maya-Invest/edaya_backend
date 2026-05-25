import type { Announcement } from '../../entities/messaging/announcement'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { School } from '../../entities/school/school'
import type {
  AcademicsRepositories,
  AssessmentRepositories,
  CommunicationRepositories,
  FinanceRepositories,
  SetupRepositories,
  StudentRepositories,
} from '../../ports/school-repositories'
import { ReportCardResultStatus } from '../../entities/assessments/report-card-result'
import { FeeStatus } from '../../entities/finances/student-fee'

export interface SchoolOverviewServiceArgs {
  schoolRepository: SetupRepositories['schools']
  academicYearRepository: SetupRepositories['academicYears']
  classGroupRepository: AcademicsRepositories['classGroups']
  studentRepository: StudentRepositories['students']
  announcementRepository: CommunicationRepositories['announcements']
  studentFeeRepository: FinanceRepositories['studentFees']
  reportCardResultRepository: AssessmentRepositories['results']
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

  private readonly schools: SetupRepositories['schools']
  private readonly academicYears: SetupRepositories['academicYears']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly students: StudentRepositories['students']
  private readonly announcements: CommunicationRepositories['announcements']
  private readonly fees: FinanceRepositories['studentFees']
  private readonly reportCardResults: AssessmentRepositories['results']

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

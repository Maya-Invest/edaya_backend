import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { Announcement } from '$lib/core/entities/core/announcement'
import type { School } from '$lib/core/entities/core/school'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ReportCardRepository } from '$lib/core/ports/report-card-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentFeeRepository } from '$lib/core/ports/student-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { ReportCardStatus } from '$lib/core/entities/assessments/report-card'
import { FeeStatus } from '$lib/core/entities/finance/student-fee'

export interface SchoolOverviewServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classroomRepository: ClassroomRepository
  studentRepository: StudentRepository
  announcementRepository: AnnouncementRepository
  studentFeeRepository: StudentFeeRepository
  reportCardRepository: ReportCardRepository
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
    this.classrooms = args.classroomRepository
    this.students = args.studentRepository
    this.announcements = args.announcementRepository
    this.fees = args.studentFeeRepository
    this.reportCards = args.reportCardRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classrooms: ClassroomRepository
  private readonly students: StudentRepository
  private readonly announcements: AnnouncementRepository
  private readonly fees: StudentFeeRepository
  private readonly reportCards: ReportCardRepository

  async getSchoolOverview({ schoolId }: { schoolId: string }): Promise<SchoolOverview> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const [classrooms, students, announcements] = await Promise.all([
      activeAcademicYear ? this.classrooms.listByAcademicYear(activeAcademicYear.id) : [],
      this.students.listBySchool(schoolId),
      this.announcements.listBySchool(schoolId),
    ])

    let overdueFeeCount = 0
    let publishedReportCardCount = 0

    for (const student of students) {
      const [fees, reportCards] = await Promise.all([
        this.fees.listByStudent(student.id),
        this.reportCards.listByStudent(student.id),
      ])
      overdueFeeCount += fees.filter(fee => fee.status === FeeStatus.Overdue).length
      publishedReportCardCount += reportCards.filter(
        reportCard => reportCard.status === ReportCardStatus.Published,
      ).length
    }

    return {
      school,
      activeAcademicYear,
      classCount: classrooms.length,
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

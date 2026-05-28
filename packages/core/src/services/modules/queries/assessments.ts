import type { ClassSubject } from '../../../entities/academics/class-subject'
import type { Subject } from '../../../entities/academics/subject'
import type { Assessment } from '../../../entities/assessments/assessment'
import type { AssessmentResult } from '../../../entities/assessments/assessment-result'
import type { ReportCardDefinition } from '../../../entities/assessments/report-card-definition'
import type { ReportCardResult } from '../../../entities/assessments/report-card-result'
import type { AcademicPeriod } from '../../../entities/school/academic-period'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { ReportCardResultStatus } from '../../../entities/assessments/report-card-result'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { denyResourceAccess } from '../../authorization'

export interface ReportCardDetailAssessmentResult {
  assessment: Assessment
  result: AssessmentResult
}

export interface ReportCardDetail {
  reportCard: ReportCardResult
  student: Student
  classGroup: ClassGroup
  period: AcademicPeriod
  definition: ReportCardDefinition
  assessmentResults: ReportCardDetailAssessmentResult[]
}

export interface AssessmentEntryReviewRow {
  student: Student
  result?: AssessmentResult
  isLockedByPublishedReportCard: boolean
}

export interface AssessmentEntryReview {
  assessment: Assessment
  classGroup: ClassGroup
  classSubject: ClassSubject
  subject: Subject
  period: AcademicPeriod
  rows: AssessmentEntryReviewRow[]
}

export class ReportCardDetailService {
  constructor(args: ServiceArgs) {
    this.students = args.repositories.students
    this.classGroups = args.repositories.classGroups
    this.academicPeriods = args.repositories.academicPeriods
    this.definitions = args.repositories.definitions
    this.reportCardResults = args.repositories.results
    this.assessments = args.repositories.assessments
    this.assessmentResults = args.repositories.assessmentResults
  }

  private readonly students: SchoolRepositories['students']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly definitions: SchoolRepositories['definitions']
  private readonly reportCardResults: SchoolRepositories['results']
  private readonly assessments: SchoolRepositories['assessments']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']

  async getReportCardDetail({
    schoolId,
    reportCardResultId,
  }: {
    schoolId: string
    reportCardResultId: string
  }): Promise<ReportCardDetail> {
    const reportCard = await this.reportCardResults.findById(reportCardResultId)
    if (!reportCard) {
      denyResourceAccess()
    }
    const [student, classGroup, period, definition] = await Promise.all([
      this.students.findById(reportCard.studentId),
      this.classGroups.findById(reportCard.classGroupId),
      this.academicPeriods.findById(reportCard.periodId),
      this.definitions.findById(reportCard.reportCardDefinitionId),
    ])
    if (
      !student
      || !classGroup
      || !period
      || !definition
      || student.schoolId !== schoolId
      || classGroup.schoolId !== schoolId
      || period.schoolId !== schoolId
      || definition.schoolId !== schoolId
      || classGroup.academicYearId !== period.academicYearId
      || definition.academicYearId !== period.academicYearId
    ) {
      denyResourceAccess()
    }
    const results = await this.assessmentResults.list({ studentId: student.id })
    const assessmentResults: ReportCardDetailAssessmentResult[] = []
    for (const result of results) {
      const assessment = await this.assessments.findById(result.assessmentId)
      if (assessment?.periodId === period.id && assessment.classGroupId === classGroup.id) {
        assessmentResults.push({ assessment, result })
      }
    }
    assessmentResults.sort((left, right) =>
      left.assessment.createdAt.getTime() - right.assessment.createdAt.getTime()
      || left.assessment.id.localeCompare(right.assessment.id))
    return { reportCard, student, classGroup, period, definition, assessmentResults }
  }
}

export class AssessmentEntryReviewService {
  constructor(args: ServiceArgs) {
    this.assessments = args.repositories.assessments
    this.assessmentResults = args.repositories.assessmentResults
    this.classGroups = args.repositories.classGroups
    this.classSubjects = args.repositories.classSubjects
    this.subjects = args.repositories.subjects
    this.academicPeriods = args.repositories.academicPeriods
    this.enrollments = args.repositories.enrollments
    this.students = args.repositories.students
    this.reportCardResults = args.repositories.results
  }

  private readonly assessments: SchoolRepositories['assessments']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly students: SchoolRepositories['students']
  private readonly reportCardResults: SchoolRepositories['results']

  async getAssessmentEntryReview({
    schoolId,
    assessmentId,
  }: {
    schoolId: string
    assessmentId: string
  }): Promise<AssessmentEntryReview> {
    const assessment = await this.assessments.findById(assessmentId)
    if (!assessment) {
      denyResourceAccess()
    }
    const [classGroup, classSubject, period] = await Promise.all([
      this.classGroups.findById(assessment.classGroupId),
      this.classSubjects.findById(assessment.classSubjectId),
      this.academicPeriods.findById(assessment.periodId),
    ])
    const subject = classSubject ? await this.subjects.findById(classSubject.subjectId) : undefined
    if (
      !classGroup
      || !classSubject
      || !subject
      || !period
      || classGroup.schoolId !== schoolId
      || subject.schoolId !== schoolId
      || period.schoolId !== schoolId
      || classSubject.classGroupId !== classGroup.id
      || period.academicYearId !== classGroup.academicYearId
    ) {
      denyResourceAccess()
    }
    const enrollments = await this.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    const rows: AssessmentEntryReviewRow[] = []
    for (const enrollment of enrollments) {
      const student = await this.students.findById(enrollment.studentId)
      if (!student || student.schoolId !== schoolId) {
        denyResourceAccess()
      }
      const [results, reportCard] = await Promise.all([
        this.assessmentResults.list({ assessmentId: assessment.id, studentId: student.id }),
        this.reportCardResults.findByStudentAndPeriod(student.id, period.id),
      ])
      rows.push({
        student,
        result: results[0],
        isLockedByPublishedReportCard: reportCard?.status === ReportCardResultStatus.Published,
      })
    }
    rows.sort((left, right) =>
      left.student.lastName.localeCompare(right.student.lastName)
      || left.student.firstName.localeCompare(right.student.firstName)
      || left.student.id.localeCompare(right.student.id))
    return { assessment, classGroup, classSubject, subject, period, rows }
  }
}

import type { OverviewRepositories } from '@edaya/authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import {
  AttendanceJustificationStatus,
  AttendanceStatus,
  FeeStatus,
  IncidentKind,
  IncidentStatus,
  PaymentStatus,
  ReportCardResultStatus,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryActionStatus,
} from '@edaya/core'

export interface GetSchoolOverviewInput {
  schoolId: string
  academicYearId: string
  academicPeriodId: string
  referenceDate?: Date
}

export type DashboardActionKey
  = | 'overdue_fees'
    | 'unpublished_report_cards'
    | 'pending_justifications'
    | 'high_severity_incidents'
    | 'incomplete_grading'

export interface DashboardActionItem {
  key: DashboardActionKey
  count: number
  amount?: number
}

export type DashboardUpcomingKind
  = | 'calendar'
    | 'fee_due'
    | 'report_card_deadline'
    | 'exam'
    | 'holiday'

export interface DashboardUpcomingItem {
  id: string
  date: string
  title: string
  kind: DashboardUpcomingKind
  highlight: boolean
}

export type DashboardClassRiskLevel = 'normal' | 'watch' | 'needs_action'

export interface DashboardClassRiskRow {
  classGroupId: string
  className: string
  coordinatorName: string | null
  attendanceRateToday: number | null
  openIncidentCount: number
  gradingCompletionPercent: number | null
  overdueFeeCount: number
  riskLevel: DashboardClassRiskLevel
}

export interface DashboardAreaHealthStudents {
  attendanceRateToday: number | null
  absencesToday: number
  pendingJustifications: number
}

export interface DashboardAreaHealthAcademics {
  gradingCompletionPercent: number | null
  publishedReportCards: number
  totalReportCards: number
  incompleteGradingClassCount: number
}

export interface DashboardAreaHealthFinance {
  overdueAmount: number
  studentsWithBalance: number
  recentPaymentCount: number
  recentPaymentAmount: number
}

export interface DashboardAreaHealthSchoolLife {
  openIncidentCount: number
  highSeverityIncidentCount: number
  activeActivityCount: number
  unresolvedDisciplineCount: number
}

export interface DashboardAreaHealth {
  students: DashboardAreaHealthStudents
  academics: DashboardAreaHealthAcademics
  finance: DashboardAreaHealthFinance
  schoolLife: DashboardAreaHealthSchoolLife
}

export interface SchoolOverviewKpis {
  studentCount: number
  staffCount: number
  overdueFeeCount: number
  overdueFeeAmount: number
  publishedReportCardCount: number
  unpublishedReportCardCount: number
  attendanceRateToday: number | null
  absencesToday: number
  openIncidentCount: number
  highSeverityIncidentCount: number
  pendingJustificationCount: number
  incompleteGradingClassCount: number
}

export interface SchoolOverview {
  schoolId: string
  academicYearId: string
  academicPeriodId: string
  referenceDate: string
  generatedAt: string
  kpis: SchoolOverviewKpis
  actionItems: DashboardActionItem[]
  upcoming: DashboardUpcomingItem[]
  areaHealth: DashboardAreaHealth
  classRiskRows: DashboardClassRiskRow[]
}

const HIGH_SEVERITY_INCIDENT_KINDS = new Set<IncidentKind>([
  IncidentKind.MajorInfraction,
  IncidentKind.Emergency,
])

const BALANCE_FEE_STATUSES = new Set<FeeStatus>([
  FeeStatus.Pending,
  FeeStatus.Partial,
  FeeStatus.Overdue,
])

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isSameDay(left: Date, right: Date): boolean {
  return toDateKey(left) === toDateKey(right)
}

function roundRate(value: number): number {
  return Math.round(value * 10) / 10
}

function staffDisplayName(staff: { firstName: string, lastName: string }): string {
  return `${staff.firstName} ${staff.lastName}`.trim()
}

function computeGradingCompletionPercent(
  assessments: Array<{ id: string, classGroupId: string }>,
  resultsByAssessment: Map<string, number>,
  enrollmentsByClass: Map<string, number>,
): number | null {
  let expectedTotal = 0
  let gradedTotal = 0

  for (const assessment of assessments) {
    const expected = enrollmentsByClass.get(assessment.classGroupId) ?? 0
    if (expected <= 0) {
      continue
    }
    expectedTotal += expected
    gradedTotal += Math.min(resultsByAssessment.get(assessment.id) ?? 0, expected)
  }

  if (expectedTotal <= 0) {
    return null
  }

  return roundRate((gradedTotal / expectedTotal) * 100)
}

function computeClassGradingCompletionPercent(
  classGroupId: string,
  assessments: Array<{ id: string, classGroupId: string }>,
  resultsByAssessment: Map<string, number>,
  enrollmentsByClass: Map<string, number>,
): number | null {
  return computeGradingCompletionPercent(
    assessments.filter(assessment => assessment.classGroupId === classGroupId),
    resultsByAssessment,
    enrollmentsByClass,
  )
}

function computeClassRiskLevel(args: {
  attendanceRateToday: number | null
  openIncidentCount: number
  highSeverityIncidentCount: number
  gradingCompletionPercent: number | null
  overdueFeeCount: number
}): DashboardClassRiskLevel {
  if (
    args.highSeverityIncidentCount > 0
    || (args.attendanceRateToday !== null && args.attendanceRateToday < 75)
    || (args.gradingCompletionPercent !== null && args.gradingCompletionPercent < 60)
    || args.overdueFeeCount >= 3
  ) {
    return 'needs_action'
  }

  if (
    args.openIncidentCount > 0
    || (args.attendanceRateToday !== null && args.attendanceRateToday < 90)
    || (args.gradingCompletionPercent !== null && args.gradingCompletionPercent < 85)
    || args.overdueFeeCount > 0
  ) {
    return 'watch'
  }

  return 'normal'
}

function buildActionItems(kpis: SchoolOverviewKpis): DashboardActionItem[] {
  const candidates: DashboardActionItem[] = []

  if (kpis.overdueFeeCount > 0) {
    candidates.push({
      key: 'overdue_fees',
      count: kpis.overdueFeeCount,
      amount: kpis.overdueFeeAmount,
    })
  }
  if (kpis.unpublishedReportCardCount > 0) {
    candidates.push({
      key: 'unpublished_report_cards',
      count: kpis.unpublishedReportCardCount,
    })
  }
  if (kpis.pendingJustificationCount > 0) {
    candidates.push({
      key: 'pending_justifications',
      count: kpis.pendingJustificationCount,
    })
  }
  if (kpis.highSeverityIncidentCount > 0) {
    candidates.push({
      key: 'high_severity_incidents',
      count: kpis.highSeverityIncidentCount,
    })
  }
  if (kpis.incompleteGradingClassCount > 0) {
    candidates.push({
      key: 'incomplete_grading',
      count: kpis.incompleteGradingClassCount,
    })
  }

  return candidates.slice(0, 5)
}

function buildUpcoming(args: {
  calendarEvents: Awaited<ReturnType<SchoolRepositories['calendarEvents']['list']>>
  schoolFees: Awaited<ReturnType<SchoolRepositories['studentFees']['list']>>
  periodAssessments: Awaited<ReturnType<SchoolRepositories['assessments']['list']>>
  academicPeriod: Awaited<ReturnType<SchoolRepositories['academicPeriods']['findById']>>
  refKey: string
  weekEndKey: string
}): DashboardUpcomingItem[] {
  const items: DashboardUpcomingItem[] = []

  for (const event of args.calendarEvents) {
    const startKey = toDateKey(event.startDate)
    if (startKey < args.refKey || startKey > args.weekEndKey) {
      continue
    }
    items.push({
      id: event.id,
      date: startKey,
      title: event.title,
      kind: event.isNonSchoolDay ? 'holiday' : 'calendar',
      highlight: event.isNonSchoolDay,
    })
  }

  for (const fee of args.schoolFees) {
    if (!fee.dueDate || fee.status === FeeStatus.Cancelled || fee.status === FeeStatus.Paid) {
      continue
    }
    const dueKey = toDateKey(fee.dueDate)
    if (dueKey < args.refKey || dueKey > args.weekEndKey) {
      continue
    }
    items.push({
      id: fee.id,
      date: dueKey,
      title: fee.status === FeeStatus.Overdue ? 'Fee payment overdue' : 'Fee payment due',
      kind: 'fee_due',
      highlight: fee.status === FeeStatus.Overdue,
    })
  }

  if (args.academicPeriod) {
    const periodEndKey = toDateKey(args.academicPeriod.endDate)
    if (periodEndKey >= args.refKey && periodEndKey <= args.weekEndKey) {
      items.push({
        id: `period-end-${args.academicPeriod.id}`,
        date: periodEndKey,
        title: `${args.academicPeriod.name} report cards due`,
        kind: 'report_card_deadline',
        highlight: true,
      })
    }
  }

  for (const assessment of args.periodAssessments) {
    const assessmentDate = assessment.dueAt ?? assessment.startsAt ?? assessment.completedAt
    if (!assessmentDate) {
      continue
    }
    const dateKey = toDateKey(assessmentDate)
    if (dateKey < args.refKey || dateKey > args.weekEndKey) {
      continue
    }
    items.push({
      id: assessment.id,
      date: dateKey,
      title: assessment.title,
      kind: 'exam',
      highlight: false,
    })
  }

  return items
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title))
    .slice(0, 14)
}

function buildClassRiskRows(args: {
  classGroups: Awaited<ReturnType<SchoolRepositories['classGroups']['list']>>
  staffById: Map<string, { firstName: string, lastName: string }>
  studentsByClass: Map<string, Set<string>>
  todayAttendanceByStudent: Map<string, { present: number, total: number }>
  openIncidentsByClass: Map<string, number>
  highSeverityIncidentsByClass: Map<string, number>
  overdueFeesByStudent: Map<string, number>
  periodAssessments: Array<{ id: string, classGroupId: string }>
  resultsByAssessment: Map<string, number>
  enrollmentsByClass: Map<string, number>
}): DashboardClassRiskRow[] {
  return args.classGroups
    .map((classGroup) => {
      const classStudentIds = args.studentsByClass.get(classGroup.id) ?? new Set<string>()
      let presentTotal = 0
      let attendanceTotal = 0
      for (const studentId of classStudentIds) {
        const attendance = args.todayAttendanceByStudent.get(studentId)
        if (!attendance) {
          continue
        }
        presentTotal += attendance.present
        attendanceTotal += attendance.total
      }
      const attendanceRateToday = attendanceTotal > 0
        ? roundRate((presentTotal / attendanceTotal) * 100)
        : null

      let overdueFeeCount = 0
      for (const studentId of classStudentIds) {
        overdueFeeCount += args.overdueFeesByStudent.get(studentId) ?? 0
      }

      const gradingCompletionPercent = computeClassGradingCompletionPercent(
        classGroup.id,
        args.periodAssessments,
        args.resultsByAssessment,
        args.enrollmentsByClass,
      )

      const openIncidentCount = args.openIncidentsByClass.get(classGroup.id) ?? 0
      const highSeverityIncidentCount = args.highSeverityIncidentsByClass.get(classGroup.id) ?? 0
      const coordinator = classGroup.homeroomStaffId
        ? args.staffById.get(classGroup.homeroomStaffId)
        : undefined

      return {
        classGroupId: classGroup.id,
        className: classGroup.name,
        coordinatorName: coordinator ? staffDisplayName(coordinator) : null,
        attendanceRateToday,
        openIncidentCount,
        gradingCompletionPercent,
        overdueFeeCount,
        riskLevel: computeClassRiskLevel({
          attendanceRateToday,
          openIncidentCount,
          highSeverityIncidentCount,
          gradingCompletionPercent,
          overdueFeeCount,
        }),
      }
    })
    .sort((left, right) => {
      const riskOrder = { needs_action: 0, watch: 1, normal: 2 } as const
      const riskDiff = riskOrder[left.riskLevel] - riskOrder[right.riskLevel]
      if (riskDiff !== 0) {
        return riskDiff
      }
      return left.className.localeCompare(right.className)
    })
}

export async function buildSchoolOverview(
  repositories: OverviewRepositories,
  input: GetSchoolOverviewInput,
): Promise<SchoolOverview> {
  const referenceDate = input.referenceDate ?? new Date()
  const refKey = toDateKey(referenceDate)
  const weekEnd = new Date(referenceDate)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  const weekEndKey = toDateKey(weekEnd)
  const recentPaymentStart = new Date(referenceDate)
  recentPaymentStart.setUTCDate(recentPaymentStart.getUTCDate() - 6)

  const [
    students,
    staffMembers,
    studentFees,
    reportCardResults,
    incidents,
    attendanceRecords,
    assessments,
    assessmentResults,
    enrollments,
    calendarEvents,
    classGroups,
    payments,
    studentDisciplinaryActions,
    activities,
    academicPeriod,
  ] = await Promise.all([
    repositories.students.list({ schoolId: input.schoolId }),
    repositories.staffMembers.list({ schoolId: input.schoolId }),
    repositories.studentFees.list(),
    repositories.results.list(),
    repositories.incidents.list({ schoolId: input.schoolId }),
    repositories.attendance.list(),
    repositories.assessments.list(),
    repositories.assessmentResults.list(),
    repositories.enrollments.list({ academicYearId: input.academicYearId }),
    repositories.calendarEvents.list({
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
    }),
    repositories.classGroups.list({ academicYearId: input.academicYearId }),
    repositories.payments.list(),
    repositories.studentDisciplinaryActions.list({ schoolId: input.schoolId }),
    repositories.activities.list({ schoolId: input.schoolId }),
    repositories.academicPeriods.findById(input.academicPeriodId),
  ])

  const studentIds = new Set(students.map(student => student.id))
  const schoolFees = studentFees.filter(fee => studentIds.has(fee.studentId))
  const overdueFees = schoolFees.filter(fee => fee.status === FeeStatus.Overdue)
  const overdueFeeAmount = overdueFees.reduce((sum, fee) => sum + fee.balanceDue.amount, 0)

  const activeEnrollments = enrollments.filter(enrollment =>
    studentIds.has(enrollment.studentId)
    && enrollment.status === StudentClassEnrollmentStatus.Active,
  )
  const studentCount = activeEnrollments.length > 0
    ? new Set(activeEnrollments.map(enrollment => enrollment.studentId)).size
    : students.length

  const studentsByClass = new Map<string, Set<string>>()
  const enrollmentsByClass = new Map<string, number>()
  for (const enrollment of activeEnrollments) {
    if (!studentsByClass.has(enrollment.classGroupId)) {
      studentsByClass.set(enrollment.classGroupId, new Set())
    }
    studentsByClass.get(enrollment.classGroupId)!.add(enrollment.studentId)
    enrollmentsByClass.set(
      enrollment.classGroupId,
      (enrollmentsByClass.get(enrollment.classGroupId) ?? 0) + 1,
    )
  }

  const periodResults = reportCardResults.filter(result =>
    studentIds.has(result.studentId) && result.periodId === input.academicPeriodId,
  )
  const publishedReportCardCount = periodResults.filter(
    result => result.status === ReportCardResultStatus.Published,
  ).length
  const studentsWithPublished = new Set(
    periodResults
      .filter(result => result.status === ReportCardResultStatus.Published)
      .map(result => result.studentId),
  )
  const unpublishedReportCardCount = Math.max(0, studentCount - studentsWithPublished.size)

  const schoolAttendance = attendanceRecords.filter(record => studentIds.has(record.studentId))
  const todayAttendance = schoolAttendance.filter(record => isSameDay(record.date, referenceDate))
  const absencesToday = todayAttendance.filter(record => record.status === AttendanceStatus.Absent).length
  const attendanceRateToday = todayAttendance.length > 0
    ? roundRate(
        (todayAttendance.filter(record => record.status === AttendanceStatus.Present).length
          / todayAttendance.length) * 100,
      )
    : null

  const todayAttendanceByStudent = new Map<string, { present: number, total: number }>()
  for (const record of todayAttendance) {
    const current = todayAttendanceByStudent.get(record.studentId) ?? { present: 0, total: 0 }
    current.total += 1
    if (record.status === AttendanceStatus.Present) {
      current.present += 1
    }
    todayAttendanceByStudent.set(record.studentId, current)
  }

  const pendingJustificationCount = schoolAttendance.filter(
    record => record.justificationStatus === AttendanceJustificationStatus.Pending,
  ).length

  const openIncidents = incidents.filter(incident => incident.status === IncidentStatus.Open)
  const highSeverityIncidentCount = openIncidents.filter(
    incident => HIGH_SEVERITY_INCIDENT_KINDS.has(incident.kind),
  ).length

  const openIncidentsByClass = new Map<string, number>()
  const highSeverityIncidentsByClass = new Map<string, number>()
  for (const incident of openIncidents) {
    if (!incident.classGroupId) {
      continue
    }
    openIncidentsByClass.set(
      incident.classGroupId,
      (openIncidentsByClass.get(incident.classGroupId) ?? 0) + 1,
    )
    if (HIGH_SEVERITY_INCIDENT_KINDS.has(incident.kind)) {
      highSeverityIncidentsByClass.set(
        incident.classGroupId,
        (highSeverityIncidentsByClass.get(incident.classGroupId) ?? 0) + 1,
      )
    }
  }

  const periodAssessments = assessments.filter(assessment => assessment.periodId === input.academicPeriodId)
  const resultsByAssessment = new Map<string, number>()
  for (const result of assessmentResults) {
    if (!studentIds.has(result.studentId)) {
      continue
    }
    resultsByAssessment.set(result.assessmentId, (resultsByAssessment.get(result.assessmentId) ?? 0) + 1)
  }
  const incompleteClasses = new Set<string>()
  for (const assessment of periodAssessments) {
    const expected = enrollmentsByClass.get(assessment.classGroupId) ?? 0
    const graded = resultsByAssessment.get(assessment.id) ?? 0
    if (expected > 0 && graded < expected) {
      incompleteClasses.add(assessment.classGroupId)
    }
  }

  const gradingCompletionPercent = computeGradingCompletionPercent(
    periodAssessments,
    resultsByAssessment,
    enrollmentsByClass,
  )

  const overdueFeesByStudent = new Map<string, number>()
  for (const fee of overdueFees) {
    overdueFeesByStudent.set(
      fee.studentId,
      (overdueFeesByStudent.get(fee.studentId) ?? 0) + 1,
    )
  }

  const studentsWithBalance = new Set(
    schoolFees
      .filter(fee => BALANCE_FEE_STATUSES.has(fee.status) && fee.balanceDue.amount > 0)
      .map(fee => fee.studentId),
  ).size

  const schoolFeeIds = new Set(schoolFees.map(fee => fee.id))
  const recentPayments = payments.filter(payment =>
    payment.status === PaymentStatus.Recorded
    && schoolFeeIds.has(payment.studentFeeId)
    && payment.paymentDate >= recentPaymentStart
    && payment.paymentDate <= referenceDate,
  )
  const recentPaymentAmount = recentPayments.reduce((sum, payment) => sum + payment.amount.amount, 0)

  const unresolvedDisciplineCount = studentDisciplinaryActions.filter(
    action => action.status === StudentDisciplinaryActionStatus.Active,
  ).length

  const activeActivityCount = activities.filter(
    activity => activity.endDate >= referenceDate && activity.startDate <= weekEnd,
  ).length

  const staffById = new Map(
    staffMembers.map(staff => [staff.id, { firstName: staff.firstName, lastName: staff.lastName }]),
  )

  const kpis: SchoolOverviewKpis = {
    studentCount,
    staffCount: staffMembers.length,
    overdueFeeCount: overdueFees.length,
    overdueFeeAmount,
    publishedReportCardCount,
    unpublishedReportCardCount,
    attendanceRateToday,
    absencesToday,
    openIncidentCount: openIncidents.length,
    highSeverityIncidentCount,
    pendingJustificationCount,
    incompleteGradingClassCount: incompleteClasses.size,
  }

  const areaHealth: DashboardAreaHealth = {
    students: {
      attendanceRateToday,
      absencesToday,
      pendingJustifications: pendingJustificationCount,
    },
    academics: {
      gradingCompletionPercent,
      publishedReportCards: publishedReportCardCount,
      totalReportCards: studentCount,
      incompleteGradingClassCount: incompleteClasses.size,
    },
    finance: {
      overdueAmount: overdueFeeAmount,
      studentsWithBalance,
      recentPaymentCount: recentPayments.length,
      recentPaymentAmount,
    },
    schoolLife: {
      openIncidentCount: openIncidents.length,
      highSeverityIncidentCount,
      activeActivityCount,
      unresolvedDisciplineCount,
    },
  }

  const schoolClassGroups = classGroups.filter(classGroup => classGroup.schoolId === input.schoolId)

  return {
    schoolId: input.schoolId,
    academicYearId: input.academicYearId,
    academicPeriodId: input.academicPeriodId,
    referenceDate: refKey,
    generatedAt: new Date().toISOString(),
    kpis,
    actionItems: buildActionItems(kpis),
    upcoming: buildUpcoming({
      calendarEvents,
      schoolFees,
      periodAssessments,
      academicPeriod,
      refKey,
      weekEndKey,
    }),
    areaHealth,
    classRiskRows: buildClassRiskRows({
      classGroups: schoolClassGroups,
      staffById,
      studentsByClass,
      todayAttendanceByStudent,
      openIncidentsByClass,
      highSeverityIncidentsByClass,
      overdueFeesByStudent,
      periodAssessments,
      resultsByAssessment,
      enrollmentsByClass,
    }),
  }
}

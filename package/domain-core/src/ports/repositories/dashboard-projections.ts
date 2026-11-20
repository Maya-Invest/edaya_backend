import type { ResourceAccessScope } from './resource-access-scope'

export interface GetSchoolOverviewInput {
  schoolId: string
  academicYearId: string
  academicPeriodId?: string
  referenceDate?: Date
}

export type DashboardActionKey
  = | 'overdue_fees'
    | 'unpublished_report_cards'
    | 'pending_justifications'
    | 'high_severity_incidents'
    | 'incomplete_grading'
    | 'pending_student_photos'

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
  publishedReportCards: number | null
  totalReportCards: number | null
  incompleteGradingClassCount: number | null
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
  publishedReportCardCount: number | null
  unpublishedReportCardCount: number | null
  attendanceRateToday: number | null
  absencesToday: number
  openIncidentCount: number
  highSeverityIncidentCount: number
  pendingJustificationCount: number
  incompleteGradingClassCount: number | null
}

export interface SchoolOverview {
  schoolId: string
  academicYearId: string
  academicPeriodId: string | null
  referenceDate: string
  generatedAt: string
  kpis: SchoolOverviewKpis
  actionItems: DashboardActionItem[]
  upcoming: DashboardUpcomingItem[]
  areaHealth: DashboardAreaHealth
  classRiskRows: DashboardClassRiskRow[]
}

export interface AppShellCounts {
  schoolId: string
  activeEnrollmentCountsByClass: Record<string, number>
  studentCount: number
  guardianCount: number
  staffCount: number
  teacherCount: number
}
export interface DashboardProjectionPort {
  overview: (input: GetSchoolOverviewInput, scopes: DashboardScopes) => Promise<Omit<SchoolOverview, 'actionItems'>>
  appShell: (input: { schoolId: string, classGroupIds?: readonly string[] }, scopes: AppShellScopes) => Promise<AppShellCounts>
}
export const DASHBOARD_RESOURCES = ['students', 'guardians', 'staffMembers', 'teachers', 'studentCharges', 'results', 'incidents', 'attendance', 'assessments', 'assessmentResults', 'enrollments', 'calendarEvents', 'classGroups', 'payments', 'studentDisciplinaryActions', 'activities', 'academicPeriods'] as const
export type DashboardScopes = Record<typeof DASHBOARD_RESOURCES[number], ResourceAccessScope>
export const APP_SHELL_RESOURCES = ['students', 'guardians', 'staffMembers', 'teachers', 'enrollments'] as const satisfies readonly (keyof DashboardScopes)[]
export type AppShellScopes = Pick<DashboardScopes, typeof APP_SHELL_RESOURCES[number]>

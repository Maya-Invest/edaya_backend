import type { SchoolRepositories } from '../../src/ports'
import { describe, expect, test } from 'bun:test'
import { buildSchoolOverview } from '../../src/application/queries/school-overview'
import {
  AttendanceJustificationStatus,
  AttendanceRecord,
  AttendanceStatus,
  FeeStatus,
  Incident,
  IncidentKind,
  IncidentStatus,
  ReportCardResult,
  ReportCardResultStatus,
  Student,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentFee,
  StudentStatus,
} from '../../src/domain'

function createOverviewRepos(
  overrides: Record<string, { list?: () => Promise<unknown[]>, findById?: () => Promise<unknown> }> = {},
): SchoolRepositories {
  const base = {
    students: { list: async () => [] },
    staffMembers: { list: async () => [] },
    studentFees: { list: async () => [] },
    results: { list: async () => [] },
    incidents: { list: async () => [] },
    attendance: { list: async () => [] },
    assessments: { list: async () => [] },
    assessmentResults: { list: async () => [] },
    enrollments: { list: async () => [] },
    calendarEvents: { list: async () => [] },
    classGroups: { list: async () => [] },
    payments: { list: async () => [] },
    studentDisciplinaryActions: { list: async () => [] },
    activities: { list: async () => [] },
    academicPeriods: { findById: async () => undefined },
  }

  return { ...base, ...overrides } as unknown as SchoolRepositories
}

describe('buildSchoolOverview', () => {
  test('aggregates dashboard KPIs and action items', async () => {
    const student = new Student({
      id: 'student-1',
      schoolId: 'school-1',
      firstName: 'Awa',
      lastName: 'Diallo',
      birthDate: new Date('2010-01-01'),
      status: StudentStatus.Active,
    })
    const enrollment = new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Active,
      enrolledAt: new Date('2025-09-01'),
    })
    const overdueFee = new StudentFee({
      id: 'fee-1',
      studentId: 'student-1',
      feeId: 'catalog-1',
      academicYearId: 'year-1',
      expectedAmount: 10_000,
      paidAmount: 2_000,
      currency: 'XOF',
      status: FeeStatus.Overdue,
      dueDate: new Date('2026-06-16'),
    })
    const incident = new Incident({
      id: 'incident-1',
      schoolId: 'school-1',
      title: 'Fight in hallway',
      description: 'Two students involved',
      date: new Date('2026-06-13'),
      kind: IncidentKind.MajorInfraction,
      reporterId: 'staff-1',
      status: IncidentStatus.Open,
    })
    const attendance = new AttendanceRecord({
      id: 'attendance-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      date: new Date('2026-06-14T00:00:00.000Z'),
      status: AttendanceStatus.Absent,
      justificationStatus: AttendanceJustificationStatus.Pending,
    })

    const overview = await buildSchoolOverview(createOverviewRepos({
      students: { list: async () => [student] },
      staffMembers: { list: async () => [{ id: 'staff-1' }] as never[] },
      studentFees: { list: async () => [overdueFee] },
      results: { list: async () => [] },
      incidents: { list: async () => [incident] },
      attendance: { list: async () => [attendance] },
      assessments: { list: async () => [] },
      assessmentResults: { list: async () => [] },
      enrollments: { list: async () => [enrollment] },
      calendarEvents: { list: async () => [] },
    }), {
      schoolId: 'school-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
      referenceDate: new Date('2026-06-14T00:00:00.000Z'),
    })

    expect(overview.kpis.studentCount).toBe(1)
    expect(overview.kpis.overdueFeeCount).toBe(1)
    expect(overview.kpis.overdueFeeAmount).toBe(8_000)
    expect(overview.kpis.unpublishedReportCardCount).toBe(1)
    expect(overview.kpis.highSeverityIncidentCount).toBe(1)
    expect(overview.kpis.pendingJustificationCount).toBe(1)
    expect(overview.generatedAt).toBeTruthy()
    expect(overview.areaHealth.finance.overdueAmount).toBe(8_000)
    expect(overview.classRiskRows).toEqual([])
    expect(overview.actionItems.map(item => item.key)).toEqual([
      'overdue_fees',
      'unpublished_report_cards',
      'pending_justifications',
      'high_severity_incidents',
    ])
  })

  test('counts published report cards for the selected period', async () => {
    const student = new Student({
      id: 'student-1',
      schoolId: 'school-1',
      firstName: 'Awa',
      lastName: 'Diallo',
      birthDate: new Date('2010-01-01'),
      status: StudentStatus.Active,
    })
    const enrollment = new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Active,
      enrolledAt: new Date('2025-09-01'),
    })
    const published = new ReportCardResult({
      id: 'rc-1',
      reportCardDefinitionId: 'def-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: {
        presentCount: 20,
        absenceCount: 1,
        lateCount: 0,
      },
      assessmentResultCount: 5,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-06-01'),
    })

    const overview = await buildSchoolOverview(createOverviewRepos({
      students: { list: async () => [student] },
      staffMembers: { list: async () => [] },
      studentFees: { list: async () => [] },
      results: { list: async () => [published] },
      incidents: { list: async () => [] },
      attendance: { list: async () => [] },
      assessments: { list: async () => [] },
      assessmentResults: { list: async () => [] },
      enrollments: { list: async () => [enrollment] },
      calendarEvents: { list: async () => [] },
    }), {
      schoolId: 'school-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
    })

    expect(overview.kpis.publishedReportCardCount).toBe(1)
    expect(overview.kpis.unpublishedReportCardCount).toBe(0)
    expect(overview.actionItems).toEqual([])
  })
})

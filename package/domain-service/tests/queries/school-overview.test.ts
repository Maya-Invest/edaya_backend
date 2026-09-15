import type { SchoolRepositories } from '@edaya/service'
import { AcademicPeriod, AcademicPeriodType, Activity, ActivityCategory, Assessment, AssessmentKind, AssessmentResult, AttendanceJustificationStatus, AttendanceMode, AttendanceRecord, AttendanceStatus, CalendarEvent, CalendarEventKind, ChargeStatus, ClassGroup, Incident, IncidentKind, IncidentStatus, Payment, PaymentKind, PaymentMethod, PaymentStatus, ReportCardResult, ReportCardResultStatus, Student, StudentCharge, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentDisciplinaryAction, StudentDisciplinaryActionStatus, StudentStatus, studentYearAccountId } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildSchoolOverview } from '../../src/services/queries/school-overview'

function createOverviewRepos(
  overrides: Record<string, { list?: () => Promise<unknown[]>, findById?: () => Promise<unknown> }> = {},
): SchoolRepositories {
  const base = {
    students: { list: async () => [] },
    staffMembers: { list: async () => [] },
    studentCharges: { list: async () => [] },
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
    const overdueFee = new StudentCharge({
      id: 'fee-1',
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: 'enr-1',
      academicYearId: 'year-1',
      label: 'Tuition',
      expectedAmount: 10_000,
      allocatedAmount: 2_000,
      currency: 'XOF',
      status: ChargeStatus.Overdue,
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
      studentCharges: { list: async () => [overdueFee] },
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
      studentCharges: { list: async () => [] },
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

  test('builds upcoming items and class risk rows for the reference week', async () => {
    const referenceDate = new Date('2026-06-14T00:00:00.000Z')
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
    const classGroup = new ClassGroup({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 7A',
      attendanceMode: AttendanceMode.Session,
      homeroomStaffId: 'staff-1',
    })
    const overdueFee = new StudentCharge({
      id: 'fee-1',
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: 'enr-1',
      academicYearId: 'year-1',
      label: 'Tuition',
      expectedAmount: 10_000,
      allocatedAmount: 0,
      currency: 'XOF',
      status: ChargeStatus.Overdue,
      dueDate: new Date('2026-06-16T00:00:00.000Z'),
    })
    const pendingFee = new StudentCharge({
      id: 'fee-2',
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: 'enr-2',
      academicYearId: 'year-1',
      label: 'Transport',
      expectedAmount: 5_000,
      allocatedAmount: 0,
      currency: 'XOF',
      status: ChargeStatus.Pending,
      dueDate: new Date('2026-06-18T00:00:00.000Z'),
    })
    const calendarEvent = new CalendarEvent({
      id: 'event-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      title: 'Sports day',
      startDate: new Date('2026-06-15T00:00:00.000Z'),
      endDate: new Date('2026-06-15T00:00:00.000Z'),
      kind: CalendarEventKind.Event,
    })
    const holiday = new CalendarEvent({
      id: 'event-2',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      title: 'Public holiday',
      startDate: new Date('2026-06-17T00:00:00.000Z'),
      endDate: new Date('2026-06-17T00:00:00.000Z'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
    })
    const academicPeriod = new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      name: 'Term 3',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-06-20T00:00:00.000Z'),
    })
    const assessment = new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'cs-1',
      periodId: 'period-1',
      title: 'Math exam',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-06-16T09:00:00.000Z'),
      endsAt: new Date('2026-06-16T10:00:00.000Z'),
    })
    const incident = new Incident({
      id: 'incident-1',
      schoolId: 'school-1',
      title: 'Class disruption',
      description: 'Noise during lesson',
      date: new Date('2026-06-13'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'staff-1',
      status: IncidentStatus.Open,
      classGroupId: 'class-1',
    })
    const presentOnly = [
      new AttendanceRecord({
        id: 'attendance-present-1',
        studentId: 'student-1',
        lessonSessionId: 'session-1',
        date: referenceDate,
        status: AttendanceStatus.Present,
      }),
      new AttendanceRecord({
        id: 'attendance-present-2',
        studentId: 'student-1',
        lessonSessionId: 'session-2',
        date: referenceDate,
        status: AttendanceStatus.Present,
      }),
    ]
    const assessmentResult = new AssessmentResult({
      id: 'result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 18,
    })
    const payment = new Payment({
      id: 'payment-1',
      schoolId: 'school-1',
      accountId: studentYearAccountId('school-1', 'student-1', 'year-1', 'XOF'),
      academicYearId: 'year-1',
      kind: PaymentKind.Receipt,
      amount: 2_000,
      currency: 'XOF',
      paymentDate: new Date('2026-06-13T00:00:00.000Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Recorded,
    })
    const activity = new Activity({
      id: 'activity-1',
      schoolId: 'school-1',
      name: 'Chess club',
      category: ActivityCategory.Arts,
      coach: 'Coach Sam',
      schedule: 'Wednesdays',
      participants: 12,
      capacity: 20,
      description: 'Chess club',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
    })
    const discipline = new StudentDisciplinaryAction({
      id: 'discipline-1',
      schoolId: 'school-1',
      incidentId: 'incident-1',
      studentId: 'student-1',
      disciplinaryActionId: 'action-1',
      assignedByStaffId: 'staff-1',
      startsAt: new Date('2026-06-10'),
      status: StudentDisciplinaryActionStatus.Active,
    })

    const overview = await buildSchoolOverview(createOverviewRepos({
      students: { list: async () => [student] },
      staffMembers: {
        list: async () => [{
          id: 'staff-1',
          firstName: 'Marie',
          lastName: 'Konate',
        }],
      },
      studentCharges: { list: async () => [overdueFee, pendingFee] },
      results: { list: async () => [] },
      incidents: { list: async () => [incident] },
      attendance: { list: async () => presentOnly },
      assessments: { list: async () => [assessment] },
      assessmentResults: { list: async () => [assessmentResult] },
      enrollments: { list: async () => [enrollment] },
      calendarEvents: { list: async () => [calendarEvent, holiday] },
      classGroups: { list: async () => [classGroup] },
      payments: { list: async () => [payment] },
      studentDisciplinaryActions: { list: async () => [discipline] },
      activities: { list: async () => [activity] },
      academicPeriods: { findById: async () => academicPeriod },
    }), {
      schoolId: 'school-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
      referenceDate,
    })

    expect(overview.upcoming.map(item => item.kind)).toEqual([
      'calendar',
      'fee_due',
      'exam',
      'holiday',
      'fee_due',
      'report_card_deadline',
    ])
    expect(overview.classRiskRows).toHaveLength(1)
    expect(overview.classRiskRows[0]).toMatchObject({
      classGroupId: 'class-1',
      className: 'Grade 7A',
      coordinatorName: 'Marie Konate',
      openIncidentCount: 1,
      overdueFeeCount: 1,
      riskLevel: 'watch',
    })
    expect(overview.areaHealth.finance.recentPaymentCount).toBe(1)
    expect(overview.areaHealth.schoolLife.activeActivityCount).toBe(1)
    expect(overview.areaHealth.schoolLife.unresolvedDisciplineCount).toBe(1)
    expect(overview.kpis.incompleteGradingClassCount).toBe(0)
    expect(overview.actionItems.some(item => item.key === 'incomplete_grading')).toBe(false)
  })

  test('marks classes needing action when incidents and grading thresholds are critical', async () => {
    const referenceDate = new Date('2026-06-14T00:00:00.000Z')
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
    const classGroup = new ClassGroup({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 7B',
      attendanceMode: AttendanceMode.Session,
    })
    const incident = new Incident({
      id: 'incident-1',
      schoolId: 'school-1',
      title: 'Emergency',
      description: 'Emergency in class',
      date: new Date('2026-06-13'),
      kind: IncidentKind.Emergency,
      reporterId: 'staff-1',
      status: IncidentStatus.Open,
      classGroupId: 'class-1',
    })
    const overdueFees = ['fee-1', 'fee-2', 'fee-3'].map(id => new StudentCharge({
      id,
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: `enr-${id}`,
      academicYearId: 'year-1',
      label: 'Tuition',
      expectedAmount: 1_000,
      allocatedAmount: 0,
      currency: 'XOF',
      status: ChargeStatus.Overdue,
      dueDate: new Date('2026-06-10'),
    }))
    const assessment = new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'cs-1',
      periodId: 'period-1',
      title: 'Final',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-06-16T09:00:00.000Z'),
      endsAt: new Date('2026-06-16T10:00:00.000Z'),
    })
    const assessmentResult = new AssessmentResult({
      id: 'result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 10,
    })

    const overview = await buildSchoolOverview(createOverviewRepos({
      students: { list: async () => [student] },
      staffMembers: { list: async () => [] },
      studentCharges: { list: async () => overdueFees },
      results: { list: async () => [] },
      incidents: { list: async () => [incident] },
      attendance: {
        list: async () => [new AttendanceRecord({
          id: 'attendance-1',
          studentId: 'student-1',
          lessonSessionId: 'session-1',
          date: referenceDate,
          status: AttendanceStatus.Absent,
        })],
      },
      assessments: { list: async () => [assessment] },
      assessmentResults: { list: async () => [assessmentResult] },
      enrollments: { list: async () => [enrollment] },
      calendarEvents: { list: async () => [] },
      classGroups: { list: async () => [classGroup] },
    }), {
      schoolId: 'school-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
      referenceDate,
    })

    expect(overview.classRiskRows[0]?.riskLevel).toBe('needs_action')
    expect(overview.areaHealth.academics.gradingCompletionPercent).toBe(100)
  })

  test('falls back to total student count when no active enrollments exist', async () => {
    const student = new Student({
      id: 'student-1',
      schoolId: 'school-1',
      firstName: 'Awa',
      lastName: 'Diallo',
      birthDate: new Date('2010-01-01'),
      status: StudentStatus.Active,
    })

    const overview = await buildSchoolOverview(createOverviewRepos({
      students: { list: async () => [student] },
      enrollments: { list: async () => [] },
    }), {
      schoolId: 'school-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
    })

    expect(overview.kpis.studentCount).toBe(1)
    expect(overview.kpis.attendanceRateToday).toBeNull()
    expect(overview.classRiskRows).toEqual([])
  })
})

import type { AttendanceRecord } from '../../../src/entities'
import type { AtomicExecutionPort, SchoolRepositories } from '../../../src/ports'
import type { ActorMetadata, AuthorizationPolicy } from '../../../src/services/authorization'
import { describe, expect, mock, test } from 'bun:test'
import {
  AcademicYear,
  Announcement,
  AnnouncementStatus,
  AssessmentKind,
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
  EnrollmentEndReason,
  Fee,
  FeeCategory,
  FeeStatus,
  GuardianStudentLink,
  IncidentInvolvementRole,
  IncidentKind,
  IncidentStatus,
  MessageDelivery,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ProgressionDecision,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  SessionKind,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryActionStatus,
  StudentFee,
  StudentStatus,
  AnnouncementTargetKind as TargetKind,
} from '../../../src/entities'
import { SchoolService } from '../../../src/services/entities'
import { BusinessRuleViolationError } from '../../../src/services/shared/business-rule-error'

describe('SchoolService complex workflows', () => {
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  function createContext({
    existingProgress,
    matterCompletedPercentage = 0,
  }: {
    existingProgress?: unknown
    matterCompletedPercentage?: number
  } = {}) {
    const mockRepos = {
      classSubjectMatters: {
        findById: mock(async () => ({
          id: 'csm1',
          classSubjectId: 'cs1',
          subjectMatterId: 'sm1',
          completedPercentage: matterCompletedPercentage,
          updatedAt: new Date('2026-01-01T08:00:00Z'),
        })),
        findOne: mock(async () => undefined),
        list: mock(async () => [{ id: 'other-matter', completedPercentage: 50 }]),
        save: mock(async () => {}),
      },
      classSubjects: {
        findById: mock(async () => ({
          id: 'cs1',
          classGroupId: 'cg1',
          subjectId: 'subj1',
          coefficient: 1,
          completedPercentage: 0,
          createdAt: new Date('2026-01-01T08:00:00Z'),
        })),
        save: mock(async () => {}),
      },
      classGroups: {
        findById: mock(async () => ({ id: 'cg1', schoolId: 'sch1' })),
      },
      sessions: {
        findById: mock(async () => ({ id: 'sess1', classSubjectId: 'cs1', classGroupId: 'cg1' })),
      },
      classSubjectProgress: {
        findById: mock(async () => undefined),
        findOne: mock(async () => existingProgress),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkGlobalAction: mock(async () => {}),
      checkClassGroupAccess: mock(async () => {}),
      checkSessionAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, service }
  }

  function createSetupContext() {
    const academicYears = new Map<string, AcademicYear>([
      ['ay-current', new AcademicYear({
        id: 'ay-current',
        schoolId: 'sch1',
        name: '2025-2026',
        startDate: new Date('2025-09-01T00:00:00Z'),
        endDate: new Date('2026-06-30T00:00:00Z'),
        isActive: true,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      })],
      ['ay-next', new AcademicYear({
        id: 'ay-next',
        schoolId: 'sch1',
        name: '2026-2027',
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2027-06-30T00:00:00Z'),
        isActive: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })],
    ])
    const mockRepos = {
      academicYears: {
        findById: mock(async id => academicYears.get(id)),
        list: mock(async (filter: any = {}) => [...academicYears.values()].filter(year =>
          (!filter.schoolId || year.schoolId === filter.schoolId)
          && (filter.isActive === undefined || year.isActive === filter.isActive))),
        save: mock(async year => academicYears.set(year.id, year)),
      },
      schools: {
        findById: mock(async id => id === 'sch1' ? { id, name: 'School' } : undefined),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkGlobalAction: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { academicYears, mockAtomic, mockPolicy, mockRepos, service }
  }

  function createReportCardContext({
    existingReportCard,
  }: {
    existingReportCard?: any
  } = {}) {
    const periodStart = new Date('2026-01-01T00:00:00Z')
    const periodEnd = new Date('2026-03-31T00:00:00Z')
    const savedReportCards = new Map<string, any>()
    if (existingReportCard) {
      savedReportCards.set(existingReportCard.id, existingReportCard)
    }
    const mockRepos = {
      academicPeriods: {
        findById: mock(async () => ({
          id: 'per1',
          schoolId: 'sch1',
          academicYearId: 'ay1',
          startDate: periodStart,
          endDate: periodEnd,
        })),
      },
      assessmentResults: {
        list: mock(async () => [{ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }]),
      },
      assessments: {
        findById: mock(async () => ({
          id: 'ass1',
          classGroupId: 'cg1',
          classSubjectId: 'cs1',
          periodId: 'per1',
          title: 'Math test',
          kind: AssessmentKind.Quiz,
          maxScore: 100,
          coefficient: 1,
          createdAt: new Date('2026-01-15T00:00:00Z'),
        })),
      },
      attendance: {
        list: mock(async () => [
          { id: 'att-present', studentId: 'stu1', status: AttendanceStatus.Present },
          { id: 'att-absent', studentId: 'stu1', status: AttendanceStatus.Absent, justificationStatus: AttendanceJustificationStatus.Excused },
          { id: 'att-late', studentId: 'stu1', status: AttendanceStatus.Late },
        ]),
      },
      classGroups: {
        findById: mock(async () => ({
          id: 'cg1',
          schoolId: 'sch1',
          academicYearId: 'ay1',
          gradeLevelId: 'grade1',
        })),
      },
      classSubjects: {
        list: mock(async () => [{ id: 'cs1', classGroupId: 'cg1', subjectId: 'subject-math' }]),
      },
      definitions: {
        findById: mock(async () => ({
          id: 'def1',
          schoolId: 'sch1',
          academicYearId: 'ay1',
          gradeLevelId: 'grade1',
        })),
        findOne: mock(async () => undefined),
      },
      enrollments: {
        list: mock(async () => [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1' }]),
      },
      results: {
        findById: mock(async id => savedReportCards.get(id)),
        findOne: mock(async ({ studentId, periodId }: any = {}) => [...savedReportCards.values()].find(reportCard =>
          reportCard.studentId === studentId && reportCard.periodId === periodId)),
        save: mock(async reportCard => savedReportCards.set(reportCard.id, reportCard)),
      },
      sections: {
        list: mock(async () => [
          {
            id: 'sec-root',
            reportCardDefinitionId: 'def1',
            kind: ReportCardDefinitionSectionKind.Group,
            name: 'Academics',
            order: 1,
            weight: 1,
          },
          {
            id: 'sec-math',
            reportCardDefinitionId: 'def1',
            kind: ReportCardDefinitionSectionKind.Subject,
            name: 'Math',
            order: 1,
            weight: 1,
            parentSectionId: 'sec-root',
            subjectId: 'subject-math',
          },
        ]),
      },
      students: {
        findById: mock(async () => ({
          id: 'stu1',
          schoolId: 'sch1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: StudentStatus.Active,
          createdAt: new Date('2025-09-01T00:00:00Z'),
        })),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkGlobalAction: mock(async () => {}),
      checkReportCardResultAccess: mock(async () => {}),
      checkStudentAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, savedReportCards, service }
  }

  function createFinanceContext({
    studentFeeStatus = FeeStatus.Partial,
    paymentStatus = PaymentStatus.Recorded,
    paidAmount = 400,
    adjustmentAmount = 0,
  }: {
    studentFeeStatus?: FeeStatus
    paymentStatus?: PaymentStatus
    paidAmount?: number
    adjustmentAmount?: number
  } = {}) {
    const tuitionFee = new Fee({
      id: 'fee1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      name: 'Tuition',
      defaultAmount: 1000,
      currency: 'USD',
      category: FeeCategory.Tuition,
      installments: [
        { label: 'First', percentage: 50, dueDate: new Date('2026-02-01T00:00:00Z') },
        { label: 'Second', percentage: 50, dueDate: new Date('2026-05-01T00:00:00Z') },
      ],
    })
    const studentFee = new StudentFee({
      id: 'sf1',
      studentId: 'stu1',
      feeId: 'fee1',
      academicYearId: 'ay1',
      expectedAmount: 1000,
      paidAmount,
      adjustmentAmount,
      adjustmentReason: adjustmentAmount > 0 ? 'Sibling discount' : undefined,
      adjustedById: adjustmentAmount > 0 ? 'user1' : undefined,
      adjustedAt: adjustmentAmount > 0 ? new Date('2026-01-02T00:00:00Z') : undefined,
      currency: 'USD',
      status: studentFeeStatus,
      cancellationReason: studentFeeStatus === FeeStatus.Cancelled ? 'Cancelled' : undefined,
      cancelledById: studentFeeStatus === FeeStatus.Cancelled ? 'user1' : undefined,
      cancelledAt: studentFeeStatus === FeeStatus.Cancelled ? new Date('2026-01-01T00:00:00Z') : undefined,
    })
    const payment = new Payment({
      id: 'pay1',
      studentFeeId: 'sf1',
      amount: 400,
      currency: 'USD',
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      status: paymentStatus,
      recordedById: 'user1',
      reversedAt: paymentStatus === PaymentStatus.Reversed ? new Date('2026-03-02T00:00:00Z') : undefined,
      reversedById: paymentStatus === PaymentStatus.Reversed ? 'user1' : undefined,
      cancelledAt: paymentStatus === PaymentStatus.Cancelled ? new Date('2026-03-02T00:00:00Z') : undefined,
      cancelledById: paymentStatus === PaymentStatus.Cancelled ? 'user1' : undefined,
    })
    const mockRepos = {
      fees: {
        findById: mock(async () => tuitionFee),
      },
      payments: {
        findById: mock(async id => id === 'pay-new' ? undefined : payment),
        save: mock(async () => {}),
      },
      studentFees: {
        findById: mock(async id => id === 'sf-new' ? undefined : studentFee),
        save: mock(async () => {}),
      },
      students: {
        findById: mock(async () => ({
          id: 'stu1',
          schoolId: 'sch1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: StudentStatus.Active,
          createdAt: new Date('2025-09-01T00:00:00Z'),
        })),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkStudentAccess: mock(async () => {}),
      checkStudentFeeAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, service }
  }

  function createStudentTransitionContext({
    activeEnrollmentId = 'enr1',
    existingEnrollmentClassGroupId = 'cg1',
    studentStatus = StudentStatus.Active,
    sourceStatus = StudentClassEnrollmentStatus.Active,
    nextClassGroupId = 'cg2',
    sourceGradeOrder = 1,
    nextGradeOrder = 2,
    targetCapacity = 30,
    targetActiveEnrollmentCount = 0,
    existingSuccessor = false,
  }: {
    activeEnrollmentId?: string
    existingEnrollmentClassGroupId?: string
    studentStatus?: StudentStatus
    sourceStatus?: StudentClassEnrollmentStatus
    nextClassGroupId?: string
    sourceGradeOrder?: number
    nextGradeOrder?: number
    targetCapacity?: number
    targetActiveEnrollmentCount?: number
    existingSuccessor?: boolean
  } = {}) {
    const sourceEnrollment = new StudentClassEnrollment({
      id: 'enr1',
      studentId: 'stu1',
      classGroupId: 'cg1',
      academicYearId: 'ay1',
      enrollmentIndex: 1,
      status: sourceStatus,
      enrolledAt: new Date('2025-09-01T00:00:00Z'),
      endedAt: sourceStatus === StudentClassEnrollmentStatus.Closed ? new Date('2026-06-30T00:00:00Z') : undefined,
      endReason: sourceStatus === StudentClassEnrollmentStatus.Closed ? EnrollmentEndReason.Completed : undefined,
      closedBy: sourceStatus === StudentClassEnrollmentStatus.Closed ? 'user1' : undefined,
    })
    const successorEnrollment = new StudentClassEnrollment({
      id: 'enr2',
      studentId: 'stu1',
      classGroupId: nextClassGroupId,
      academicYearId: 'ay2',
      enrollmentIndex: 2,
      previousEnrollmentId: 'enr1',
    })
    const savedEnrollments = new Map<string, StudentClassEnrollment>()
    const classGroups = new Map([
      ['cg1', {
        id: 'cg1',
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'grade1',
        name: 'Grade 1',
        capacity: 30,
      }],
      ['cg2', {
        id: 'cg2',
        schoolId: 'sch1',
        academicYearId: 'ay2',
        gradeLevelId: 'grade2',
        name: 'Grade 2',
        capacity: targetCapacity,
      }],
    ])
    const mockRepos = {
      classGroups: {
        findById: mock(async id => classGroups.get(id)),
      },
      enrollments: {
        findById: mock(async (id) => {
          if (id === 'enr1')
            return sourceEnrollment
          if (id === 'enr2' && existingSuccessor)
            return successorEnrollment
          return undefined
        }),
        findOne: mock(async () => activeEnrollmentId
          ? { id: activeEnrollmentId, studentId: 'stu1', classGroupId: existingEnrollmentClassGroupId, status: StudentClassEnrollmentStatus.Active }
          : undefined),
        list: mock(async (filter) => {
          if (filter?.studentId === 'stu1') {
            return activeEnrollmentId
              ? [{
                  id: activeEnrollmentId,
                  studentId: 'stu1',
                  classGroupId: existingEnrollmentClassGroupId,
                  academicYearId: existingEnrollmentClassGroupId === 'cg2' ? 'ay2' : 'ay1',
                  status: StudentClassEnrollmentStatus.Active,
                  enrollmentIndex: 1,
                }]
              : []
          }
          if (filter?.classGroupId === 'cg2') {
            return Array.from({ length: targetActiveEnrollmentCount }, (_, index) => ({
              id: `target-active-${index + 1}`,
              studentId: `student-${index + 1}`,
              classGroupId: 'cg2',
              status: StudentClassEnrollmentStatus.Active,
              enrollmentIndex: 1,
            }))
          }
          return [sourceEnrollment]
        }),
        save: mock(async enrollment => savedEnrollments.set(enrollment.id, enrollment)),
      },
      gradeLevels: {
        findById: mock(async id => ({
          id,
          schoolId: 'sch1',
          name: id === 'grade1' ? 'Grade 1' : 'Grade 2',
          order: id === 'grade1' ? sourceGradeOrder : nextGradeOrder,
        })),
      },
      students: {
        findById: mock(async () => ({
          id: 'stu1',
          schoolId: 'sch1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: studentStatus,
          createdAt: new Date('2025-09-01T00:00:00Z'),
        })),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkGlobalAction: mock(async () => {}),
      checkClassGroupAccess: mock(async () => {}),
      checkStudentAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, savedEnrollments, service }
  }

  function createGuardianLinkContext({
    existingLink = false,
    enrolledInSchool = true,
    guardianSchoolId = 'sch1',
    studentSchoolId = 'sch1',
  }: {
    existingLink?: boolean
    enrolledInSchool?: boolean
    guardianSchoolId?: string
    studentSchoolId?: string
  } = {}) {
    const existingCreatedAt = new Date('2026-01-01T00:00:00Z')
    const savedLinks = new Map<string, GuardianStudentLink>()
    if (existingLink) {
      savedLinks.set('link-existing', new GuardianStudentLink({
        id: 'link-existing',
        schoolId: guardianSchoolId,
        guardianId: 'gua1',
        studentId: 'stu1',
        relationship: 'parent',
        createdAt: existingCreatedAt,
      }))
    }
    const mockRepos = {
      classGroups: {
        findById: mock(async id => ({ id, schoolId: enrolledInSchool ? guardianSchoolId : 'other-school' })),
      },
      enrollments: {
        list: mock(async () => enrolledInSchool
          ? [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active }]
          : []),
      },
      guardians: {
        findById: mock(async id => ({ id, schoolId: guardianSchoolId })),
      },
      guardianLinks: {
        findById: mock(async id => savedLinks.get(id)),
        findOne: mock(async ({ guardianId, studentId }: any = {}) => [...savedLinks.values()].find(link =>
          link.guardianId === guardianId && link.studentId === studentId)),
        save: mock(async link => savedLinks.set(link.id, link)),
      },
      students: {
        findById: mock(async id => ({ id, schoolId: studentSchoolId })),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkClassGroupAccess: mock(async () => {}),
      checkGlobalAction: mock(async () => {}),
      checkGuardianAccess: mock(async () => {}),
      checkStudentAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { existingCreatedAt, mockPolicy, mockRepos, savedLinks, service }
  }

  function createSchedulingContext({
    classGroupAttendanceMode = AttendanceMode.Daily,
    existingAttendance,
    existingDailySession = false,
    activeEnrollment = true,
    schedules = [],
    calendarEvents = [],
  }: {
    classGroupAttendanceMode?: AttendanceMode
    existingAttendance?: AttendanceRecord
    existingDailySession?: boolean
    activeEnrollment?: boolean
    schedules?: any[]
    calendarEvents?: any[]
  } = {}) {
    const savedSessions = new Map<string, any>()
    const savedAttendance = new Map<string, AttendanceRecord>()
    if (existingAttendance) {
      savedAttendance.set(existingAttendance.id, existingAttendance)
    }
    if (existingDailySession) {
      savedSessions.set('daily:cg_daily:2026-05-28', {
        id: 'daily:cg_daily:2026-05-28',
        classGroupId: 'cg_daily',
        kind: SessionKind.Other,
        title: 'Daily attendance',
        startsAt: new Date('2026-05-28T00:00:00Z'),
        endsAt: new Date('2026-05-29T00:00:00Z'),
      })
    }
    const classGroups = new Map([
      ['cg_daily', {
        id: 'cg_daily',
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'grade1',
        attendanceMode: classGroupAttendanceMode,
      }],
      ['cg_session', {
        id: 'cg_session',
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'grade1',
        attendanceMode: AttendanceMode.Session,
      }],
    ])
    const mockRepos = {
      attendance: {
        findById: mock(async id => savedAttendance.get(id)),
        findOne: mock(async filter => [...savedAttendance.values()].find(record =>
          record.studentId === filter?.studentId && record.sessionId === filter?.sessionId)),
        save: mock(async record => savedAttendance.set(record.id, record)),
      },
      classGroups: {
        findById: mock(async id => classGroups.get(id)),
      },
      calendarEvents: {
        list: mock(async () => calendarEvents),
      },
      enrollments: {
        list: mock(async () => activeEnrollment
          ? [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg_daily', status: StudentClassEnrollmentStatus.Active }]
          : []),
      },
      schedules: {
        list: mock(async () => schedules),
      },
      sessions: {
        findById: mock(async (id) => {
          if (savedSessions.has(id))
            return savedSessions.get(id)
          if (id === 'ses1') {
            return {
              id,
              classGroupId: 'cg_daily',
              kind: SessionKind.Course,
              title: 'Math',
              startsAt: new Date('2026-05-28T08:00:00Z'),
              endsAt: new Date('2026-05-28T09:00:00Z'),
            }
          }
          return undefined
        }),
        save: mock(async session => savedSessions.set(session.id, session)),
      },
      students: {
        findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkAttendanceAccess: mock(async () => {}),
      checkClassGroupAccess: mock(async () => {}),
      checkSessionAccess: mock(async () => {}),
      checkStudentAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, savedAttendance, savedSessions, service }
  }

  function createCommunicationsContext({
    announcementStatus = AnnouncementStatus.Published,
    targets = [
      { id: 'target-students', announcementId: 'ann1', targetKind: TargetKind.AllStudents },
      { id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' },
      { id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff1' },
    ],
    existingDelivery,
  }: {
    announcementStatus?: AnnouncementStatus
    targets?: Array<{ id: string, announcementId: string, targetKind: TargetKind, targetId?: string }>
    existingDelivery?: MessageDelivery
  } = {}) {
    const publishedAt = announcementStatus === AnnouncementStatus.Published
      ? new Date('2026-05-01T00:00:00Z')
      : undefined
    const announcement = new Announcement({
      id: 'ann1',
      schoolId: 'sch1',
      title: 'Announcement',
      content: 'Content',
      createdBy: 'user1',
      status: announcementStatus,
      publishedAt,
    })
    const savedAnnouncements = new Map<string, Announcement>([['ann1', announcement]])
    const savedDeliveries = new Map<string, MessageDelivery>()
    if (existingDelivery) {
      savedDeliveries.set(existingDelivery.id, existingDelivery)
    }
    const mockRepos = {
      announcements: {
        findById: mock(async id => savedAnnouncements.get(id)),
        save: mock(async announcement => savedAnnouncements.set(announcement.id, announcement)),
      },
      announcementTargets: {
        list: mock(async ({ announcementId }: any = {}) => targets.filter(target => !announcementId || target.announcementId === announcementId)),
      },
      classGroups: {
        findById: mock(async id => ({ id, schoolId: 'sch1', gradeLevelId: 'grade1' })),
        list: mock(async () => [{ id: 'cg1', schoolId: 'sch1', gradeLevelId: 'grade1' }]),
      },
      enrollments: {
        list: mock(async (filter: any = {}) => {
          if (filter.classGroupId === 'cg1') {
            return [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active }]
          }
          if (filter.studentId === 'stu1') {
            return [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active }]
          }
          return []
        }),
      },
      guardians: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
        list: mock(async () => [{ id: 'gua1', schoolId: 'sch1' }]),
      },
      guardianLinks: {
        list: mock(async (filter: any = {}) => {
          if (filter.studentId === 'stu1')
            return [{ studentId: 'stu1', guardianId: 'gua1' }]
          if (filter.guardianId === 'gua1')
            return [{ studentId: 'stu1', guardianId: 'gua1' }]
          return []
        }),
      },
      gradeLevels: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
      },
      messageDeliveries: {
        findById: mock(async id => savedDeliveries.get(id)),
        list: mock(async (filter: any = {}) => [...savedDeliveries.values()].filter(delivery =>
          (!filter.announcementId || delivery.announcementId === filter.announcementId)
          && (!filter.recipientKind || delivery.recipientKind === filter.recipientKind)
          && (!filter.recipientId || delivery.recipientId === filter.recipientId)
          && (!filter.channel || delivery.channel === filter.channel))),
        save: mock(async delivery => savedDeliveries.set(delivery.id, delivery)),
      },
      staffMembers: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
        list: mock(async () => [{ id: 'staff1', schoolId: 'sch1' }]),
      },
      students: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
        list: mock(async () => [{ id: 'stu1', schoolId: 'sch1' }]),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkGlobalAction: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { mockAtomic, mockPolicy, mockRepos, savedAnnouncements, savedDeliveries, service }
  }

  function createBehaviorContext({
    existingInvolvement = false,
    activeEnrollment = true,
    incidentStatus = IncidentStatus.Open,
    catalogActionSchoolId = 'sch1',
  }: {
    existingInvolvement?: boolean
    activeEnrollment?: boolean
    incidentStatus?: IncidentStatus
    catalogActionSchoolId?: string
  } = {}) {
    const incident = {
      id: 'inc1',
      schoolId: 'sch1',
      title: 'Hall incident',
      description: 'Incident description',
      date: new Date('2026-05-01T10:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'user1',
      classGroupId: 'cg1',
      sessionId: 'sess1',
      status: incidentStatus,
      resolvedAt: incidentStatus === IncidentStatus.Resolved ? new Date('2026-05-01T11:00:00Z') : undefined,
      resolvedByStaffId: incidentStatus === IncidentStatus.Resolved ? 'user1' : undefined,
      createdAt: new Date('2026-05-01T10:00:00Z'),
      updatedAt: new Date('2026-05-01T10:00:00Z'),
    }
    const incidents = new Map<string, any>([['inc1', incident]])
    const involvements = new Map<string, any>()
    if (existingInvolvement) {
      involvements.set('involvement-existing', {
        id: 'involvement-existing',
        incidentId: 'inc1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
        createdAt: new Date('2026-05-01T10:00:00Z'),
      })
    }
    const disciplinaryActions = new Map<string, any>([
      ['sda-existing', {
        id: 'sda-existing',
        schoolId: 'sch1',
        incidentId: 'inc1',
        studentId: 'stu1',
        disciplinaryActionId: 'da1',
        assignedByStaffId: 'user1',
        status: StudentDisciplinaryActionStatus.Active,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        updatedAt: new Date('2026-05-01T10:00:00Z'),
      }],
    ])
    const mockRepos = {
      classGroups: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
      },
      disciplinaryActions: {
        findById: mock(async id => ({ id, schoolId: catalogActionSchoolId })),
      },
      enrollments: {
        list: mock(async () => activeEnrollment
          ? [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active }]
          : []),
      },
      incidents: {
        findById: mock(async id => incidents.get(id)),
        save: mock(async incident => incidents.set(incident.id, incident)),
      },
      schools: {
        findById: mock(async id => ({ id, name: 'School' })),
      },
      sessions: {
        findById: mock(async id => ({ id, classGroupId: 'cg1' })),
      },
      students: {
        findById: mock(async id => ({ id, schoolId: 'sch1' })),
      },
      studentDisciplinaryActions: {
        findById: mock(async id => disciplinaryActions.get(id)),
        save: mock(async action => disciplinaryActions.set(action.id, action)),
      },
      studentIncidentInvolvements: {
        findById: mock(async id => involvements.get(id)),
        list: mock(async (filter: any = {}) => [...involvements.values()].filter(involvement =>
          (!filter.incidentId || involvement.incidentId === filter.incidentId)
          && (!filter.studentId || involvement.studentId === filter.studentId))),
        save: mock(async involvement => involvements.set(involvement.id, involvement)),
      },
    } as unknown as SchoolRepositories

    const mockPolicy = {
      checkClassGroupAccess: mock(async () => {}),
      checkGlobalAction: mock(async () => {}),
      checkSessionAccess: mock(async () => {}),
      checkStudentAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const mockAtomic: AtomicExecutionPort = {
      execute: mock(async (operation: () => Promise<any>) => operation()),
    }

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor,
      atomicExecution: mockAtomic,
    })

    return { disciplinaryActions, incidents, involvements, mockAtomic, mockPolicy, mockRepos, service }
  }

  test('createAcademicYear creates an active year and deactivates existing active years through managed service', async () => {
    const { academicYears, mockAtomic, mockPolicy, mockRepos, service } = createSetupContext()

    const result = await service.createAcademicYear({
      id: 'ay-new',
      schoolId: 'sch1',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T00:00:00Z'),
      createdAt: new Date('2027-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('ay-new')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-new')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

  test('activateAcademicYear activates an existing year and deactivates other active years through managed service', async () => {
    const { academicYears, mockAtomic, mockPolicy, mockRepos, service } = createSetupContext()

    const result = await service.activateAcademicYear({
      academicYearId: 'ay-next',
    })

    expect(result.id).toBe('ay-next')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-next')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

  test('recordSessionProgress records progress and updates aggregates through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createContext()

    const result = await service.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 100,
      notes: 'Completed',
      recordedAt: new Date('2026-02-01T10:00:00Z'),
    })

    expect(result.id).toBe('csp1')
    expect(result.completedPercentage).toBe(100)
    expect(result.recordedByStaffId).toBe('user1')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'academics.record_progress')
    expect(mockPolicy.checkSessionAccess).toHaveBeenCalledWith(actor, ['sess1'])
    expect(mockRepos.classSubjectProgress.save).toHaveBeenCalledWith(result)
    expect(mockRepos.classSubjectMatters.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'csm1',
      completedPercentage: 100,
    }))
    expect(mockRepos.classSubjects.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cs1',
      completedPercentage: 75,
    }))
  })

  test('recordSessionProgress rejects duplicate progress records', async () => {
    const { service } = createContext({ existingProgress: { id: 'existing-progress' } })

    await expect(service.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordSessionProgress rejects progress decreases', async () => {
    const { service } = createContext({ matterCompletedPercentage: 80 })

    await expect(service.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 60,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('generateReportCardResult creates a draft report card through managed service', async () => {
    const { mockPolicy, mockRepos, savedReportCards, service } = createReportCardContext()
    const generatedAt = new Date('2026-04-01T00:00:00Z')

    const result = await service.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      generatedAt,
    })

    expect(result.id).toBe('rc1')
    expect(result.status).toBe(ReportCardResultStatus.Draft)
    expect(result.generatedAt).toBe(generatedAt)
    expect(result.overallAverage).toBe(16)
    expect(result.assessmentResultCount).toBe(1)
    expect(result.attendanceSummary.presentCount).toBe(1)
    expect(result.attendanceSummary.absenceCount).toBe(1)
    expect(result.attendanceSummary.excusedAbsenceCount).toBe(1)
    expect(result.attendanceSummary.lateCount).toBe(1)
    expect(savedReportCards.get('rc1')).toBe(result)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'assessments.publish_report_card')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('generateReportCardResult reuses existing draft id and generatedAt', async () => {
    const existingGeneratedAt = new Date('2026-03-25T00:00:00Z')
    const { mockPolicy, mockRepos, service } = createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        reportCardDefinitionId: 'def1',
        studentId: 'stu1',
        classGroupId: 'cg1',
        periodId: 'per1',
        status: ReportCardResultStatus.Draft,
        generatedAt: existingGeneratedAt,
      },
    })

    const result = await service.generateReportCardResult({
      id: 'rc-new',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      generatedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(result.id).toBe('rc-existing')
    expect(result.status).toBe(ReportCardResultStatus.Draft)
    expect(result.generatedAt).toBe(existingGeneratedAt)
    expect(mockPolicy.checkReportCardResultAccess).toHaveBeenCalledWith(actor, ['rc-existing'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('generateReportCardResult rejects already published report cards', async () => {
    const { service } = createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        studentId: 'stu1',
        periodId: 'per1',
        status: ReportCardResultStatus.Published,
      },
    })

    await expect(service.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('publishReportCardResult publishes generated report cards through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createReportCardContext()

    const result = await service.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(result.id).toBe('rc1')
    expect(result.status).toBe(ReportCardResultStatus.Published)
    expect(result.overallAverage).toBe(16)
    expect(result.assessmentResultCount).toBe(1)
    expect(result.attendanceSummary.presentCount).toBe(1)
    expect(result.attendanceSummary.excusedAbsenceCount).toBe(1)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'assessments.publish_report_card')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkReportCardResultAccess).toHaveBeenCalledWith(actor, ['rc1'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('publishReportCardResult rejects already published report cards', async () => {
    const { service } = createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        studentId: 'stu1',
        periodId: 'per1',
        status: ReportCardResultStatus.Published,
      },
    })

    await expect(service.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assignFeeToStudent materializes installments through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createFinanceContext()

    const result = await service.assignFeeToStudent({
      id: 'sf-new',
      studentId: 'stu1',
      feeId: 'fee1',
      referenceDate: new Date('2026-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('sf-new')
    expect(result.installments).toHaveLength(2)
    expect(result.installments[0]?.expectedAmount).toBe(500)
    expect(result.installments[1]?.expectedAmount).toBe(500)
    expect(result.status).toBe(FeeStatus.Pending)
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(result)
  })

  test('recordPayment records payment and updates paid amount atomically', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createFinanceContext()

    const result = await service.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 600,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-03-02T00:00:00Z'),
    })

    expect(result.id).toBe('pay-new')
    expect(result.recordedById).toBe('user1')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkStudentFeeAccess).toHaveBeenCalledWith(actor, ['sf1'])
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      status: FeeStatus.Paid,
    }))
  })

  test('reversePayment reverses payment and decreases paid amount', async () => {
    const { mockRepos, service } = createFinanceContext()

    const result = await service.reversePayment({
      paymentId: 'pay1',
      reversedAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Reversed)
    expect(result.reversedById).toBe('user1')
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      paidAmount: expect.objectContaining({ amount: 0 }),
    }))
  })

  test('cancelPayment cancels payment and decreases paid amount', async () => {
    const { mockRepos, service } = createFinanceContext()

    const result = await service.cancelPayment({
      paymentId: 'pay1',
      cancelledAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Cancelled)
    expect(result.cancelledById).toBe('user1')
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      paidAmount: expect.objectContaining({ amount: 0 }),
    }))
  })

  test('recordPayment rejects cancelled student fees', async () => {
    const { service } = createFinanceContext({ studentFeeStatus: FeeStatus.Cancelled })

    await expect(service.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('reversePayment rejects non-recorded payments', async () => {
    const { service } = createFinanceContext({ paymentStatus: PaymentStatus.Reversed })

    await expect(service.reversePayment({
      paymentId: 'pay1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollStudent creates the first enrollment through managed service', async () => {
    const { mockPolicy, mockRepos, savedEnrollments, service } = createStudentTransitionContext({
      activeEnrollmentId: '',
    })

    const result = await service.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
      createdAt: new Date('2026-01-10T00:00:00Z'),
    })

    expect(result.id).toBe('enr-new')
    expect(result.studentId).toBe('stu1')
    expect(result.classGroupId).toBe('cg1')
    expect(result.academicYearId).toBe('ay1')
    expect(result.enrollmentIndex).toBe(1)
    expect(savedEnrollments.get('enr-new')).toBe(result)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'students.manage_enrollment')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(result)
  })

  test('enrollStudent returns existing active enrollment for the same class group', async () => {
    const { mockRepos, service } = createStudentTransitionContext({
      activeEnrollmentId: 'enr-existing',
      existingEnrollmentClassGroupId: 'cg1',
    })

    const result = await service.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })

    expect(result.id).toBe('enr-existing')
    expect(result.classGroupId).toBe('cg1')
    expect(mockRepos.enrollments.save).not.toHaveBeenCalled()
  })

  test('enrollStudent rejects active enrollment in another class group', async () => {
    const { service } = createStudentTransitionContext({
      activeEnrollmentId: 'enr-existing',
      existingEnrollmentClassGroupId: 'cg2',
    })

    await expect(service.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollStudent rejects inactive students and full class groups', async () => {
    await expect(createStudentTransitionContext({
      activeEnrollmentId: '',
      studentStatus: StudentStatus.Inactive,
    }).service.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(createStudentTransitionContext({
      activeEnrollmentId: '',
      targetCapacity: 1,
      targetActiveEnrollmentCount: 1,
    }).service.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg2',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('linkGuardianToStudent creates a guardian link through managed service', async () => {
    const { mockPolicy, mockRepos, savedLinks, service } = createGuardianLinkContext()

    const result = await service.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'mother',
      isPrimary: true,
      canPickup: true,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    })

    expect(result.id).toBe('link-new')
    expect(result.schoolId).toBe('sch1')
    expect(result.guardianId).toBe('gua1')
    expect(result.studentId).toBe('stu1')
    expect(result.relationship).toBe('mother')
    expect(result.isPrimary).toBe(true)
    expect(result.canPickup).toBe(true)
    expect(savedLinks.get('link-new')).toBe(result)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'students.manage_guardians')
    expect(mockPolicy.checkGuardianAccess).toHaveBeenCalledWith(actor, ['gua1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockRepos.guardianLinks.save).toHaveBeenCalledWith(result)
  })

  test('linkGuardianToStudent reuses existing link id and createdAt', async () => {
    const { existingCreatedAt, mockRepos, service } = createGuardianLinkContext({ existingLink: true })

    const result = await service.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'father',
      isBillingContact: true,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    })

    expect(result.id).toBe('link-existing')
    expect(result.relationship).toBe('father')
    expect(result.isBillingContact).toBe(true)
    expect(result.createdAt).toBe(existingCreatedAt)
    expect(mockRepos.guardianLinks.save).toHaveBeenCalledWith(result)
  })

  test('linkGuardianToStudent rejects missing school enrollment context and school mismatch', async () => {
    await expect(createGuardianLinkContext({
      enrolledInSchool: false,
    }).service.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()

    await expect(createGuardianLinkContext({
      guardianSchoolId: 'sch1',
      studentSchoolId: 'other-school',
    }).service.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()
  })

  test('graduateStudent closes enrollment and graduates the student through managed services', async () => {
    const { mockAtomic, mockRepos, service } = createStudentTransitionContext()

    const result = await service.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
      notes: 'Completed program',
    })

    expect(result.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(result.progressionDecision).toBe(ProgressionDecision.Graduated)
    expect(result.progressionNotes).toBe('Completed program')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.students.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'stu1',
      status: StudentStatus.Graduated,
    }))
  })

  test('graduateStudent rejects inactive current enrollments', async () => {
    const { service } = createStudentTransitionContext({ activeEnrollmentId: 'other-enrollment' })

    await expect(service.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent closes the current enrollment and creates a successor through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createStudentTransitionContext()

    const result = await service.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
      notes: 'Ready',
    })

    expect(result.id).toBe('enr2')
    expect(result.classGroupId).toBe('cg2')
    expect(result.previousEnrollmentId).toBe('enr1')
    expect(result.enrollmentIndex).toBe(2)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'students.manage_enrollment')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg2'])
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'enr1',
      status: StudentClassEnrollmentStatus.Closed,
      endReason: EnrollmentEndReason.Completed,
      progressionDecision: ProgressionDecision.Promoted,
    }))
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(result)
  })

  test('transferStudent closes the current enrollment and creates a successor through managed service', async () => {
    const { mockRepos, service } = createStudentTransitionContext()

    const result = await service.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })

    expect(result.id).toBe('enr2')
    expect(result.classGroupId).toBe('cg2')
    expect(result.previousEnrollmentId).toBe('enr1')
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'enr1',
      status: StudentClassEnrollmentStatus.Closed,
      endReason: EnrollmentEndReason.Transferred,
    }))
    expect(mockRepos.enrollments.save).toHaveBeenCalledWith(result)
  })

  test('transferStudent rejects inactive current enrollments', async () => {
    const { service } = createStudentTransitionContext({ activeEnrollmentId: 'other-enrollment' })

    await expect(service.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('transferStudent rejects same class group successors', async () => {
    const { service } = createStudentTransitionContext({ nextClassGroupId: 'cg1' })

    await expect(service.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent rejects non-advancing grade targets', async () => {
    const { service } = createStudentTransitionContext({ nextGradeOrder: 1 })

    await expect(service.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent rejects full target class groups', async () => {
    const { service } = createStudentTransitionContext({
      targetCapacity: 1,
      targetActiveEnrollmentCount: 1,
    })

    await expect(service.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('addStudentInvolvement persists eligible students through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext()

    const result = await service.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
      notes: 'Student was involved',
    })

    expect(result.incidentId).toBe('inc1')
    expect(result.studentId).toBe('stu1')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentIncidentInvolvements.save).toHaveBeenCalledWith(result)
  })

  test('addStudentInvolvement rejects duplicate student links', async () => {
    const { service } = createBehaviorContext({ existingInvolvement: true })

    await expect(service.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('applyDisciplinaryAction requires an incident involvement and saves through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext({ existingInvolvement: true })

    const result = await service.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
      startsAt: new Date('2026-05-03T00:00:00Z'),
    })

    expect(result.id).toBe('sda1')
    expect(result.schoolId).toBe('sch1')
    expect(result.assignedByStaffId).toBe('user1')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentDisciplinaryActions.save).toHaveBeenCalledWith(result)
  })

  test('applyDisciplinaryAction rejects students without an incident involvement', async () => {
    const { service } = createBehaviorContext()

    await expect(service.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
    })).rejects.toThrow()
  })

  test('generateSessions expands schedules and saves sessions through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          classGroupId: 'cg_daily',
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
          classSubjectId: 'cs1',
        },
        {
          id: 'sched-specific',
          classGroupId: 'cg_daily',
          title: 'Science lab',
          isRecurring: false,
          specificDate: new Date('2026-05-29T00:00:00Z'),
          startTime: '10:00',
          endTime: '11:30',
        },
      ],
    })

    const result = await service.generateSessions({
      classGroupId: 'cg_daily',
      startDate: new Date('2026-05-28T00:00:00Z'),
      endDate: new Date('2026-05-29T00:00:00Z'),
    })

    expect(result).toHaveLength(2)
    expect(result.map(session => session.title)).toEqual(['Math', 'Science lab'])
    expect(result[0]?.scheduleId).toBe('sched-thu')
    expect(result[0]?.startsAt.getHours()).toBe(8)
    expect(result[1]?.scheduleId).toBe('sched-specific')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockRepos.sessions.save).toHaveBeenCalledTimes(2)
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(result[0])
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(result[1])
  })

  test('generateSessions skips non-school days that apply to the class', async () => {
    const { mockRepos, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          classGroupId: 'cg_daily',
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
        },
        {
          id: 'sched-fri',
          classGroupId: 'cg_daily',
          title: 'History',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Friday,
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
      calendarEvents: [
        {
          id: 'holiday-grade',
          schoolId: 'sch1',
          academicYearId: 'ay1',
          title: 'Grade break',
          kind: CalendarEventKind.Break,
          isNonSchoolDay: true,
          scopeKind: CalendarEventScopeKind.GradeLevel,
          scopeId: 'grade1',
          startDate: new Date('2026-05-29T00:00:00Z'),
          endDate: new Date('2026-05-29T00:00:00Z'),
        },
      ],
    })

    const result = await service.generateSessions({
      classGroupId: 'cg_daily',
      startDate: new Date('2026-05-28T00:00:00Z'),
      endDate: new Date('2026-05-29T00:00:00Z'),
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('Math')
    expect(mockRepos.sessions.save).toHaveBeenCalledTimes(1)
  })

  test('recordDailyAttendance creates a daily session and attendance through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, savedSessions, service } = createSchedulingContext()

    const result = await service.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.id).toBe('att1')
    expect(result.sessionId).toBe('daily:cg_daily:2026-05-28')
    expect(savedSessions.has('daily:cg_daily:2026-05-28')).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkAttendanceAccess).toHaveBeenCalledWith(actor, ['stu1'], ['daily:cg_daily:2026-05-28'])
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'daily:cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result)
  })

  test('recordDailyAttendance reuses an existing daily session', async () => {
    const { mockRepos, service } = createSchedulingContext({ existingDailySession: true })

    const result = await service.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.sessionId).toBe('daily:cg_daily:2026-05-28')
    expect(mockRepos.sessions.save).not.toHaveBeenCalled()
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result)
  })

  test('recordDailyAttendance rejects non-daily class groups', async () => {
    const { service } = createSchedulingContext({ classGroupAttendanceMode: AttendanceMode.Session })

    await expect(service.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordSessionAttendance records each student through managed attendance', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.recordSessionAttendance({
      sessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Late },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-ses1')
    expect(result[0]?.status).toBe(AttendanceStatus.Late)
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })

  test('recordClassDailyAttendance records class attendance through a daily session', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-daily:cg_daily:2026-05-28')
    expect(result[0]?.status).toBe(AttendanceStatus.Absent)
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'daily:cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })

  test('publishAnnouncement publishes only announcements with targets through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    const result = await service.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.status).toBe(AnnouncementStatus.Published)
    expect(result.publishedAt?.toISOString()).toBe('2026-05-02T00:00:00.000Z')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'communications.manage')
    expect(mockRepos.announcements.save).toHaveBeenCalledWith(result)
  })

  test('publishAnnouncement rejects announcements without targets', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      targets: [],
    })

    await expect(service.publishAnnouncement({
      announcementId: 'ann1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordDelivery persists eligible recipients through managed service', async () => {
    const { mockRepos, service } = createCommunicationsContext()

    const result = await service.recordDelivery({
      id: 'del1',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.id).toBe('del1')
    expect(result.status).toBe(MessageDeliveryStatus.Sent)
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(result)
  })

  test('recordDelivery rejects recipients outside announcement targets', async () => {
    const { service } = createCommunicationsContext({
      targets: [{ id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff1' }],
    })

    await expect(service.recordDelivery({
      id: 'del1',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('materializeDeliveries expands targets, reuses existing deliveries, and saves missing deliveries', async () => {
    const existing = new MessageDelivery({
      id: 'existing-delivery',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
      channel: MessageDeliveryChannel.Email,
    })
    const { mockAtomic, mockRepos, service } = createCommunicationsContext({ existingDelivery: existing })

    const result = await service.materializeDeliveries({
      announcementId: 'ann1',
      channel: MessageDeliveryChannel.Email,
      createdAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.map(delivery => delivery.id)).toEqual([
      'existing-delivery',
      'generated:ann1:email:staff:staff1',
      'generated:ann1:email:student:stu1',
    ])
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledTimes(2)
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated:ann1:email:staff:staff1',
    }))
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated:ann1:email:student:stu1',
    }))
  })

  test('materializeDeliveries rejects unpublished announcements', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(service.materializeDeliveries({
      announcementId: 'ann1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

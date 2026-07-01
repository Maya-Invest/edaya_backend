import type { AuthorizationPolicy } from '../../../src/capabilities/authorization'
import type {
  AttendanceRecord,
  MessageDelivery,
} from '../../../src/domain'
import type { AtomicExecutionPort, NotificationGatewayPort, SchoolRepositories } from '../../../src/ports'
import { mock } from 'bun:test'
import {
  AcademicYear,
  Announcement,
  AnnouncementStatus,
  AssessmentKind,
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceStatus,
  EnrollmentEndReason,
  Fee,
  FeeCategory,
  FeeStatus,
  GuardianStudentLink,
  IncidentInvolvementRole,
  IncidentKind,
  IncidentStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ReportCardDefinitionSectionKind,
  SessionKind,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryActionStatus,
  StudentFee,
  StudentStatus,
  AnnouncementTargetKind as TargetKind,
} from '../../../src/domain'
import { noOpNotificationGateway } from '../../../src/adapters'
import { SchoolService } from '../../../src/application'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

export const actor = createElevatedTestStaffActor('sch1', 'user1')

export function createContext({
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
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, service }
}

export function createSetupContext() {
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
  } as unknown as AuthorizationPolicy

  const mockAtomic: AtomicExecutionPort = {
    execute: mock(async (operation: () => Promise<any>) => operation()),
  }

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  return { academicYears, mockAtomic, mockPolicy, mockRepos, service }
}

export function createReportCardContext({
  existingReportCard,
  notificationGateway = noOpNotificationGateway,
}: {
  existingReportCard?: any
  notificationGateway?: NotificationGatewayPort
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
      findById: mock(async () => undefined),
      list: mock(async () => [{ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }]),
      save: mock(async (result: any) => result),
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
      findOne: mock(async () => ({ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active })),
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
        subjectId: 'subject-stu1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        status: StudentStatus.Active,
        createdAt: new Date('2025-09-01T00:00:00Z'),
      })),
      save: mock(async () => {}),
    },
    guardianLinks: {
      list: mock(async (filter: any = {}) => {
        if (filter.studentId === 'stu1') {
          return [{ schoolId: 'sch1', studentId: 'stu1', guardianId: 'gua1', receivesAcademicReports: true }]
        }
        return []
      }),
    },
    guardians: {
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        subjectId: 'subject-gua1',
        firstName: 'Grace',
        lastName: 'Hopper',
        contactMethods: [],
      })),
    },
    messageDeliveries: {
      findById: mock(async () => undefined),
      save: mock(async () => {}),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    checkAssessmentAccess: mock(async () => {}),
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
    notificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, savedReportCards, service }
}

export function createFinanceContext({
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
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, service }
}

export function createStudentTransitionContext({
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
  const seededActiveEnrollment = () => activeEnrollmentId
    ? {
        id: activeEnrollmentId,
        studentId: 'stu1',
        classGroupId: existingEnrollmentClassGroupId,
        academicYearId: existingEnrollmentClassGroupId === 'cg2' ? 'ay2' : 'ay1',
        status: StudentClassEnrollmentStatus.Active,
        enrollmentIndex: 1,
      }
    : undefined
  const currentEnrollments = () => {
    const seeded = seededActiveEnrollment()
    const persisted = [...savedEnrollments.values()]
    return seeded && !savedEnrollments.has(seeded.id) ? [...persisted, seeded] : persisted
  }
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
        const saved = savedEnrollments.get(id)
        if (saved)
          return saved
        if (id === 'enr1')
          return sourceEnrollment
        if (id === 'enr2' && existingSuccessor)
          return successorEnrollment
        return undefined
      }),
      findOne: mock(async (filter = {}) => {
        const enrollments = currentEnrollments()
        return enrollments.find(enrollment =>
          (!filter.studentId || enrollment.studentId === filter.studentId)
          && (!filter.classGroupId || enrollment.classGroupId === filter.classGroupId)
          && (!filter.status || enrollment.status === filter.status))
      }),
      list: mock(async (filter) => {
        const enrollments = currentEnrollments()
        if (filter?.studentId === 'stu1') {
          return enrollments.filter(enrollment =>
            enrollment.studentId === 'stu1'
            && (!filter.classGroupId || enrollment.classGroupId === filter.classGroupId)
            && (!filter.status || enrollment.status === filter.status))
        }
        if (filter?.classGroupId === 'cg2') {
          const targetEnrollments = Array.from({ length: targetActiveEnrollmentCount }, (_, index) => ({
            id: `target-active-${index + 1}`,
            studentId: `student-${index + 1}`,
            classGroupId: 'cg2',
            status: StudentClassEnrollmentStatus.Active,
            enrollmentIndex: 1,
          }))
          return [
            ...targetEnrollments,
            ...enrollments.filter(enrollment =>
              enrollment.classGroupId === 'cg2'
              && (!filter.status || enrollment.status === filter.status)),
          ]
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
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, savedEnrollments, service }
}

export function createGuardianLinkContext({
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
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  return { existingCreatedAt, mockPolicy, mockRepos, savedLinks, service }
}

export function createSchedulingContext({
  classGroupAttendanceMode = AttendanceMode.Daily,
  existingAttendance,
  existingDailySession = false,
  activeEnrollment = true,
  schedules = [],
  calendarEvents = [],
  notificationGateway = noOpNotificationGateway,
}: {
  classGroupAttendanceMode?: AttendanceMode
  existingAttendance?: AttendanceRecord
  existingDailySession?: boolean
  activeEnrollment?: boolean
  schedules?: any[]
  calendarEvents?: any[]
  notificationGateway?: NotificationGatewayPort
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
      findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1', subjectId: 'subject:stu1' })),
    },
    schools: {
      findById: mock(async () => ({ id: 'sch1', name: 'School' })),
    },
    guardianLinks: {
      list: mock(async (filter: any = {}) => {
        if (filter.studentId === 'stu1') {
          return [{ studentId: 'stu1', guardianId: 'gua1', receivesAttendanceAlerts: true }]
        }
        return []
      }),
    },
    guardians: {
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        subjectId: `subject:${id}`,
        firstName: 'Grace',
        lastName: 'Hopper',
        contactMethods: [],
      })),
    },
    messageDeliveries: {
      findById: mock(async () => undefined),
      save: mock(async () => {}),
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
    notificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, savedAttendance, savedSessions, service }
}

export function createCommunicationsContext({
  announcementStatus = AnnouncementStatus.Published,
  expiresAt,
  targets = [
    { id: 'target-students', announcementId: 'ann1', targetKind: TargetKind.AllStudents },
    { id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' },
    { id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff1' },
  ],
  existingDelivery,
  notificationGateway = noOpNotificationGateway,
}: {
  announcementStatus?: AnnouncementStatus
  expiresAt?: Date
  targets?: Array<{ id: string, announcementId: string, targetKind: TargetKind, targetId?: string }>
  existingDelivery?: MessageDelivery
  notificationGateway?: NotificationGatewayPort
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
    expiresAt,
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
      findById: mock(async id => ({ id, schoolId: 'sch1', subjectId: `subject:${id}` })),
      list: mock(async () => [{ id: 'gua1', schoolId: 'sch1', subjectId: 'subject:gua1' }]),
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
        && (!filter.subjectId || delivery.subjectId === filter.subjectId)
        && (!filter.recipientKind || delivery.recipientKind === filter.recipientKind)
        && (!filter.recipientId || delivery.recipientId === filter.recipientId))),
      save: mock(async delivery => savedDeliveries.set(delivery.id, delivery)),
    },
    staffMembers: {
      findById: mock(async id => ({ id, schoolId: 'sch1', subjectId: `subject:${id}` })),
      list: mock(async () => [{ id: 'staff1', schoolId: 'sch1', subjectId: 'subject:staff1' }]),
    },
    students: {
      findById: mock(async id => ({ id, schoolId: 'sch1', subjectId: `subject:${id}` })),
      list: mock(async () => [{ id: 'stu1', schoolId: 'sch1', subjectId: 'subject:stu1' }]),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
  } as unknown as AuthorizationPolicy

  const mockAtomic: AtomicExecutionPort = {
    execute: mock(async (operation: () => Promise<any>) => operation()),
  }

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
    notificationGateway,
    fileStorage: testFileStorage,
  })

  return { mockAtomic, mockPolicy, mockRepos, savedAnnouncements, savedDeliveries, service }
}

export function createBehaviorContext({
  existingInvolvement = false,
  activeEnrollment = true,
  incidentStatus = IncidentStatus.Open,
  catalogActionSchoolId = 'sch1',
  notificationGateway = noOpNotificationGateway,
}: {
  existingInvolvement?: boolean
  activeEnrollment?: boolean
  incidentStatus?: IncidentStatus
  catalogActionSchoolId?: string
  notificationGateway?: NotificationGatewayPort
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
      findById: mock(async id => ({ id, schoolId: 'sch1', subjectId: `subject:${id}` })),
    },
    guardianLinks: {
      list: mock(async (filter: any = {}) => {
        if (filter.studentId === 'stu1') {
          return [{ studentId: 'stu1', guardianId: 'gua1' }]
        }
        return []
      }),
    },
    guardians: {
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        subjectId: `subject:${id}`,
        contactMethods: [],
      })),
    },
    messageDeliveries: {
      findById: mock(async () => undefined),
      save: mock(async () => {}),
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
    notificationGateway,
    fileStorage: testFileStorage,
  })

  return { disciplinaryActions, incidents, involvements, mockAtomic, mockPolicy, mockRepos, service }
}

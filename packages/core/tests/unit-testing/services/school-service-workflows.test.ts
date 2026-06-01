import type { AtomicExecutionPort, SchoolRepositories } from '../../../src/ports'
import type { ActorMetadata, AuthorizationPolicy } from '../../../src/services/authorization'
import { describe, expect, mock, test } from 'bun:test'
import {
  AssessmentKind,
  AttendanceJustificationStatus,
  AttendanceStatus,
  EnrollmentEndReason,
  Fee,
  FeeCategory,
  FeeStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ProgressionDecision,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentFee,
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

  function createReportCardContext({
    existingReportCard,
  }: {
    existingReportCard?: unknown
  } = {}) {
    const periodStart = new Date('2026-01-01T00:00:00Z')
    const periodEnd = new Date('2026-03-31T00:00:00Z')
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
        findById: mock(async () => undefined),
        findOne: mock(async () => existingReportCard),
        save: mock(async () => {}),
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
        findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })),
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

    return { mockAtomic, mockPolicy, mockRepos, service }
  }

  function createFinanceContext({
    studentFeeStatus = FeeStatus.Partial,
    paymentStatus = PaymentStatus.Recorded,
  }: {
    studentFeeStatus?: FeeStatus
    paymentStatus?: PaymentStatus
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
      paidAmount: 400,
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
        findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })),
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
    sourceStatus = StudentClassEnrollmentStatus.Active,
    nextClassGroupId = 'cg2',
    sourceGradeOrder = 1,
    nextGradeOrder = 2,
    targetCapacity = 30,
    targetActiveEnrollmentCount = 0,
    existingSuccessor = false,
  }: {
    activeEnrollmentId?: string
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
          ? { id: activeEnrollmentId, studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active }
          : undefined),
        list: mock(async (filter) => {
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
        save: mock(async () => {}),
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
        findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })),
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

    return { mockAtomic, mockPolicy, mockRepos, service }
  }

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
})

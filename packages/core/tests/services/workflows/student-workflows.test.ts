import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  EnrollmentEndReason,
  ProgressionDecision,
  StudentClassEnrollmentStatus,
  StudentStatus,
} from '../../../src/entities'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createGuardianLinkContext,
  createStudentTransitionContext,
} from './workflow-test-context'

describe('SchoolService student workflows', () => {
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

import { AuthorizationError } from '@edaya/authorization'
import { BusinessRuleViolationError, EnrollmentEndReason, GuardianStudentLink, ProgressionDecision, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentNoteCategory, StudentNoteVisibility, StudentStatus } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  actor,
  createGuardianLinkContext,
  createStudentAdminContext,
  createStudentTransitionContext,
} from './workflow-test-context'

describe('SchoolService student workflows', () => {
  test('enrollStudent creates the first enrollment through managed service', async () => {
    const { mockPolicy, mockRepos, savedEnrollments, service } = createStudentTransitionContext({
      activeEnrollmentId: '',
    })

    const result = await service.studentWorkflow.enrollStudent({
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

    const result = await service.studentWorkflow.enrollStudent({
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

    await expect(service.studentWorkflow.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollStudent rejects inactive students and full class groups', async () => {
    await expect(createStudentTransitionContext({
      activeEnrollmentId: '',
      studentStatus: StudentStatus.Inactive,
    }).service.studentWorkflow.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(createStudentTransitionContext({
      activeEnrollmentId: '',
      targetCapacity: 1,
      targetActiveEnrollmentCount: 1,
    }).service.studentWorkflow.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg2',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('linkGuardianToStudent creates a guardian link through managed service', async () => {
    const { mockPolicy, mockRepos, savedLinks, service } = createGuardianLinkContext()

    const result = await service.studentWorkflow.linkGuardianToStudent({
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

    const result = await service.studentWorkflow.linkGuardianToStudent({
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
    }).service.studentWorkflow.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()

    await expect(createGuardianLinkContext({
      guardianSchoolId: 'sch1',
      studentSchoolId: 'other-school',
    }).service.studentWorkflow.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()
  })

  test('graduateStudent closes enrollment and graduates the student through managed services', async () => {
    const { mockAtomic, mockRepos, service } = createStudentTransitionContext()

    const result = await service.studentWorkflow.graduateStudent({
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

    await expect(service.studentWorkflow.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent closes the current enrollment and creates a successor through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createStudentTransitionContext()

    const result = await service.studentWorkflow.promoteStudent({
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

    const result = await service.studentWorkflow.transferStudent({
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

    await expect(service.studentWorkflow.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('transferStudent rejects same class group successors', async () => {
    const { service } = createStudentTransitionContext({ nextClassGroupId: 'cg1' })

    await expect(service.studentWorkflow.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent rejects non-advancing grade targets', async () => {
    const { service } = createStudentTransitionContext({ nextGradeOrder: 1 })

    await expect(service.studentWorkflow.promoteStudent({
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

    await expect(service.studentWorkflow.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('registerStudent skips auto-invite when explicitly disabled', async () => {
    const { students, service } = createStudentAdminContext({
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const student = await service.studentWorkflow.registerStudent({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'New',
      lastName: 'Student',
      birthDate: new Date('2011-01-01'),
      sendAccountInvitation: false,
    })

    expect(student.id).toBe('stu-new')
    expect(students.store.get('stu-new')).toBeDefined()
  })

  test('registerStudent rejects missing inviteEmail when auto-invite is enabled', async () => {
    const { service } = createStudentAdminContext({
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await expect(service.studentWorkflow.registerStudent({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'New',
      lastName: 'Student',
      birthDate: new Date('2011-01-01'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('registerGuardian persists guardian records', async () => {
    const { guardians, service } = createStudentAdminContext()

    const guardian = await service.studentWorkflow.registerGuardian({
      id: 'gua-new',
      schoolId: 'sch1',
      firstName: 'Alan',
      lastName: 'Turing',
      sendAccountInvitation: false,
    })

    expect(guardian.id).toBe('gua-new')
    expect(guardians.store.get('gua-new')).toBeDefined()
  })

  test('closeEnrollment closes active enrollments', async () => {
    const { enrollments, service } = createStudentAdminContext()

    const closed = await service.studentWorkflow.closeEnrollment({
      enrollmentId: 'enr1',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date('2026-06-01T00:00:00Z'),
    })

    expect(closed.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(closed.endReason).toBe(EnrollmentEndReason.Withdrawn)
    expect(enrollments.store.get('enr1')?.status).toBe(StudentClassEnrollmentStatus.Closed)
  })

  test('recordProgressionDecision records retained decisions on completed enrollments', async () => {
    const { enrollments, service } = createStudentAdminContext()
    enrollments.store.set('enr1', new StudentClassEnrollment({
      id: 'enr1',
      studentId: 'stu1',
      classGroupId: 'cg1',
      academicYearId: 'ay1',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: new Date('2025-09-01T00:00:00Z'),
      endedAt: new Date('2026-06-01T00:00:00Z'),
      endReason: EnrollmentEndReason.Completed,
      closedBy: 'user1',
    }))

    const decided = await service.studentWorkflow.recordProgressionDecision({
      enrollmentId: 'enr1',
      decision: ProgressionDecision.Retained,
      decidedAt: new Date('2026-06-02T00:00:00Z'),
      notes: 'Needs support',
    })

    expect(decided.progressionDecision).toBe(ProgressionDecision.Retained)
    expect(decided.progressionNotes).toBe('Needs support')
  })

  test('updateStudentProfile and updateStudentStatus persist student changes', async () => {
    const { students, service } = createStudentAdminContext()

    const profile = await service.studentWorkflow.updateStudentProfile({
      studentId: 'stu1',
      firstName: 'Augusta',
    })
    const status = await service.studentWorkflow.updateStudentStatus({
      studentId: 'stu1',
      status: StudentStatus.Inactive,
    })

    expect(profile.firstName).toBe('Augusta')
    expect(status.status).toBe(StudentStatus.Inactive)
    expect(students.store.get('stu1')?.firstName).toBe('Augusta')
    expect(students.store.get('stu1')?.status).toBe(StudentStatus.Inactive)
  })

  test('upsertStudentHealthProfile and student notes persist student records', async () => {
    const { studentHealthProfiles, studentNotes, service } = createStudentAdminContext()

    const healthProfile = await service.studentWorkflow.upsertStudentHealthProfile({
      id: 'health-1',
      studentId: 'stu1',
      allergies: 'Peanuts',
    })
    const note = await service.studentWorkflow.createStudentNote({
      id: 'note-1',
      studentId: 'stu1',
      title: 'Progress check',
      body: 'Strong improvement in math.',
      category: StudentNoteCategory.Progress,
      visibility: StudentNoteVisibility.Staff,
    })
    const updatedNote = await service.studentWorkflow.updateStudentNote({
      noteId: 'note-1',
      body: 'Strong improvement in math and science.',
    })

    expect(healthProfile.allergies).toBe('Peanuts')
    expect(studentHealthProfiles.store.get('health-1')).toBeDefined()
    expect(note.body).toBe('Strong improvement in math.')
    expect(updatedNote.body).toBe('Strong improvement in math and science.')
    expect(studentNotes.store.get('note-1')?.body).toBe('Strong improvement in math and science.')
  })

  test('updateGuardianContactMethods and updateGuardianStudentLink persist guardian relationships', async () => {
    const { guardianLinks, guardians, service } = createStudentAdminContext()
    guardianLinks.store.set('link-1', new GuardianStudentLink({
      id: 'link-1',
      schoolId: 'sch1',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'parent',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const guardian = await service.studentWorkflow.updateGuardianContactMethods({
      guardianId: 'gua1',
      firstName: 'Grace',
      lastName: 'Brewster',
    })
    const link = await service.studentWorkflow.updateGuardianStudentLink({
      guardianId: 'gua1',
      studentId: 'stu1',
      receivesAcademicReports: false,
      relationship: 'mother',
    })

    expect(guardian.lastName).toBe('Brewster')
    expect(link.receivesAcademicReports).toBe(false)
    expect(link.relationship).toBe('mother')
    expect(guardians.store.get('gua1')?.lastName).toBe('Brewster')
    expect(guardianLinks.store.get('link-1')?.receivesAcademicReports).toBe(false)
  })

  test('enrollStudent rejects cross-school class groups', async () => {
    const { service } = createStudentAdminContext()

    await expect(service.studentWorkflow.enrollStudent({
      id: 'enr-cross',
      studentId: 'stu1',
      classGroupId: 'cg-other',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('promoteStudent rejects pre-existing successor enrollment ids', async () => {
    const transition = createStudentTransitionContext({ existingSuccessor: true })

    await expect(transition.service.studentWorkflow.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

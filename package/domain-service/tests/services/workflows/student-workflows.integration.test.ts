import { AuthorizationError } from '@edaya/authorization'
import { BusinessRuleViolationError, EnrollmentEndReason, GuardianStudentLink, ProgressionDecision, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentNoteCategory, StudentNoteVisibility, StudentStatus } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { humanFixture } from '../../../../../tooling/test-support/human-fixtures'
import {
  createGuardianLinkContext,
  createStudentAdminContext,
  createStudentTransitionContext,
} from './student-workflow-context'

describe('SchoolService student workflows', () => {
  test('enrollStudent creates the first enrollment through managed service', async () => {
    const { repositories, service } = await createStudentTransitionContext({
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
    expect((await repositories.enrollments.findById(result.id))?.data).toEqual(result.data)
  })

  test('enrollStudent returns existing active enrollment for the same class group', async () => {
    const { repositories, service } = await createStudentTransitionContext({
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
    expect(await repositories.enrollments.findById('enr-new')).toBeUndefined()
  })

  test('enrollStudent rejects active enrollment in another class group', async () => {
    const { service } = await createStudentTransitionContext({
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
    await expect((await createStudentTransitionContext({
      activeEnrollmentId: '',
      studentStatus: StudentStatus.Inactive,
    })).service.studentWorkflow.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect((await createStudentTransitionContext({
      activeEnrollmentId: '',
      targetCapacity: 1,
      targetActiveEnrollmentCount: 1,
    })).service.studentWorkflow.enrollStudent({
      id: 'enr-new',
      studentId: 'stu1',
      classGroupId: 'cg2',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('linkGuardianToStudent creates a guardian link through managed service', async () => {
    const { repositories, service } = await createGuardianLinkContext()

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
    expect((await repositories.guardianLinks.findById(result.id))?.data).toEqual(result.data)
  })

  test('linkGuardianToStudent reuses existing link id and createdAt', async () => {
    const { existingCreatedAt, repositories, service } = await createGuardianLinkContext({ existingLink: true })

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
    expect(result.createdAt).toEqual(existingCreatedAt)
    expect((await repositories.guardianLinks.findById(result.id))?.data).toEqual(result.data)
  })

  test('linkGuardianToStudent rejects missing school enrollment context and school mismatch', async () => {
    await expect((await createGuardianLinkContext({
      enrolledInSchool: false,
    })).service.studentWorkflow.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()

    await expect((await createGuardianLinkContext({
      guardianSchoolId: 'sch1',
      studentSchoolId: 'other-school',
    })).service.studentWorkflow.linkGuardianToStudent({
      id: 'link-new',
      guardianId: 'gua1',
      studentId: 'stu1',
    })).rejects.toThrow()
  })

  test('graduateStudent closes enrollment and graduates the student through managed services', async () => {
    const { repositories, service } = await createStudentTransitionContext()

    const result = await service.studentWorkflow.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
      notes: 'Completed program',
    })

    expect(result.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(result.progressionDecision).toBe(ProgressionDecision.Graduated)
    expect(result.progressionNotes).toBe('Completed program')
    expect((await repositories.enrollments.findById(result.id))?.data).toEqual(result.data)
    expect(await repositories.students.findById('stu1')).toMatchObject({
      status: StudentStatus.Graduated,
    })
  })

  test('graduateStudent rejects inactive current enrollments', async () => {
    const { service } = await createStudentTransitionContext({ activeEnrollmentId: 'other-enrollment' })

    await expect(service.studentWorkflow.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent closes the current enrollment and creates a successor through managed service', async () => {
    const { repositories, service } = await createStudentTransitionContext()

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
    expect(await repositories.enrollments.findById('enr1')).toMatchObject({
      status: StudentClassEnrollmentStatus.Closed,
      endReason: EnrollmentEndReason.Completed,
      progressionDecision: ProgressionDecision.Promoted,
    })
    expect((await repositories.enrollments.findById(result.id))?.data).toEqual(result.data)
  })

  test('transferStudent closes the current enrollment and creates a successor through managed service', async () => {
    const { repositories, service } = await createStudentTransitionContext()

    const result = await service.studentWorkflow.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })

    expect(result.id).toBe('enr2')
    expect(result.classGroupId).toBe('cg2')
    expect(result.previousEnrollmentId).toBe('enr1')
    expect(await repositories.enrollments.findById('enr1')).toMatchObject({
      status: StudentClassEnrollmentStatus.Closed,
      endReason: EnrollmentEndReason.Transferred,
    })
    expect((await repositories.enrollments.findById(result.id))?.data).toEqual(result.data)
  })

  test('transferStudent rejects inactive current enrollments', async () => {
    const { service } = await createStudentTransitionContext({ activeEnrollmentId: 'other-enrollment' })

    await expect(service.studentWorkflow.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('transferStudent rejects same class group successors', async () => {
    const { service } = await createStudentTransitionContext({ nextClassGroupId: 'cg1' })

    await expect(service.studentWorkflow.transferStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg1',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent rejects non-advancing grade targets', async () => {
    const { service } = await createStudentTransitionContext({ nextGradeOrder: 1 })

    await expect(service.studentWorkflow.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('promoteStudent rejects full target class groups', async () => {
    const { service } = await createStudentTransitionContext({
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
    const { students, service } = await createStudentAdminContext({
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const student = await humanFixture({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'New',
      lastName: 'Student',
      birthDate: new Date('2011-01-01'),
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerStudent(prepared))

    expect(student.id).toBe('stu-new')
    expect((await students.findById('stu-new'))).toBeDefined()
  })

  test('registerStudent rejects missing inviteEmail when auto-invite is enabled', async () => {
    const { service } = await createStudentAdminContext({
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await expect(humanFixture({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'New',
      lastName: 'Student',
      birthDate: new Date('2011-01-01'),
    }).then(prepared => service.studentWorkflow.registerStudent(prepared))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('registerGuardian persists guardian records', async () => {
    const { guardians, service } = await createStudentAdminContext()

    const guardian = await humanFixture({
      id: 'gua-new',
      schoolId: 'sch1',
      firstName: 'Alan',
      lastName: 'Turing',
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerGuardian(prepared))

    expect(guardian.id).toBe('gua-new')
    expect((await guardians.findById('gua-new'))).toBeDefined()
  })

  test('registerGuardian persists identifiers and rejects changed creation retries', async () => {
    const { guardians, service } = await createStudentAdminContext()

    const created = await humanFixture({
      id: 'gua-coded',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      identifier: 'GRD-001',
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerGuardian(prepared))

    expect(created.identifier).toBe('GRD-001')
    expect((await guardians.findById('gua-coded'))?.identifier).toBe('GRD-001')

    await expect(humanFixture({
      id: 'gua-coded',
      schoolId: 'sch1',
      firstName: 'Other',
      lastName: 'Guardian',
      identifier: 'GRD-002',
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerGuardian(prepared))).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })

    expect((await guardians.findById('gua-coded'))).toMatchObject({
      firstName: 'Grace',
      lastName: 'Hopper',
      identifier: 'GRD-001',
    })
  })

  test('registerStudent rejects an existing id', async () => {
    const { students, service } = await createStudentAdminContext({
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await humanFixture({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'New',
      lastName: 'Student',
      birthDate: new Date('2011-01-01'),
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerStudent(prepared))

    await expect(humanFixture({
      id: 'stu-new',
      schoolId: 'sch1',
      firstName: 'Other',
      lastName: 'Student',
      birthDate: new Date('2012-01-01'),
      sendAccountInvitation: false,
    }).then(prepared => service.studentWorkflow.registerStudent(prepared))).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })

    expect((await students.findById('stu-new'))).toMatchObject({
      firstName: 'New',
      lastName: 'Student',
    })
  })

  test('closeEnrollment closes active enrollments', async () => {
    const { enrollments, service } = await createStudentAdminContext()

    const closed = await service.studentWorkflow.closeEnrollment({
      enrollmentId: 'enr1',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date('2026-06-01T00:00:00Z'),
    })

    expect(closed.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(closed.endReason).toBe(EnrollmentEndReason.Withdrawn)
    expect((await enrollments.findById('enr1'))?.status).toBe(StudentClassEnrollmentStatus.Closed)
  })

  test('recordProgressionDecision records retained decisions on completed enrollments', async () => {
    const { enrollments, service } = await createStudentAdminContext()
    await enrollments.save(new StudentClassEnrollment({
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
    const { students, service } = await createStudentAdminContext()

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
    expect((await students.findById('stu1'))?.firstName).toBe('Augusta')
    expect((await students.findById('stu1'))?.status).toBe(StudentStatus.Inactive)
  })

  test('upsertStudentHealthProfile and student notes persist student records', async () => {
    const { studentHealthProfiles, studentNotes, service } = await createStudentAdminContext()

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
    expect((await studentHealthProfiles.findById('health-1'))).toBeDefined()
    expect(note.body).toBe('Strong improvement in math.')
    expect(updatedNote.body).toBe('Strong improvement in math and science.')
    expect((await studentNotes.findById('note-1'))?.body).toBe('Strong improvement in math and science.')
  })

  test('updateGuardianProfile and updateGuardianStudentLink persist guardian relationships', async () => {
    const { guardianLinks, guardians, service } = await createStudentAdminContext()
    await guardianLinks.save(new GuardianStudentLink({
      id: 'link-1',
      schoolId: 'sch1',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'parent',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const guardian = await service.studentWorkflow.updateGuardianProfile({
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
    expect((await guardians.findById('gua1'))?.lastName).toBe('Brewster')
    expect((await guardianLinks.findById('link-1'))?.receivesAcademicReports).toBe(false)
  })

  test('enrollStudent rejects cross-school class groups', async () => {
    const { service } = await createStudentAdminContext()

    await expect(service.studentWorkflow.enrollStudent({
      id: 'enr-cross',
      studentId: 'stu1',
      classGroupId: 'cg-other',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('promoteStudent rejects pre-existing successor enrollment ids', async () => {
    const transition = await createStudentTransitionContext({ existingSuccessor: true })

    await expect(transition.service.studentWorkflow.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date('2026-07-01T00:00:00Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

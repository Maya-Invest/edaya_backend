import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { Guardian } from '../../../../src/entities/students/guardian'
import { Student } from '../../../../src/entities/students/student'
import { EnrollmentEndReason, ProgressionDecision, StudentClassEnrollmentStatus } from '../../../../src/entities/students/student-class-enrollment'
import { StudentNoteVisibility } from '../../../../src/entities/students/student-note'
import { StudentsService } from '../../../../src/services/modules/student'

describe('StudentsService', () => {
  const mockRepos = {
    students: {
      save: mock(async () => {}),
      findById: mock(async (id) => {
        if (id === 'stu1') {
          return new Student({ id, schoolId: 'sch1', firstName: 'F', lastName: 'L', birthDate: new Date(), gender: 'Male' })
        }
        return undefined
      }),
    },
    guardians: {
      save: mock(async () => {}),
      findById: mock(async (id) => {
        if (id === 'gua1') {
          return new Guardian({ id, schoolId: 'sch1', firstName: 'F', lastName: 'L', email: 'e@m.c' })
        }
        return undefined
      }),
    },
    guardianLinks: {
      save: mock(async () => {}),
      findOne: mock(async () => undefined),
    },
    enrollments: {
      save: mock(async () => {}),
      findOne: mock(async () => ({ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active, close: mock(() => ({ id: 'enr1', status: StudentClassEnrollmentStatus.Closed, recordProgressionDecision: mock(() => ({ id: 'enr1', status: StudentClassEnrollmentStatus.Closed })) })) })),
      findById: mock(async (id) => {
        if (id === 'enr1')
          return { id, studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active, close: mock(() => ({ id: 'enr1', status: StudentClassEnrollmentStatus.Closed, recordProgressionDecision: mock(() => ({ id: 'enr1', status: StudentClassEnrollmentStatus.Closed })) })), recordProgressionDecision: mock(() => ({ id: 'enr1', status: StudentClassEnrollmentStatus.Closed })) }
        return undefined
      }),
      list: mock(async () => [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: StudentClassEnrollmentStatus.Active, enrollmentIndex: 1 }]),
    },
    studentNotes: {
      save: mock(async () => {}),
    },
    classGroups: {
      findById: mock(async id => ({ id, schoolId: 'sch1', academicYearId: 'ay1', capacity: 30, gradeLevelId: id === 'cg2' ? 'gl2' : 'gl1' })),
    },
    gradeLevels: {
      findById: mock(async id => ({ id, order: id === 'gl2' ? 2 : 1 })),
    },
    studentHealthProfiles: {
      save: mock(async () => {}),
      list: mock(async () => []),
      findById: mock(async () => undefined),
    },
    schools: {
      findById: mock(async id => ({ id })),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = { requirePermission: mock(async () => {}) } as unknown as AuthorizationPolicy
  const mockAtomic: AtomicExecutionPort = { execute: mock(async (op: () => Promise<any>) => op()) }
  const actor: any = { actorId: 'user1', schoolId: 'sch1', role: 'Staff', kind: 'staff', staffMemberId: 'staff1' }

  const service = new StudentsService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor, atomicExecution: mockAtomic } as any)

  test('registerStudent succeeds', async () => {
    const res = await service.registerStudent({
      id: 'new_stu',
      schoolId: 'sch1',
      firstName: 'F',
      lastName: 'L',
      birthDate: new Date(),
    })
    expect(res.id).toBe('new_stu')
  })

  test('enrollStudent succeeds', async () => {
    const res = await service.enrollStudent({
      id: 'enr1',
      studentId: 'stu1',
      classGroupId: 'cg1',
    })
    expect(res.id).toBe('enr1')
  })

  test('linkGuardianToStudent succeeds', async () => {
    const res = await service.linkGuardianToStudent({
      id: 'link1',
      studentId: 'stu1',
      guardianId: 'gua1',
      relationship: 'parent',
      isPrimary: true,
      canPickup: true,
    })
    expect(res.studentId).toBe('stu1')
    expect(res.guardianId).toBe('gua1')
  })

  test('transferStudent succeeds', async () => {
    const args = {
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date(),
    }
    const res = await service.transferStudent(args)
    expect(res.studentId).toBe('stu1')
  })

  test('graduateStudent succeeds', async () => {
    const res = await service.graduateStudent({
      enrollmentId: 'enr1',
      effectiveAt: new Date(),
    })
    expect(res.id).toBe('enr1')
  })

  test('closeEnrollment succeeds', async () => {
    const res = await service.closeEnrollment({
      enrollmentId: 'enr1',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date(),
    })
    expect(res.id).toBe('enr1')
  })

  test('recordProgressionDecision succeeds', async () => {
    const res = await service.recordProgressionDecision({
      enrollmentId: 'enr1',
      decision: ProgressionDecision.Promoted,
      decidedAt: new Date(),
      notes: 'Good job',
    })
    expect(res.id).toBe('enr1')
  })

  test('createStudentNote succeeds', async () => {
    const res = await service.createStudentNote({
      id: 'note1',
      studentId: 'stu1',
      title: 'Note',
      body: 'Content',
      visibility: StudentNoteVisibility.Staff,
    })
    expect(res.id).toBe('note1')
  })

  test('promoteStudent succeeds', async () => {
    const res = await service.promoteStudent({
      enrollmentId: 'enr1',
      nextEnrollmentId: 'enr2',
      nextClassGroupId: 'cg2',
      effectiveAt: new Date(),
    })
    expect(res.studentId).toBe('stu1')
  })

  test('upsertStudentHealthProfile succeeds', async () => {
    const res = await service.upsertStudentHealthProfile({
      id: 'hp1',
      studentId: 'stu1',
      bloodType: 'O+',
      allergies: 'Peanuts',
      medicalConditions: 'None',
      emergencyProtocols: 'None',
    })
    expect(res.studentId).toBe('stu1')
  })
})

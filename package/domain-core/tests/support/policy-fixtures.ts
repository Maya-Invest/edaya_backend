import type { SchoolRepositories } from '../../src/ports'
import { mock } from 'bun:test'
import { StudentClassEnrollmentStatus } from '../../src/domain'

export function enrollmentRepos(classGroupId = 'class-1'): SchoolRepositories {
  return {
    enrollments: {
      list: mock(async (filter: { studentId?: { $in?: string[] } } = {}) => {
        const studentIds = filter.studentId?.$in ?? []
        return studentIds.map(studentId => ({
          id: `enrollment-${studentId}`,
          studentId,
          classGroupId,
          status: StudentClassEnrollmentStatus.Active,
        }))
      }),
      findById: mock(async (id: string) => ({
        id,
        studentId: 'student-1',
        classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })),
    },
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId })),
      ),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
  } as unknown as SchoolRepositories
}

export function feeCatalogRepos(
  feeLinks: Readonly<Record<string, readonly string[]>>,
  baseRepos: SchoolRepositories = enrollmentRepos(),
): SchoolRepositories {
  return {
    ...baseRepos,
    studentFees: {
      list: mock(async (filter: { feeId?: string } = {}) => {
        const feeId = filter.feeId
        if (!feeId) {
          return []
        }
        const studentIds = feeLinks[feeId] ?? []
        return studentIds.map(studentId => ({
          id: `student-fee-${feeId}-${studentId}`,
          feeId,
          studentId,
        }))
      }),
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({
          id,
          feeId: 'fee-1',
          studentId: id.includes('student-2') ? 'student-2' : 'student-1',
        })),
      ),
    },
  } as unknown as SchoolRepositories
}

export function paymentAttachmentRepos(
  payment: { id: string, studentFeeId: string },
  baseRepos: SchoolRepositories = feeCatalogRepos({ 'fee-1': ['student-1'] }),
): SchoolRepositories {
  return {
    ...baseRepos,
    payments: {
      findById: mock(async (id: string) => (id === payment.id ? payment : undefined)),
    },
  } as unknown as SchoolRepositories
}

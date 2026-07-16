export type AuthCacheInvalidationEvent
  = | { kind: 'staff-grants', staffMemberId: string, schoolId?: string }
    | { kind: 'guardian-scope', guardianId: string, schoolId?: string }
    | { kind: 'student-scope', studentId: string, schoolId?: string }
    | { kind: 'teacher-scope', teacherId: string, schoolId?: string }

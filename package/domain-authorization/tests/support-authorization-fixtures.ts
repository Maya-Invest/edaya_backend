import type { ActorMetadata, EffectiveGrants, Permission } from '@edaya/authorization'
import type { GuardianScope, StudentScope } from '../src/model/actor-scope'
import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createTeacherActorMetadata,
} from '@edaya/authorization'
import { portalScopeForGuardian, portalScopeForStudent } from './support/effective-grants'

const now = new Date('2026-09-01T00:00:00Z')

function staffGrants(permissions: readonly Permission[]): EffectiveGrants {
  return {
    permissions: new Set(permissions),
    scopeGrants: permissions.map(permission => ({
      permission,
      scopeType: 'school' as const,
      scopeEntityIds: ['school-1'],
    })),
    isElevated: false,
  }
}

export const AuthFixtures = {
  staff: {
    withPermissions: (permissions: readonly Permission[]): ActorMetadata =>
      createStaffActorMetadata({
        subjectId: 'subject-staff',
        staffMemberId: 'staff-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        assuranceLevel: ActorAssuranceLevel.Strong,
        effectiveGrants: staffGrants(permissions),
      }),
  },
  teacher: {
    subject: (classSubjectId: string, classGroupIds: readonly string[] = []) =>
      createTeacherActorMetadata({
        subjectId: 'user-teacher',
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        assuranceLevel: ActorAssuranceLevel.Standard,
        teacherScope: {
          teaching: { classSubjectIds: [classSubjectId] },
          homeroom: { classGroupIds: [...classGroupIds] },
        },
      }),
    homeroom: (classGroupId: string) =>
      createTeacherActorMetadata({
        subjectId: 'user-teacher',
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        assuranceLevel: ActorAssuranceLevel.Standard,
        teacherScope: {
          teaching: { classSubjectIds: [] },
          homeroom: { classGroupIds: [classGroupId] },
        },
      }),
    unassigned: () =>
      createTeacherActorMetadata({
        subjectId: 'user-teacher',
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        assuranceLevel: ActorAssuranceLevel.Standard,
        teacherScope: {
          teaching: { classSubjectIds: [] },
          homeroom: { classGroupIds: [] },
        },
      }),
    both: (classSubjectId: string, classGroupId: string) =>
      AuthFixtures.teacher.subject(classSubjectId, [classGroupId]),
  },
  guardian: {
    linkedTo: (studentId: string, classGroupId = 'class-1'): ActorMetadata =>
      createGuardianActorMetadata({
        subjectId: 'subject-guardian',
        guardianId: 'guardian-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        guardianScope: portalScopeForGuardian([studentId], [classGroupId]),
      }),
    withScope: (scope: GuardianScope): ActorMetadata =>
      createGuardianActorMetadata({
        subjectId: 'subject-guardian',
        guardianId: 'guardian-1',
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        guardianScope: scope,
      }),
  },
  student: {
    enrolledIn: (classGroupId = 'class-1', studentId = 'student-1'): ActorMetadata =>
      createStudentActorMetadata({
        subjectId: 'subject-student',
        studentId,
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        studentScope: portalScopeForStudent(studentId, classGroupId),
      }),
    withScope: (scope: StudentScope): ActorMetadata =>
      createStudentActorMetadata({
        subjectId: 'subject-student',
        studentId: scope.studentId,
        schoolId: 'school-1',
        requestId: 'test',
        authenticatedAt: now,
        studentScope: scope,
      }),
  },
}

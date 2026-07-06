import { describe, expect, test } from 'bun:test'
import {
  permissionAction,
  teacherAssignmentReadModule,
  teacherSelfReadModule,
  workspaceReadModule,
} from '../../../src/application/entities/entity-config'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createTeacherActorMetadata,
  EMPTY_TEACHER_SCOPE,
  Permission,
} from '../../../src/capabilities/authorization'

function teacherActor(scope: {
  classSubjectIds?: readonly string[]
  classGroupIds?: readonly string[]
} = {}) {
  return createTeacherActorMetadata({
    subjectId: 'user-teacher',
    teacherId: 'teacher-1',
    schoolId: 'school-1',
    teacherScope: {
      teaching: { classSubjectIds: scope.classSubjectIds ?? ['cs-math'] },
      homeroom: { classGroupIds: scope.classGroupIds ?? [] },
    },
    requestId: 'test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Standard,
  })
}

describe('teacher portal read module gates', () => {
  test('workspaceReadModule allows assigned teachers', () => {
    expect(() => workspaceReadModule()(teacherActor())).not.toThrow()
  })

  test('workspaceReadModule rejects teachers without assignments', () => {
    const actor = createTeacherActorMetadata({
      subjectId: 'user-teacher',
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      teacherScope: EMPTY_TEACHER_SCOPE,
      requestId: 'test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    expect(() => workspaceReadModule()(actor)).toThrow(AuthorizationError)
  })

  test('teacherSelfReadModule allows any teacher actor', () => {
    expect(() => teacherSelfReadModule()(teacherActor())).not.toThrow()
  })

  test('teacherAssignmentReadModule allows assigned teachers', () => {
    expect(() => teacherAssignmentReadModule()(teacherActor())).not.toThrow()
  })

  test('student directory read maps to teacher capabilities', () => {
    expect(() => permissionAction(Permission.QUERY_STUDENT_DIRECTORY_READ)(teacherActor())).not.toThrow()
    expect(() => permissionAction(Permission.QUERY_STUDENT_DETAIL_READ)(teacherActor())).not.toThrow()
  })

  test('homeroom teachers can read student directory via class roster capability', () => {
    expect(() => permissionAction(Permission.QUERY_STUDENT_DETAIL_READ)(
      teacherActor({ classSubjectIds: [], classGroupIds: ['cg-7a'] }),
    )).not.toThrow()
  })

  test('teacher portal actors can record attendance through capabilities', () => {
    expect(() => permissionAction(Permission.ATTENDANCE_RECORD, {
      scopeType: 'class_group',
      scopeEntityId: 'cg-7a',
    })(teacherActor())).not.toThrow()
  })
})

import { describe, expect, test } from 'bun:test'
import {
  operationModule,
} from '../../../src/application/entities/entity-config'
import {
  ActorAssuranceLevel,
  AttachmentOperations,
  AttendanceOperations,
  AuthorizationError,
  createTeacherActorMetadata,
  EMPTY_TEACHER_SCOPE,
  StudentOperations,
  TeacherOperations,
  WorkspaceOperations,
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
  test('WorkspaceOperations.read allows assigned teachers', () => {
    expect(() => operationModule(WorkspaceOperations.read)(teacherActor())).not.toThrow()
  })

  test('WorkspaceOperations.read rejects teachers without assignments', () => {
    const actor = createTeacherActorMetadata({
      subjectId: 'user-teacher',
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      teacherScope: EMPTY_TEACHER_SCOPE,
      requestId: 'test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    expect(() => operationModule(WorkspaceOperations.read)(actor)).toThrow(AuthorizationError)
  })

  test('TeacherOperations.selfRead allows any teacher actor', () => {
    expect(() => operationModule(TeacherOperations.selfRead)(teacherActor())).not.toThrow()
    expect(() => operationModule(TeacherOperations.selfRead)(
      createTeacherActorMetadata({
        subjectId: 'user-teacher',
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        teacherScope: EMPTY_TEACHER_SCOPE,
        requestId: 'test',
        authenticatedAt: new Date('2026-09-01T00:00:00Z'),
        assuranceLevel: ActorAssuranceLevel.Standard,
      }),
    )).not.toThrow()
  })

  test('TeacherOperations.assignmentRead allows assigned teachers', () => {
    expect(() => operationModule(TeacherOperations.assignmentRead)(teacherActor())).not.toThrow()
  })

  test('student directory read maps to teacher capabilities', () => {
    expect(() => operationModule(StudentOperations.directoryRead)(teacherActor())).not.toThrow()
  })

  test('homeroom teachers can read student directory via class roster capability', () => {
    expect(() => operationModule(StudentOperations.directoryRead)(
      teacherActor({ classSubjectIds: [], classGroupIds: ['cg-7a'] }),
    )).not.toThrow()
  })

  test('AttachmentOperations.read allows assigned teachers', () => {
    expect(() => operationModule(AttachmentOperations.read)(teacherActor())).not.toThrow()
  })

  test('teacher portal actors can record attendance through capabilities', () => {
    expect(() => operationModule(AttendanceOperations.record, {
      classGroupId: 'cg-7a',
    })(teacherActor())).not.toThrow()
  })
})

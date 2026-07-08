import type { ActorMetadata, Permission } from '@edaya/authorization'
import type { OperationContext, OperationRef } from '../../src/operations/types'
import type { OperationMatrixRow } from './operation-matrix'
import { AuthFixtures } from './authorization-fixtures'
import { describeOperationMatrix } from './operation-matrix'

export type ActorPreset
  = | { kind: 'staff', permission: Permission }
    | { kind: 'teacherSubject', classSubjectId?: string, classGroupIds?: readonly string[] }
    | { kind: 'teacherHomeroom', classGroupId?: string }
    | { kind: 'teacherUnassigned' }
    | { kind: 'guardian', studentId?: string, classGroupId?: string }
    | { kind: 'student', classGroupId?: string, studentId?: string }

function actorFrom(preset: ActorPreset): ActorMetadata {
  switch (preset.kind) {
    case 'staff':
      return AuthFixtures.staff.withPermissions([preset.permission])
    case 'teacherSubject':
      return AuthFixtures.teacher.subject(preset.classSubjectId ?? 'cs-math', preset.classGroupIds ?? [])
    case 'teacherHomeroom':
      return AuthFixtures.teacher.homeroom(preset.classGroupId ?? 'cg-7a')
    case 'teacherUnassigned':
      return AuthFixtures.teacher.unassigned()
    case 'guardian':
      return AuthFixtures.guardian.linkedTo(preset.studentId ?? 'student-1', preset.classGroupId)
    case 'student':
      return AuthFixtures.student.enrolledIn(preset.classGroupId ?? 'class-1', preset.studentId)
  }
}

function toRows(
  rows: Array<{ label: string, actor: ActorPreset, expect: 'allow' | 'deny', context?: OperationContext }>,
): OperationMatrixRow[] {
  return rows.map(row => ({
    label: row.label,
    actor: () => actorFrom(row.actor),
    expect: row.expect,
    context: row.context,
  }))
}

export function describeMatrix(
  operation: OperationRef,
  rows: Array<{ label: string, actor: ActorPreset, expect: 'allow' | 'deny', context?: OperationContext }>,
): void {
  describeOperationMatrix(operation, toRows(rows))
}

export function describeStaffGlobalMatrix(
  operation: OperationRef,
  permission: Permission,
  context?: OperationContext,
): void {
  describeMatrix(operation, [
    { label: 'staff allowed', actor: { kind: 'staff', permission }, expect: 'allow', context },
    { label: 'teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny', context },
    { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny', context },
  ])
}

export function describeStaffGlobalMatrices(
  entries: Array<{ operation: OperationRef, permission: Permission, context?: OperationContext }>,
): void {
  for (const entry of entries) {
    describeStaffGlobalMatrix(entry.operation, entry.permission, entry.context)
  }
}

const CLASS_SUBJECT = { classSubjectId: 'cs-math' } as const
const CLASS_GROUP = { classGroupId: 'cg-7a' } as const
const STUDENT = { studentId: 'student-1' } as const

export function describeClassSubjectStaffTeacherMatrix(
  operation: OperationRef,
  permission: Permission,
): void {
  describeMatrix(operation, [
    { label: 'staff allowed', actor: { kind: 'staff', permission }, expect: 'allow', context: CLASS_SUBJECT },
    { label: 'teacher matching classSubject', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
    { label: 'teacher wrong classSubject denied', actor: { kind: 'teacherSubject' }, expect: 'deny', context: { classSubjectId: 'cs-other' } },
    { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny', context: CLASS_SUBJECT },
  ])
}

export { CLASS_GROUP, CLASS_SUBJECT, STUDENT }

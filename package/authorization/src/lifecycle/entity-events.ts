import type { CoreEntityKey } from '@edaya/core'
import type { AuthCacheInvalidationEvent } from './types'

const AUTH_CACHE_INVALIDATION_ENTITY_KEYS = new Set<CoreEntityKey>([
  'staffPermissionAssignments',
  'staffMembers',
  'staffAssignments',
  'guardianLinks',
  'enrollments',
  'students',
  'guardians',
  'teachers',
  'teacherAssignments',
])

export function isAuthCacheInvalidationEntity(entityKey: CoreEntityKey): boolean {
  return AUTH_CACHE_INVALIDATION_ENTITY_KEYS.has(entityKey)
}

function staffGrantEvent(staffMemberId: string, schoolId?: string): AuthCacheInvalidationEvent {
  return { kind: 'staff-grants', staffMemberId, schoolId }
}

function guardianScopeEvent(guardianId: string, schoolId?: string): AuthCacheInvalidationEvent {
  return { kind: 'guardian-scope', guardianId, schoolId }
}

function studentScopeEvent(studentId: string, schoolId?: string): AuthCacheInvalidationEvent {
  return { kind: 'student-scope', studentId, schoolId }
}

function teacherScopeEvent(teacherId: string, schoolId?: string): AuthCacheInvalidationEvent {
  return { kind: 'teacher-scope', teacherId, schoolId }
}

export function resolveAuthCacheInvalidationEvents(
  entityKey: CoreEntityKey,
  entity: unknown,
): readonly AuthCacheInvalidationEvent[] {
  if (!entity || typeof entity !== 'object') {
    return []
  }

  const candidate = entity as {
    id?: unknown
    staffId?: unknown
    teacherId?: unknown
    guardianId?: unknown
    studentId?: unknown
    schoolId?: unknown
  }

  const schoolId = typeof candidate.schoolId === 'string' ? candidate.schoolId : undefined

  switch (entityKey) {
    case 'staffPermissionAssignments': {
      return typeof candidate.staffId === 'string'
        ? [staffGrantEvent(candidate.staffId, schoolId)]
        : []
    }
    case 'staffMembers': {
      return typeof candidate.id === 'string'
        ? [staffGrantEvent(candidate.id, schoolId)]
        : []
    }
    case 'staffAssignments': {
      return typeof candidate.staffId === 'string'
        ? [staffGrantEvent(candidate.staffId, schoolId)]
        : []
    }
    case 'guardianLinks': {
      const events: AuthCacheInvalidationEvent[] = []
      if (typeof candidate.guardianId === 'string') {
        events.push(guardianScopeEvent(candidate.guardianId, schoolId))
      }
      if (typeof candidate.studentId === 'string') {
        events.push(studentScopeEvent(candidate.studentId, schoolId))
      }
      return events
    }
    case 'enrollments': {
      return typeof candidate.studentId === 'string'
        ? [studentScopeEvent(candidate.studentId, schoolId)]
        : []
    }
    case 'students': {
      return typeof candidate.id === 'string'
        ? [studentScopeEvent(candidate.id, schoolId)]
        : []
    }
    case 'guardians': {
      return typeof candidate.id === 'string'
        ? [guardianScopeEvent(candidate.id, schoolId)]
        : []
    }
    case 'teachers': {
      return typeof candidate.id === 'string'
        ? [teacherScopeEvent(candidate.id, schoolId)]
        : []
    }
    case 'teacherAssignments': {
      return typeof candidate.teacherId === 'string'
        ? [teacherScopeEvent(candidate.teacherId, schoolId)]
        : []
    }
    default:
      return []
  }
}

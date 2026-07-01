import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  announcementLinkedTenant,
  classGroupLinkedTenant,
  directSchoolTenant,
  indirectTenant,
  resolveClassSubjectSchoolId,
  resolveIdFromFilter,
  resolveSchoolIdFromFilter,
  resolveSessionSchoolId,
  resolveStringFilterValue,
} from '../../../src/application/entities/entity-config/tenant'

describe('entity tenant resolvers', () => {
  const repositories = {
    announcements: {
      findById: mock(async id => id === 'announcement-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    classGroups: {
      findById: mock(async id => id === 'class-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    classSubjects: {
      findById: mock(async id => id === 'subject-1' ? { id, classGroupId: 'class-1' } : undefined),
    },
    sessions: {
      findById: mock(async id => id === 'session-1' ? { id, classGroupId: 'class-1' } : undefined),
    },
  } as unknown as SchoolRepositories

  test('resolves direct, indirect, class group, announcement, class subject, and session tenants', async () => {
    expect(directSchoolTenant<{ schoolId: string }>().resolve({ schoolId: 'school-1' }, repositories)).toBe('school-1')
    expect(await indirectTenant(async () => 'school-2').resolve({}, repositories)).toBe('school-2')
    expect(await classGroupLinkedTenant<{ classGroupId: string }>('classGroupId').resolve({ classGroupId: 'class-1' }, repositories)).toBe('school-1')
    expect(await announcementLinkedTenant<{ announcementId: string }>('announcementId').resolve({ announcementId: 'announcement-1' }, repositories)).toBe('school-1')
    expect(await resolveClassSubjectSchoolId(repositories, 'subject-1')).toBe('school-1')
    expect(await resolveSessionSchoolId(repositories, 'session-1')).toBe('school-1')
    expect(await resolveClassSubjectSchoolId(repositories, 'missing-subject')).toBeUndefined()
    expect(await resolveSessionSchoolId(repositories, 'missing-session')).toBeUndefined()
  })

  test('extracts string filters from direct, equality, and inclusion filter shapes', () => {
    expect(resolveSchoolIdFromFilter({ schoolId: 'school-1' })).toBe('school-1')
    expect(resolveSchoolIdFromFilter({ schoolId: { $eq: 'school-2' } } as any)).toBe('school-2')
    expect(resolveSchoolIdFromFilter({ schoolId: { $in: ['school-3', 'school-4'] } } as any)).toBe('school-3')
    expect(resolveIdFromFilter({ id: 'entity-1' })).toBe('entity-1')
    expect(resolveStringFilterValue(undefined)).toBeUndefined()
    expect(resolveStringFilterValue(123)).toBeUndefined()
    expect(resolveStringFilterValue({ $eq: 123 })).toBeUndefined()
    expect(resolveStringFilterValue({ $in: [123] })).toBeUndefined()
  })
})

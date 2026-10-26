import type { SchoolRepositories } from '../../src/ports/school-repositories'
import { Guardian, GuardianStudentLink } from '@edaya/core'
import { expect, test } from 'bun:test'
import { resolveGuardiansForStudents } from '../../src/capabilities/notifications/delivery/recipient-resolvers'

test('shared guardians use bounded reads after child-specific permissions and tenant filtering', async () => {
  const guardians = Array.from({ length: 992 }, (_, i) => new Guardian({ id: `g${i}`, schoolId: i === 1 ? 'foreign' : 'school', firstName: 'Test', lastName: 'Parent', subjectId: i === 2 ? undefined : `account${i}`, hasAccess: i !== 3 }))
  const links = Array.from({ length: 1144 }, (_, i) => new GuardianStudentLink({ id: `l${i}`, schoolId: 'school', guardianId: `g${i % 992}`, studentId: `s${i}`, receivesAcademicReports: i !== 0 }))
  const reads: number[] = []
  const repositories = {
    guardianLinks: { list: async (query: { studentId: { $in: string[] } }) => {
      reads.push(query.studentId.$in.length)
      return links.filter(link => query.studentId.$in.includes(link.studentId))
    } },
    guardians: { list: async (query: { id: { $in: string[] } }) => {
      reads.push(query.id.$in.length)
      return guardians.filter(guardian => query.id.$in.includes(guardian.id))
    } },
  } as unknown as SchoolRepositories
  const resolve = (ids: string[]) => resolveGuardiansForStudents(repositories, 'school', ids, link => link.receivesAcademicReports, guardian => guardian.hasAccess)
  expect(await resolve([])).toEqual([])
  expect(reads).toEqual([])
  expect(await resolve(['s0'])).toEqual([])
  reads.length = 0
  const recipients = await resolve([...links.map(link => link.studentId), 's0'])
  expect(recipients).toHaveLength(989)
  expect(new Set(recipients.map(row => row.id)).size).toBe(989)
  expect(recipients.some(row => row.id === 'g0')).toBe(true) // Second child's permission still allows this guardian.
  expect(reads).toEqual([500, 500, 144, 500, 492])
})

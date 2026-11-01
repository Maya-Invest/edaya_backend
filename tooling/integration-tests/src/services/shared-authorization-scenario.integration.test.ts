import type { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import type { BaseRepositoryInterface } from '@edaya/core'
import { PostgresAtomicExecution, PostgresCommandJournal } from '@edaya/adaptor-postgres'
import { AuthorizationError } from '@edaya/authorization'
import { Guardian, noOpFileStorage, noOpNotificationGateway, StaffPermissionAssignment, Student } from '@edaya/core'
import { createAuthorizationScenario } from '@edaya/fixtures'
import { SchoolApplication } from '@edaya/service'
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createDatabasePool } from '../../../../package/adaptor-postgres/tests/support/database-pool'

describe('shared two-school authorization scenario', () => {
  let repositories: PostgresSchoolRepositories
  let application: SchoolApplication
  let scenario: ReturnType<typeof createAuthorizationScenario>

  const pool = createDatabasePool()
  afterAll(() => pool.close())
  afterEach(() => pool.releaseAll())

  beforeEach(async () => {
    scenario = createAuthorizationScenario()
    const fixture = await pool.acquire()
    const { connection, repositories: pooledRepositories } = fixture
    repositories = pooledRepositories
    // Trusted arrangement of an isolated database, not a public or CLI mutation seed.
    async function arrange<T>(repository: BaseRepositoryInterface<T>, records: T[]) {
      for (const record of records) await repository.save(record)
    }
    await arrange(repositories.schools, scenario.schools)
    await arrange(repositories.academicYears, scenario.academicYears)
    await arrange(repositories.gradeLevels, scenario.gradeLevels)
    await arrange(repositories.classGroups, scenario.classGroups)
    await arrange(repositories.staffMembers, scenario.staffMembers)
    await arrange(repositories.students, scenario.students)
    await arrange(repositories.enrollments, scenario.enrollments)
    await arrange(repositories.guardians, scenario.guardians)
    await arrange(repositories.guardianLinks, scenario.guardianLinks)
    await arrange(repositories.teachers, scenario.teachers)
    await arrange(repositories.subjectCategories, scenario.subjectCategories)
    await arrange(repositories.academicDisciplines, scenario.academicDisciplines)
    await arrange(repositories.subjects, scenario.subjects)
    await arrange(repositories.classSubjects, scenario.classSubjects)
    await arrange(repositories.teacherAssignments, scenario.teacherAssignments)
    await arrange(repositories.staffPermissionAssignments, scenario.staffPermissionAssignments)
    application = new SchoolApplication({ repositories, atomicExecution: new PostgresAtomicExecution(connection), commandJournal: new PostgresCommandJournal(), fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway })
  })

  test('all selected profiles retain their own school and child boundaries before count and pagination', async () => {
    const { ids, actors } = scenario
    const cases = [
      [actors.owner, [ids.child, ids.sibling, ids.unrelatedChild]],
      [actors.scopedStaff, [ids.child, ids.sibling]],
      [actors.teacher, [ids.child, ids.sibling]],
      [actors.unassignedTeacher, []],
      [actors.guardian, [ids.child, ids.sibling]],
      [actors.coGuardian, [ids.child]],
      [actors.unrelatedGuardian, [ids.unrelatedChild]],
      [actors.foreignGuardian, [ids.foreignChild]],
      [actors.student, [ids.child]],
    ] as const
    for (const [actor, permitted] of cases) {
      const students = application.forActor(actor).baseService.entities.students
      const expected = [...permitted].sort()
      expect((await students.list()).map(student => student.id)).toEqual(expected)
      expect(await students.count()).toBe(expected.length)
      expect((await students.list({ $offset: 1, $limit: 1 })).map(student => student.id)).toEqual(expected.slice(1, 2))
      for (const student of scenario.students) {
        const found = await students.findById(student.id)
        expect(found?.id).toBe(expected.includes(student.id) ? student.id : undefined)
      }
    }
    await expect(application.forActor(actors.disabledGuardian).baseService.entities.students.list()).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('unlinking or disabling one guardian takes effect without revoking the other guardian or same-login owner', async () => {
    const { ids, actors } = scenario
    const owner = application.forActor(actors.owner).baseService.entities
    const guardian = application.forActor(actors.guardian).baseService.entities.students
    const coGuardian = application.forActor(actors.coGuardian).baseService.entities.students
    await expect(guardian.save(new Student({ ...scenario.students[0]!.data, firstName: 'Forbidden edit' }))).rejects.toBeInstanceOf(AuthorizationError)
    await owner.guardianLinks.delete(`${ids.guardian}-${ids.child}`)
    expect((await guardian.list()).map(student => student.id)).toEqual([ids.sibling])
    expect((await coGuardian.list()).map(student => student.id)).toEqual([ids.child])
    const original = scenario.guardians[0]!
    await owner.guardians.save(new Guardian({ ...original.data, hasAccess: false }))
    await expect(guardian.list()).rejects.toBeInstanceOf(AuthorizationError)
    expect(await owner.students.count()).toBe(3)
    expect((await owner.students.findById(ids.child))?.firstName).toBe(ids.child)
  })

  test('current teaching removal and grant expiry invalidate existing service instances', async () => {
    const owner = application.forActor(scenario.actors.owner).baseService.entities
    const teacher = application.forActor(scenario.actors.teacher).baseService.entities.students
    const staff = application.forActor(scenario.actors.scopedStaff).baseService.entities.students
    expect(await teacher.count()).toBe(2)
    expect(await staff.count()).toBe(2)
    await owner.teacherAssignments.delete(scenario.teacherAssignments[0]!.id)
    expect(await teacher.list()).toEqual([])
    expect(await teacher.count()).toBe(0)
    expect(await teacher.findById(scenario.ids.child)).toBeUndefined()
    const expired = new StaffPermissionAssignment({ ...scenario.staffPermissionAssignments[0]!.data, endsAt: new Date('2000-01-01T00:00:00Z') })
    // Derived grants cannot be edited through generic entity commands. Arrange
    // persisted expiry directly to verify that an existing service rechecks it.
    await expect(owner.staffPermissionAssignments.save(expired)).rejects.toBeInstanceOf(AuthorizationError)
    await repositories.staffPermissionAssignments.save(expired)
    await expect(staff.list()).rejects.toBeInstanceOf(AuthorizationError)
    expect(await owner.students.count()).toBe(3)
  })
})

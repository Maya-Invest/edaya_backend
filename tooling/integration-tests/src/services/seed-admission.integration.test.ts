import type { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import type { PGlite } from '@electric-sql/pglite'
import { PostgresAtomicExecution, PostgresCommandJournal } from '@edaya/adaptor-postgres'
import { noOpFileStorage, noOpNotificationGateway, School, StaffMember, withShortName } from '@edaya/core'
import { bootstrapSeedDataset } from '@edaya/fixtures'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { seedMinimalSchool } from '@edaya/seeding'
import { SchoolApplication } from '@edaya/service'
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createDatabasePool } from '../../../../package/adaptor-postgres/tests/support/database-pool'
import { createInProcessAuthLinkSeedPort } from '../../../seeding/src/domains/auth-link/adapters/in-process'

describe('seed mutation admission', () => {
  let db: PGlite
  let application: SchoolApplication
  let repositories: PostgresSchoolRepositories
  const pool = createDatabasePool()
  afterAll(() => pool.close())
  afterEach(() => pool.releaseAll())

  beforeEach(async () => {
    const fixture = await pool.acquire()
    db = fixture.db
    const { connection, repositories: pooledRepositories } = fixture
    repositories = pooledRepositories
    application = new SchoolApplication({ repositories, atomicExecution: new PostgresAtomicExecution(connection), commandJournal: new PostgresCommandJournal(), fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway })
  })

  test('minimal bootstrap commits school, staff and guardian together and safely repeats', async () => {
    const save = repositories.guardians.save.bind(repositories.guardians)
    repositories.guardians.save = async () => {
      throw new Error('Injected guardian failure')
    }
    await expect(seedMinimalSchool(application)).rejects.toThrow('Injected guardian failure')
    expect(await repositories.schools.count()).toBe(0)
    expect(await repositories.staffMembers.count()).toBe(0)
    expect(await repositories.guardians.count()).toBe(0)
    repositories.guardians.save = save
    // A different existing school cannot suppress installation of the selected fixture.
    await repositories.schools.save(new School(withShortName({ id: 'other-school', name: 'Other', timeZone: 'UTC' })))
    await seedMinimalSchool(application)
    await seedMinimalSchool(application)
    expect(await repositories.schools.count()).toBe(2)
    expect(await repositories.staffMembers.count()).toBe(1)
    expect(await repositories.guardians.count()).toBe(1)
    expect(await repositories.accountInvitations.count()).toBe(0)
    const bootstrap = bootstrapSeedDataset()
    expect((await repositories.guardians.findById(bootstrap.entities.guardians![0]!.id))?.schoolId).toBe(bootstrap.entities.school!.id)
  })

  test('auth-link adapter initializes only its selected linked owner and preserves school settings', async () => {
    const context = resolveDevSeedContext()
    const before = new School(withShortName({ id: context.schoolId, name: 'Selected fixture', timeZone: 'UTC', enforceScheduleConflicts: true, timetableEnforceWorkloadFulfillment: true }))
    await repositories.schools.save(before)
    await repositories.staffMembers.save(new StaffMember({ id: context.ownerStaffId, identifier: 'OWNER', schoolId: context.schoolId, firstName: 'Owner', lastName: 'Fixture', subjectId: 'fixture-subject' }))
    await repositories.schools.save(new School(withShortName({ id: 'foreign-school', name: 'Foreign', timeZone: 'UTC' })))
    await repositories.staffMembers.save(new StaffMember({ id: 'foreign-staff', identifier: 'FOREIGN-STAFF', schoolId: 'foreign-school', firstName: 'Foreign', lastName: 'Fixture', subjectId: 'foreign-subject' }))
    const port = createInProcessAuthLinkSeedPort(application)
    expect(await port.findSchoolById('foreign-school')).toBeUndefined()
    expect(await port.findStaffById('foreign-staff')).toBeUndefined()
    await expect(port.setSchoolOwnerSubjectId('foreign-school', 'fixture-subject')).rejects.toThrow()
    await port.setSchoolOwnerSubjectId(context.schoolId, 'fixture-subject')
    await port.setSchoolOwnerSubjectId(context.schoolId, 'fixture-subject')
    expect((await repositories.schools.findById(context.schoolId))?.data).toEqual(new School(withShortName({ ...before.data, ownerSubjectId: 'fixture-subject' })).data)
    await expect(port.setSchoolOwnerSubjectId(context.schoolId, 'replacement-subject')).rejects.toThrow()
    expect((await repositories.schools.findById(context.schoolId))?.ownerSubjectId).toBe('fixture-subject')
    expect((await db.query('SELECT event FROM command_audit')).rows).toEqual([{ event: 'school.fixture_owner_initialized' }])
  })
})

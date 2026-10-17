import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicYear, Permission, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'

async function fixture(permission: Permission) {
  const fixture = await createTestApp()
  const repos = fixture.schoolRepositories
  const year = new AcademicYear({ id: 'year', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
  const period = new AcademicPeriod({ id: 'period', schoolId: 'school', academicYearId: year.id, name: 'Term', startDate: year.startDate, endDate: year.endDate })
  await repos.academicYears.save(year)
  await repos.academicPeriods.save(period)
  await repos.staffMembers.save(new StaffMember({ id: 'staff', schoolId: 'school', subjectId: 'person', firstName: 'A', lastName: 'Staff' }))
  await repos.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'grant', staffId: 'staff', schoolId: 'school', academicYearId: year.id, permission, scopes: [{ kind: 'school' }] }))
  const actor = createStaffActorMetadata({ staffMemberId: 'staff', subjectId: 'person', schoolId: 'school', academicYearId: year.id, requestId: 'lifecycle', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
  return { ...fixture, year, period, service: fixture.forActor(actor) }
}

test('lifecycle grants publish periods and years without granting structural edits', async () => {
  const { service, year, period, schoolRepositories } = await fixture(Permission.SCHOOL_LIFECYCLE_MANAGE)
  expect((await service.setupWorkflow.publishAcademicPeriod({ academicPeriodId: period.id })).isPublished).toBe(true)
  expect((await service.setupWorkflow.publishAcademicYear({ academicYearId: year.id })).status).toBe('published')
  await expect(service.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, name: 'Changed', isPublished: true }))).rejects.toMatchObject({ code: 'forbidden' })
  await expect(service.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, name: 'Changed', status: 'published' }))).rejects.toMatchObject({ code: 'forbidden' })
  expect((await schoolRepositories.academicPeriods.findById(period.id))?.name).toBe('Term')
  expect((await schoolRepositories.academicYears.findById(year.id))?.name).toBe('Year')
})

test('structure grants cannot publish through direct writes or combine publication with a structural edit', async () => {
  const { service, year, period, schoolRepositories } = await fixture(Permission.SCHOOL_CONFIGURE)
  for (const name of [period.name, 'Changed'])
    await expect(service.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, name, isPublished: true }))).rejects.toMatchObject({ code: 'forbidden' })
  for (const name of [year.name, 'Changed'])
    await expect(service.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, name, status: 'published' }))).rejects.toMatchObject({ code: 'forbidden' })
  await expect(service.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, id: 'new-period', isPublished: true }))).rejects.toMatchObject({ code: 'forbidden' })
  await expect(service.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, id: 'new-year', status: 'published' }))).rejects.toMatchObject({ code: 'forbidden' })
  expect((await schoolRepositories.academicPeriods.findById(period.id))?.isPublished).toBe(false)
  expect((await schoolRepositories.academicYears.findById(year.id))?.status).toBe('draft')
  expect(await schoolRepositories.academicPeriods.findById('new-period')).toBeUndefined()
  expect(await schoolRepositories.academicYears.findById('new-year')).toBeUndefined()
})

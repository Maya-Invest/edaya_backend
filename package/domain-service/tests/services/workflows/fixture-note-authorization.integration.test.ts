import { createSystemActorMetadata } from '@edaya/authorization'
import { School, StaffMember, Student, StudentNote, withShortName } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'

test('only the fixture seed job can import historical notes with an existing tenant staff author', async () => {
  const { schoolRepositories: repos, forActor } = await createTestApp()
  await repos.students.save(new Student({ id: 'student', schoolId: 'school', firstName: 'A', lastName: 'Student' }))
  await repos.schools.save(new School(withShortName({ id: 'foreign', name: 'Foreign', timeZone: 'UTC' })))
  await repos.staffMembers.save(new StaffMember({ id: 'foreign-author', schoolId: 'foreign', firstName: 'Other', lastName: 'Staff' }))
  const fixture = forActor(createSystemActorMetadata({ systemId: 'fixture-seed', schoolId: 'school', requestId: 'fixture-notes', reason: 'Import local fixture history' }))
  const note = new StudentNote({ id: 'note', schoolId: 'school', studentId: 'student', authorStaffId: 'admin', body: 'Historical fixture note' })
  await fixture.baseService.entities.studentNotes.save(note)
  expect((await repos.studentNotes.findById(note.id))?.authorStaffId).toBe('admin')
  for (const authorStaffId of ['missing', 'foreign-author']) {
    await expect(fixture.baseService.entities.studentNotes.save(new StudentNote({ ...note.data, id: authorStaffId, authorStaffId }))).rejects.toMatchObject({ code: 'forbidden' })
    expect(await repos.studentNotes.findById(authorStaffId)).toBeUndefined()
  }
  const unrelatedJob = forActor(createSystemActorMetadata({ systemId: 'reconcilePendingDeliveries', schoolId: 'school', requestId: 'unrelated-job', reason: 'Reconcile notifications' }))
  await expect(unrelatedJob.baseService.entities.studentNotes.save(new StudentNote({ ...note.data, id: 'other-job' }))).rejects.toMatchObject({ code: 'forbidden' })
})

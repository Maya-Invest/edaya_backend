import { Guardian } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createStudentTransitionContext } from '../workflows/student-workflow-context'

for (const group of ['guardians', 'teachers', 'staff'] as const) {
  test(`${group} accepts blank identifiers and checks supplied values at creation`, async () => {
    const f = await createStudentTransitionContext()
    const input = { id: 'original', schoolId: 'sch1', firstName: 'First', lastName: 'Last', identifier: ' \uFF23\uFF2F\uFF24\uFF25-001 ' }
    const register = (data: typeof input) => group === 'guardians'
      ? f.service.studentWorkflow.registerGuardian(data)
      : group === 'teachers' ? f.service.setupWorkflow.registerTeacher(data) : f.service.setupWorkflow.registerStaffMember(data)
    expect((await register(input)).identifier).toBe('CODE-001')
    await expect(register({ ...input, id: 'duplicate', identifier: 'code-001' })).rejects.toMatchObject({ code: 'IDENTIFIER_UNAVAILABLE' })
    await expect(register({ ...input, id: 'invalid', identifier: 'ÉCOLE' })).rejects.toThrow()
    expect((await register({ ...input, id: 'missing', identifier: ' ' })).identifier).toBeUndefined()
  })
}

test('an authorized correction assigns and persists a teacher’s first identifier', async () => {
  const { service, repositories } = await createStudentTransitionContext()
  const teacher = await service.setupWorkflow.registerTeacher({
    schoolId: 'sch1',
    requestId: 'new-teacher',
    firstName: 'Ada',
    lastName: 'Jones',
    identifier: ' ',
  })
  expect((await repositories.teachers.findById(teacher.id))?.identifier).toBeUndefined()

  const result = await service.setupWorkflow.correctHumanIdentifier({
    group: 'teachers',
    entityId: teacher.id,
    requestId: 'assign-teacher-id',
    expectedIdentifier: null,
    identifier: ' tc-001 ',
  })
  expect(result).toEqual({ id: teacher.id, identifier: 'TC-001' })
  expect((await repositories.teachers.findById(teacher.id))?.identifier).toBe('TC-001')
})

test('a guardian batch with duplicate identifiers rolls back', async () => {
  const f = await createStudentTransitionContext()
  await expect(f.service.baseService.entities.guardians.batchSave([
    new Guardian({ id: 'first', schoolId: 'sch1', identifier: 'SAME', firstName: 'First', lastName: 'Parent' }),
    new Guardian({ id: 'second', schoolId: 'sch1', identifier: 'same', firstName: 'Second', lastName: 'Parent' }),
  ])).rejects.toMatchObject({ code: 'IDENTIFIER_UNAVAILABLE' })
  expect(await f.repositories.guardians.count()).toBe(0)
})

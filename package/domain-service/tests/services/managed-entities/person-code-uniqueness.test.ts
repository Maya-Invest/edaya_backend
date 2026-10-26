import { Guardian, StaffMember, Teacher } from '@edaya/core'
import { expect, spyOn, test } from 'bun:test'
import { createStudentTransitionContext } from '../workflows/student-workflow-context'

for (const kind of ['guardians', 'teachers', 'staffMembers'] as const) {
  test(`${kind} code checks narrow candidates without changing case, whitespace or Unicode uniqueness`, async () => {
    const f = await createStudentTransitionContext()
    const save = async (id: string, code?: string) => {
      const data = { id, code, schoolId: 'sch1', firstName: 'First', lastName: 'Last' }
      if (kind === 'guardians')
        return f.service.baseService.entities.guardians.save(new Guardian(data))
      if (kind === 'teachers')
        return f.service.baseService.entities.teachers.save(new Teacher(data))
      return f.service.baseService.entities.staffMembers.save(new StaffMember(data))
    }
    await save('original', 'ÉCOLE')
    await expect(save('duplicate', '\u00A0école\u00A0')).rejects.toMatchObject({ code: kind === 'guardians' ? 'GUARDIAN_CODE_ALREADY_EXISTS' : kind === 'teachers' ? 'TEACHER_CODE_ALREADY_EXISTS' : 'STAFF_MEMBER_CODE_ALREADY_EXISTS' })
    await save('ascii', 'CODE')
    await expect(save('duplicate-ascii', '\t code \n')).rejects.toThrow('already used')
    // Person-code uniqueness does not use import matching's NFKC equivalence.
    await save('compatibility', 'ＣＯＤＥ')
    await save('without-code')
    await save('another-without-code')
    const candidates = spyOn(f.repositories[kind], 'list')
    try {
      await save('ascii', 'code')
      expect(candidates.mock.calls).toHaveLength(1)
      expect(candidates.mock.calls[0]?.[0]).toEqual({ schoolId: 'sch1', code: { $normalizedCandidate: 'code' } })
      const rows = await (candidates.mock.results[0]?.value as Promise<readonly { id: string }[]>)
      expect(rows?.map((row: { id: string }) => row.id)).not.toContain('without-code')
      expect(rows?.map((row: { id: string }) => row.id)).not.toContain('another-without-code')
    }
    finally { candidates.mockRestore() }
  })
}

test('guardian batch saves still detect normalized conflicts between earlier writes and roll back', async () => {
  const f = await createStudentTransitionContext()
  await expect(f.service.baseService.entities.guardians.batchSave([
    new Guardian({ id: 'first', schoolId: 'sch1', code: 'SAME', firstName: 'First', lastName: 'Parent' }),
    new Guardian({ id: 'second', schoolId: 'sch1', code: 'same', firstName: 'Second', lastName: 'Parent' }),
  ])).rejects.toMatchObject({ code: 'GUARDIAN_CODE_ALREADY_EXISTS' })
  expect(await f.repositories.guardians.count()).toBe(0)
})

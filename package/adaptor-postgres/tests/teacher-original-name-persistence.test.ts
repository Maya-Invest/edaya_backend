import { Teacher } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createRepositoryDatabase } from './support/authorization-database'

describe('teacher original-name persistence', () => {
  test('preserves source spelling and whitespace through save, unrelated edits and explicit clearing', async () => {
    const { db, repositories } = await createRepositoryDatabase()
    try {
      const teacher = new Teacher({
        id: 'teacher-original-name',
        schoolId: 'school',
        firstName: 'Jean Pierre',
        lastName: 'Kouamé',
        sourceFullName: '  KOUAMÉ  Jean Pierre  ',
        code: 'T-001',
      })
      await repositories.teachers.save(teacher)
      const saved = (await repositories.teachers.findById(teacher.id))!
      expect(saved.data).toEqual(teacher.data)
      expect((await db.query('SELECT source_full_name FROM teachers WHERE id = $1', [teacher.id])).rows[0]).toEqual({ source_full_name: teacher.sourceFullName })

      await repositories.teachers.save(saved.copyWith({ phone: '+2250102030405' }))
      const edited = (await repositories.teachers.findById(teacher.id))!
      expect(edited.sourceFullName).toBe(teacher.sourceFullName)
      expect(edited.firstName).toBe(teacher.firstName)
      expect(edited.lastName).toBe(teacher.lastName)

      await repositories.teachers.save(edited.copyWith({ sourceFullName: null }))
      expect((await repositories.teachers.findById(teacher.id))?.sourceFullName).toBeUndefined()
      expect((await db.query('SELECT source_full_name FROM teachers WHERE id = $1', [teacher.id])).rows[0]).toEqual({ source_full_name: null })
    }
    finally { await db.close() }
  })
})

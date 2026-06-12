import { describe, expect, test } from 'bun:test'
import { StudentNote, StudentNoteCategory } from '../../../../src/domains/students/student-note'

describe('StudentNote entity', () => {
  const baseArgs = {
    id: 'pn1',
    schoolId: 'sch1',
    studentId: 's1',
    authorStaffId: 'st1',
    body: 'Très bonne progression en algèbre, raisonnement clair.',
    category: StudentNoteCategory.Progress,
    createdAt: new Date('2026-05-12T00:00:00Z'),
    updatedAt: new Date('2026-05-12T00:00:00Z'),
  }

  test('instantiates successfully with category', () => {
    const note = new StudentNote(baseArgs)

    expect(note.id).toBe('pn1')
    expect(note.category).toBe(StudentNoteCategory.Progress)
    expect(note.title).toBeUndefined()
    expect(note.body).toBe(baseArgs.body)
  })

  test('defaults category to work when omitted', () => {
    const note = new StudentNote({
      id: 'pn2',
      schoolId: 'sch1',
      studentId: 's2',
      authorStaffId: 'st2',
      body: 'Devoirs rendus en retard à deux reprises.',
    })

    expect(note.category).toBe(StudentNoteCategory.Work)
  })
})

import type {
  StudentHealthProfileSeedRecord,
  StudentNoteSeedRecord,
  StudentSupportSeedPort,
} from './port'
import { StudentNoteCategory } from '@edaya/core'
import { demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevStudentSupport } from './workflow'

describe('student-support seed port workflow', () => {
  test('passes typed health profiles and student notes through to the seed port', async () => {
    const healthProfiles: StudentHealthProfileSeedRecord[] = []
    const notes: StudentNoteSeedRecord[] = []
    const port: StudentSupportSeedPort = {
      upsertStudentHealthProfile: async (record) => {
        healthProfiles.push(record)
      },
      createStudentNote: async (record) => {
        notes.push(record)
      },
    }

    const counts = await seedDevStudentSupport(port, demoDataset)

    const { studentHealthProfiles, studentNotes } = demoDataset.entities
    expect(counts).toEqual({
      studentHealthProfiles: studentHealthProfiles?.length ?? 0,
      studentNotes: studentNotes?.length ?? 0,
    })
    expect(healthProfiles.find(profile => profile.id === 'hp-s3')?.allergies)
      .toBe('Peanuts, Shellfish')
    expect(healthProfiles.find(profile => profile.id === 'hp-s5')?.allergies).toBe('Aucune')
    expect(healthProfiles.find(profile => profile.id === 'hp-s5')?.medicalConditions).toBe('Aucune')
    expect(healthProfiles[0]?.lastVisit).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(notes.map(note => note.category)).toContain(StudentNoteCategory.Progress)
    expect(notes.map(note => note.category)).toContain(StudentNoteCategory.Behavior)
    expect(notes[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})

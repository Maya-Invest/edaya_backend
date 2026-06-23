import type { StudentSupportSeedPort } from './port'
import { StudentNoteCategory } from '@edaya/core'
import { SEED_PEDAGOGICAL_NOTES, SEED_STUDENT_HEALTH_PROFILES } from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const NOTE_CATEGORY_BY_SEED = {
  Comportement: StudentNoteCategory.Behavior,
  Travail: StudentNoteCategory.Work,
  Progression: StudentNoteCategory.Progress,
  Encouragement: StudentNoteCategory.Encouragement,
} as const

function joinHealthList(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(', ') : undefined
}

export interface DevStudentSupportSeedCounts {
  studentHealthProfiles: number
  studentNotes: number
}

export async function seedDevStudentSupport(
  port: StudentSupportSeedPort,
): Promise<DevStudentSupportSeedCounts> {
  for (const profile of SEED_STUDENT_HEALTH_PROFILES) {
    await port.upsertStudentHealthProfile({
      id: profile.id,
      studentId: profile.studentId,
      bloodType: profile.bloodType,
      allergies: joinHealthList(profile.allergies) ?? 'Aucune',
      medicalConditions: joinHealthList(profile.chronicConditions) ?? 'Aucune',
      medications: joinHealthList(profile.medications),
      clinicalNotes: profile.notes,
      lastVisit: seedDateTime(profile.lastVisit),
    })
  }

  for (const note of SEED_PEDAGOGICAL_NOTES) {
    await port.createStudentNote({
      id: note.id,
      studentId: note.studentId,
      authorStaffId: note.authorId,
      category: NOTE_CATEGORY_BY_SEED[note.category] ?? StudentNoteCategory.Work,
      body: note.content,
      createdAt: seedDateTime(note.date),
    })
  }

  return {
    studentHealthProfiles: SEED_STUDENT_HEALTH_PROFILES.length,
    studentNotes: SEED_PEDAGOGICAL_NOTES.length,
  }
}

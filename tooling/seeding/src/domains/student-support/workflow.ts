import type { FixtureDataset } from '@edaya/fixtures'
import type { StudentSupportSeedPort } from './port'
import { StudentNoteCategory } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevStudentSupportSeedCounts {
  studentHealthProfiles: number
  studentNotes: number
}

export async function seedDevStudentSupport(
  port: StudentSupportSeedPort,
  dataset: FixtureDataset,
): Promise<DevStudentSupportSeedCounts> {
  const studentHealthProfiles = dataset.entities.studentHealthProfiles ?? []
  const studentNotes = dataset.entities.studentNotes ?? []

  for (const profile of studentHealthProfiles) {
    await port.upsertStudentHealthProfile({
      id: profile.id,
      studentId: profile.studentId,
      bloodType: profile.bloodType ?? undefined,
      allergies: profile.allergies ?? 'Aucune',
      medicalConditions: profile.medicalConditions ?? 'Aucune',
      medications: profile.medications ?? undefined,
      clinicalNotes: profile.clinicalNotes ?? undefined,
      lastVisit: profile.lastVisit ? seedDateTime(String(profile.lastVisit).slice(0, 10)) : undefined,
    })
  }

  for (const note of studentNotes) {
    await port.createStudentNote({
      id: note.id,
      studentId: note.studentId,
      authorStaffId: note.authorStaffId,
      category: note.category ?? StudentNoteCategory.Work,
      body: note.body,
      createdAt: seedDateTime(String(note.createdAt).slice(0, 10)),
    })
  }

  return {
    studentHealthProfiles: studentHealthProfiles.length,
    studentNotes: studentNotes.length,
  }
}

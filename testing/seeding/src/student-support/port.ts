import type { StudentNoteCategory } from '@edaya/core'

export interface StudentHealthProfileSeedRecord {
  id: string
  studentId: string
  bloodType?: string
  allergies?: string
  medicalConditions?: string
  medications?: string
  clinicalNotes?: string
  lastVisit?: string
}

export interface StudentNoteSeedRecord {
  id: string
  studentId: string
  authorStaffId: string
  category: StudentNoteCategory
  body: string
  createdAt: string
}

export interface StudentSupportSeedPort {
  upsertStudentHealthProfile: (record: StudentHealthProfileSeedRecord) => Promise<void>
  createStudentNote: (record: StudentNoteSeedRecord) => Promise<void>
}

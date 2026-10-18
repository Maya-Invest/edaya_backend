import type { SubjectInput, SubjectMatterInput } from '@edaya/core'

export type SubjectSeedRecord = SubjectInput & { classSubjectIdsByClassGroupId?: Record<string, string> }
export type SubjectMatterSeedRecord = SubjectMatterInput

export interface CurriculumSeedPort {
  saveSubject: (record: SubjectSeedRecord) => Promise<void>
  saveSubjectMatter: (record: SubjectMatterSeedRecord) => Promise<void>
}

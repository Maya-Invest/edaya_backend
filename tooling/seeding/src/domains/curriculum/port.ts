import type { AcademicDisciplineInput, SubjectCategoryInput, SubjectInput, SubjectMatterInput } from '@edaya/core'

export type SubjectSeedRecord = SubjectInput & { classSubjectIdsByClassGroupId?: Record<string, string> }
export type SubjectMatterSeedRecord = SubjectMatterInput

export interface CurriculumSeedPort {
  saveSubjectCategory: (record: SubjectCategoryInput) => Promise<void>
  saveAcademicDiscipline: (record: AcademicDisciplineInput) => Promise<void>
  saveSubject: (record: SubjectSeedRecord) => Promise<void>
  saveSubjectMatter: (record: SubjectMatterSeedRecord) => Promise<void>
}

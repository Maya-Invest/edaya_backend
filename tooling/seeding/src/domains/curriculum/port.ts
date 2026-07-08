import type { SubjectCategory, SubjectColor } from '@edaya/core'

export interface SubjectSeedRecord {
  id: string
  schoolId: string
  name: string
  code?: string
  defaultCoefficient?: number
  category: SubjectCategory
  color: SubjectColor
}

export interface SubjectMatterSeedRecord {
  id: string
  subjectId: string
  name: string
  description?: string
  sequenceOrder: number
  estimatedHours?: number
}

export interface GradeLevelSubjectSeedRecord {
  id: string
  gradeLevelId: string
  academicYearId: string
  subjectId: string
  coefficient?: number
  classSubjectIdsByClassGroupId?: Record<string, string>
}

export interface GradeLevelSubjectMatterSeedRecord {
  id: string
  gradeLevelSubjectId: string
  subjectMatterId: string
  classSubjectMatterIdsByClassGroupId?: Record<string, string>
}

export interface CurriculumSeedPort {
  saveSubject: (record: SubjectSeedRecord) => Promise<void>
  saveSubjectMatter: (record: SubjectMatterSeedRecord) => Promise<void>
  offerSubjectToGradeLevel: (record: GradeLevelSubjectSeedRecord) => Promise<void>
  assignMatterToGradeLevelSubject: (record: GradeLevelSubjectMatterSeedRecord) => Promise<void>
}

import type {
  ClassSubjectMatterStatus,
  SubjectCategory,
  SubjectColor,
} from '@edaya/core'

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

export interface ClassSubjectSeedRecord {
  id: string
  classGroupId: string
  subjectId: string
  coefficient?: number
}

export interface ClassSubjectMatterSeedRecord {
  id: string
  classSubjectId: string
  subjectMatterId: string
  status: ClassSubjectMatterStatus
  completedPercentage: number
}

export interface CurriculumSeedPort {
  saveSubject: (record: SubjectSeedRecord) => Promise<void>
  saveSubjectMatter: (record: SubjectMatterSeedRecord) => Promise<void>
  offerSubjectToClass: (record: ClassSubjectSeedRecord) => Promise<void>
  assignMatterToClassSubject: (record: ClassSubjectMatterSeedRecord) => Promise<void>
}

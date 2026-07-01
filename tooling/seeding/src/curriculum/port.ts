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

/** @deprecated Internal seed compatibility only. */
export interface ClassSubjectSeedRecord {
  id: string
  classGroupId: string
  subjectId: string
  coefficient?: number
}

/** @deprecated Internal seed compatibility only. */
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
  offerSubjectToGradeLevel: (record: GradeLevelSubjectSeedRecord) => Promise<void>
  assignMatterToGradeLevelSubject: (record: GradeLevelSubjectMatterSeedRecord) => Promise<void>
}

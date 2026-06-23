import type { CurriculumSeedPort } from './port'
import {
  ClassSubjectMatterStatus,
  SubjectCategory,
  SubjectColor,
} from '@edaya/core'
import {
  SEED_CLASS_SUBJECT_MATTERS,
  SEED_CLASS_SUBJECTS,
  SEED_SCHOOL_ID,
  SEED_SUBJECT_CATALOG,
  SEED_SUBJECT_MATTERS,
} from '@edaya/dev-fixtures'

const SUBJECT_CATEGORY_BY_SEED: Readonly<Record<string, SubjectCategory>> = {
  'Arts': SubjectCategory.Arts,
  'Langues': SubjectCategory.Languages,
  'Littéraire': SubjectCategory.Literary,
  'Scientifique': SubjectCategory.Scientific,
  'Sciences humaines': SubjectCategory.Humanities,
  'Sport': SubjectCategory.Sport,
}

const SUBJECT_COLOR_BY_SEED: Readonly<Record<string, SubjectColor>> = {
  mint: SubjectColor.Mint,
  sky: SubjectColor.Sky,
  warm: SubjectColor.Warm,
}

function subjectCategory(value: string): SubjectCategory {
  const category = SUBJECT_CATEGORY_BY_SEED[value]
  if (!category) {
    throw new Error(`Unsupported seed subject category: ${value}`)
  }
  return category
}

function subjectColor(value: string): SubjectColor {
  const color = SUBJECT_COLOR_BY_SEED[value]
  if (!color) {
    throw new Error(`Unsupported seed subject color: ${value}`)
  }
  return color
}

export async function seedDevCurriculum(port: CurriculumSeedPort): Promise<void> {
  for (const subject of SEED_SUBJECT_CATALOG) {
    await port.saveSubject({
      id: subject.id,
      schoolId: SEED_SCHOOL_ID,
      name: subject.name,
      code: subject.code,
      defaultCoefficient: subject.defaultCoefficient,
      category: subjectCategory(subject.category),
      color: subjectColor(subject.color),
    })
  }

  for (const matter of SEED_SUBJECT_MATTERS) {
    await port.saveSubjectMatter({ ...matter })
  }

  for (const offering of SEED_CLASS_SUBJECTS) {
    await port.offerSubjectToClass({ ...offering })
  }

  for (const link of SEED_CLASS_SUBJECT_MATTERS) {
    await port.assignMatterToClassSubject({
      ...link,
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
    })
  }
}

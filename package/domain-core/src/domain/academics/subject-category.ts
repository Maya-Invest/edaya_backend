import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum SubjectCategory {
  Scientific = 'Scientifique',
  Literary = 'Littéraire',
  Languages = 'Langues',
  Humanities = 'Sciences humaines',
  Sport = 'Sport',
  Arts = 'Arts',
}

export const DEFAULT_SUBJECT_CATEGORY_NAMES = Object.values(SubjectCategory)

export function defaultSubjectCategoryId(schoolId: string, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${schoolId}:subject-category:${slug || 'category'}`
}

export const subjectCategorySchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectCategoryData = z.infer<typeof subjectCategorySchema>
export type SubjectCategoryInput = z.input<typeof subjectCategorySchema>

export const subjectCategoryCreateSchema = subjectCategorySchema.omit({ createdAt: true })
export const subjectCategoryUpdateSchema = subjectCategorySchema.partial().required({ id: true })

export class SubjectCategoryEntity {
  readonly data: SubjectCategoryData

  constructor(args: SubjectCategoryInput) {
    this.data = parseDomain(subjectCategorySchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get createdAt() { return this.data.createdAt }

  copyWith(overrides: Partial<SubjectCategoryInput>): SubjectCategoryEntity {
    return new SubjectCategoryEntity({
      id: this.id,
      schoolId: this.schoolId,
      name: overrides.name ?? this.name,
      createdAt: this.createdAt,
    })
  }
}

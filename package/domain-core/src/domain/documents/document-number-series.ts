import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'

export const documentNumberSeriesSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  documentKind: z.string().trim().min(1, 'documentKind must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  nextValue: z.number().int().positive('nextValue must be a strictly positive integer'),
  updatedAt: zodDate().default(() => new Date()),
})

export type DocumentNumberSeriesData = z.infer<typeof documentNumberSeriesSchema>
export type DocumentNumberSeriesInput = z.input<typeof documentNumberSeriesSchema>

export class DocumentNumberSeries {
  readonly data: DocumentNumberSeriesData

  constructor(args: DocumentNumberSeriesInput) {
    this.data = parseDomain(documentNumberSeriesSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get documentKind() { return this.data.documentKind }
  get academicYearId() { return this.data.academicYearId }
  get nextValue() { return this.data.nextValue }
  get updatedAt() { return this.data.updatedAt }

  copyWith(changes: Partial<DocumentNumberSeriesInput>): DocumentNumberSeries {
    return new DocumentNumberSeries({
      id: this.id,
      schoolId: this.schoolId,
      documentKind: this.documentKind,
      academicYearId: this.academicYearId,
      nextValue: this.nextValue,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}

export function documentNumberSeriesId(schoolId: string, documentKind: string, academicYearId: string): string {
  return `dns:${schoolId}:${documentKind}:${academicYearId}`
}

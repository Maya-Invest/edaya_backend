import type { DocumentTemplateKey } from '../../domain/documents/document-template-key'
import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { guardianChoices, guardianHighlightsInput } from './guardian-home'

export const guardianChildInput = guardianHighlightsInput.pick({ studentId: true, academicYearId: true })
export const guardianPapersInput = guardianChildInput.extend({ cursor: z.string().min(1).max(4096).optional() })
const ownSubmission = z.object({ id: z.string(), attachmentId: z.string(), version: z.number().int() })
export const guardianPhotoDecision = z.discriminatedUnion('status', [
  z.object({ status: z.literal('none') }),
  z.object({ status: z.literal('pending'), ownSubmission: ownSubmission.nullable() }),
  z.object({ status: z.literal('rejected'), reason: z.string().nullable() }),
])
export const guardianChildPhoto = z.object({
  student: guardianChoices.shape.children.element,
  academicYearId: z.string(),
  decision: guardianPhotoDecision,
})
export const guardianPaper = z.object({
  id: z.string(),
  templateKey: z.string(),
  sourceId: z.string(),
  number: z.string().nullable(),
  status: z.literal('ready'),
})
export const guardianPapersPage = guardianChildInput.extend({ items: z.array(guardianPaper), nextCursor: z.string().nullable() })
export type GuardianChildInput = z.infer<typeof guardianChildInput>
export type GuardianPapersInput = z.infer<typeof guardianPapersInput>
export type GuardianPhotoDecision = z.infer<typeof guardianPhotoDecision>
export const guardianPapersPageSize = 30
export interface GuardianChildProfilePort {
  photoDecision: (scope: ResourceAccessScope, studentId: string, guardianId: string) => Promise<GuardianPhotoDecision>
  papers: (scope: ResourceAccessScope, input: GuardianChildInput, templates: DocumentTemplateKey[], after?: string) => Promise<z.infer<typeof guardianPaper>[]>
}

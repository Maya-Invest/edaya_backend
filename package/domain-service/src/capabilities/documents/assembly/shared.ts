import type { AccessPolicies, SchoolScopedActorMetadata } from '@edaya/authorization'
import type { DocumentIssuanceSnapshot, DocumentSourceType, DocumentTemplateKey } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { DocumentLocale } from '../catalog'
import { BusinessRuleViolationError, DOCUMENT_FAILURES } from '@edaya/core'

export interface DocumentAssemblyContext<R extends keyof SchoolRepositories, A extends keyof AccessPolicies = never> {
  actor: SchoolScopedActorMetadata
  repositories: Pick<SchoolRepositories, R>
  access: Pick<AccessPolicies, A>
}
export interface AssembleDocumentInput {
  reportPublication?: true
  templateKey: DocumentTemplateKey
  sourceId: string
  locale: DocumentLocale
  academicYearId?: string
  academicPeriodId?: string
  classSubjectId?: string
  studentId?: string
  classGroupId?: string
  teacherId?: string
  staffFields?: { recipient?: string, date?: string, location?: string, reason?: string }
  legacyTeacherNamesOnly?: boolean
  teacherSignatures?: DocumentIssuanceSnapshot['teacherSignatures']
  preview?: boolean
}

export interface AssembledDocumentSource {
  academicYearId: string
  sourceType: DocumentSourceType
  sourceId: string
  sourceVersion: string
  studentId?: string
  classGroupId?: string
  snapshot: DocumentIssuanceSnapshot
  portraitRequired: boolean
}

export function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

export async function requireYear(base: Pick<DocumentAssemblyContext<'academicYears'>, 'actor' | 'repositories'>, academicYearId: string) {
  const year = await base.repositories.academicYears.findById(academicYearId)
  if (!year || year.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year was not found')
  return year
}

/* eslint-disable dot-notation -- Snapshot payload records require bracket access. */
import type { DocumentIssuanceSnapshot, DocumentTeacher } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentOwnerKind, BusinessRuleViolationError, DOCUMENT_ISSUANCE_MAX_BYTES, resourceAccessScope, TEACHER_SIGNATURE_MAX_BYTES, TEACHER_SIGNATURE_PURPOSE } from '@edaya/core'
import { loadAttachmentAsset } from '../files/load-attachment-asset'
import { teacherSignatureDocumentPng } from '../files/teacher-signature-image'
import { bytesToDataUri } from './bytes-to-data-uri'

export function freezeDocumentTeachers(teachers: readonly DocumentTeacher[], captured?: DocumentIssuanceSnapshot['teacherSignatures']): DocumentTeacher[] {
  if (captured === undefined)
    return teachers.map(teacher => ({ ...teacher }))
  const signatures = new Map(captured.map(entry => [entry['teacherId'], entry.attachmentId]))
  return teachers.map(({ signatureAttachmentId: _id, signatureUrl: _url, ...teacher }) => ({
    ...teacher,
    ...(signatures.has(teacher['teacherId']) ? { signatureAttachmentId: signatures.get(teacher['teacherId']) } : {}),
  }))
}

export function freezeTeachersBySubject(teachers: ReadonlyMap<string, readonly DocumentTeacher[]>, captured?: DocumentIssuanceSnapshot['teacherSignatures']) {
  return new Map([...teachers].map(([id, entries]) => [id, freezeDocumentTeachers(entries, captured)]))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function teacherEntries(facts: Record<string, unknown>): Record<string, unknown>[] {
  const subjects = Array.isArray(facts['subjects']) ? facts['subjects'].map(record) : []
  const groups = [...subjects.map(row => row['teachers']), record(facts['council'])['homeroomTeachers'], facts['reporterTeachers']]
  return groups.flatMap(group => Array.isArray(group) ? group.map(record) : [])
}

export function captureTeacherSignatures(facts: Record<string, unknown>): NonNullable<DocumentIssuanceSnapshot['teacherSignatures']> {
  const signatures = new Map<string, string>()
  for (const teacher of teacherEntries(facts)) {
    if (typeof teacher['teacherId'] === 'string' && typeof teacher['signatureAttachmentId'] === 'string')
      signatures.set(teacher['teacherId'], teacher['signatureAttachmentId'])
  }
  return [...signatures].sort(([a], [b]) => a.localeCompare(b)).map(([teacherId, attachmentId]) => ({ teacherId, attachmentId }))
}

/** The consuming document supplies its authorization; standalone raw-image access remains self-only. */
export async function hydrateTeacherSignatures(
  base: BaseSchoolService,
  facts: Record<string, unknown>,
  authorizeDocument: () => Promise<unknown>,
  captured: NonNullable<DocumentIssuanceSnapshot['teacherSignatures']>,
): Promise<Record<string, unknown>> {
  const urls = new Map<string, string>()
  for (const { teacherId, attachmentId } of captured) {
    if (urls.has(attachmentId))
      continue
    try {
      const asset = await loadAttachmentAsset(base, {
        attachmentId,
        ownerKind: AttachmentOwnerKind.Teacher,
        ownerId: teacherId,
        allowedMimeTypes: ['image/png'],
        maxBytes: TEACHER_SIGNATURE_MAX_BYTES,
        verifyChecksum: true,
        access: {
          purpose: TEACHER_SIGNATURE_PURPOSE,
          readScope: async () => {
            await authorizeDocument()
            return resourceAccessScope(base.actor.schoolId, 'attachments', [{
              target: { kind: 'records', ids: [teacherId] },
              attachmentOwners: [AttachmentOwnerKind.Teacher],
              attachmentPurposes: [TEACHER_SIGNATURE_PURPOSE],
              attachmentIds: [attachmentId],
            }])
          },
        },
      })
      urls.set(attachmentId, bytesToDataUri(teacherSignatureDocumentPng(asset.body), 'image/png'))
    }
    catch {
      throw new BusinessRuleViolationError('TEACHER_SIGNATURE_ASSET_UNAVAILABLE', 'A captured teacher signature could not be loaded; retry the document')
    }
  }
  const admitted = new Map(captured.map(entry => [entry['teacherId'], entry.attachmentId]))
  const hydrate = (value: unknown) => Array.isArray(value)
    ? value.map((entry) => {
        const { signatureAttachmentId: _id, signatureUrl: _url, ...teacher } = record(entry)
        const id = typeof teacher['teacherId'] === 'string' ? admitted.get(teacher['teacherId']) : undefined
        return { ...teacher, ...(id && urls.has(id) ? { signatureUrl: urls.get(id) } : {}) }
      })
    : undefined
  const subjects = Array.isArray(facts['subjects'])
    ? facts['subjects'].map((entry) => {
        const row = record(entry)
        return { ...row, ...(row['teachers'] ? { teachers: hydrate(row['teachers']) } : {}) }
      })
    : undefined
  const council = record(facts['council'])
  const result = {
    ...facts,
    ...(subjects ? { subjects } : {}),
    ...(facts['council'] ? { council: { ...council, ...(council['homeroomTeachers'] ? { homeroomTeachers: hydrate(council['homeroomTeachers']) } : {}) } } : {}),
    ...(facts['reporterTeachers'] ? { reporterTeachers: hydrate(facts['reporterTeachers']) } : {}),
  }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > DOCUMENT_ISSUANCE_MAX_BYTES)
    throw new BusinessRuleViolationError('TEACHER_SIGNATURE_ASSET_UNAVAILABLE', 'Teacher signatures exceed the document render budget')
  return result
}

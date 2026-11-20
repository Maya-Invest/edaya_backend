import type { Attachment } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentStatus, resourceAccessScope } from '@edaya/core'
import { signAttachmentDownload } from './grant-attachment-download'
import { publishedStudentPortraitScope } from './profile-photo-access'

interface PortraitReference { studentId: string, attachmentId: string }

/** Each snapshot applies the same visible-student and published-attachment predicates as the individual portrait read. */
function readPublishedPortraits(base: BaseSchoolService, requested: readonly PortraitReference[]) {
  return base.atomicExecution.execute(async () => {
    const students = await base.entities.students.findByIds([...new Set(requested.map(row => row.studentId))])
    const published = new Map(students.map(row => [row.id, row.photoAttachmentId]))
    const matched = requested.filter(row => published.get(row.studentId) === row.attachmentId)
    const unique = new Map(matched.map(row => [row.attachmentId, row]))
    if (!matched.length)
      return new Map<string, Attachment>()
    const schoolId = base.actor.schoolId
    const scope = resourceAccessScope(schoolId, 'attachments', [...unique.values()].flatMap(row =>
      publishedStudentPortraitScope(schoolId, row.studentId, row.attachmentId).clauses))
    const attachments = await base.repositories.attachments.forAccess(scope).findByIds([...unique.keys()])
    return new Map(attachments.filter(a => a.status === AttachmentStatus.Ready && a.storageKey).map(a => [a.id, a]))
  }, { readSnapshot: true })
}

/** Sign outside database transactions. Return only grants still authorized after signing. */
export async function getStudentPortraitGrants(base: BaseSchoolService, photos: readonly PortraitReference[]) {
  if (photos.length === 0 || photos.length > 25)
    throw new RangeError('Expected one through 25 portraits')
  const before = await readPublishedPortraits(base, photos)
  if (!before.size)
    return { grants: [] }
  const signed = await Promise.all([...before.values()].map(async (attachment) => {
    try {
      const grant = await signAttachmentDownload(base, attachment, attachment.storageKey!)
      return { attachment, grant }
    }
    catch {
      // The other visible rows can still display their portraits.
      return undefined
    }
  }))
  const after = await readPublishedPortraits(base, photos)
  const grants = []
  for (const entry of signed) {
    if (!entry)
      continue
    const { attachment, grant } = entry
    const current = after.get(attachment.id)
    if (current && JSON.stringify(current.data) === JSON.stringify(attachment.data)) {
      grants.push({ studentId: current.ownerId, attachmentId: current.id, checksum: current.checksum ?? null, downloadUrl: grant.downloadUrl, expiresAt: grant.expiresAt.toISOString() })
    }
  }
  return { grants }
}

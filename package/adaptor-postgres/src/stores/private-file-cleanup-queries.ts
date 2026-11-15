import { STUDENT_PHOTO_ABANDONED_MS, STUDENT_PORTRAIT_PURPOSE } from '@edaya/core'
import { sql } from 'drizzle-orm'

export const duePrivateFileObject = sql`status IN ('reserved', 'deleted') AND protected_until <= clock_timestamp()
  AND NOT private_file_object_is_referenced(storage_key)`

export function isAbandonedPortrait(asOf: Date) {
  const cutoff = new Date(asOf.getTime() - STUDENT_PHOTO_ABANDONED_MS).toISOString()
  return sql`a.owner_kind = 'student' AND a.purpose = ${STUDENT_PORTRAIT_PURPOSE}
    AND a.created_at <= ${cutoff} AND (a.storage_key IS NULL OR a.file_url IS NULL)
    AND NOT EXISTS (SELECT 1 FROM student_photo_submissions p WHERE p.school_id = a.school_id AND p.attachment_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = a.school_id AND s.id = a.owner_id AND s.photo_attachment_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM private_file_references r WHERE r.attachment_id = a.id)`
}

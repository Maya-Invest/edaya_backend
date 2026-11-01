import { BusinessRuleViolationError } from '@edaya/core'

/** PostgreSQL/Drizzle errors may carry private URL parameters; never return them for file constraints. */
export function rethrowPrivateFileConstraint(error: unknown): never {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { message?: unknown, constraint?: unknown, cause?: unknown }
    if (typeof value.constraint === 'string' && value.constraint.startsWith('attachments_purpose_'))
      throw new BusinessRuleViolationError('ATTACHMENT_PURPOSE_INVALID', 'Attachment purpose cannot be changed or invalid')
    if (typeof value.constraint === 'string' && value.constraint.startsWith('private_file_references_attachment_id'))
      throw new BusinessRuleViolationError('ATTACHMENT_REFERENCED', 'Remove the attachment reference before deleting the attachment')
    if ((typeof value.message === 'string' && /^PRIVATE_FILE_REFERENCE_(?:INVALID|UNAVAILABLE)$/.test(value.message))
      || (typeof value.constraint === 'string' && value.constraint.startsWith('private_file_'))) {
      throw new BusinessRuleViolationError('PRIVATE_FILE_REFERENCE_INVALID', 'The private file reference is unavailable')
    }
    current = value.cause
  }
  throw error
}

export async function withPrivateFileConstraintErrors<T>(operation: () => T | PromiseLike<T>): Promise<T> {
  try {
    return await operation()
  }
  catch (error) {
    rethrowPrivateFileConstraint(error)
  }
}

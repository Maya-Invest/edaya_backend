const UNSAFE_SEGMENT = /[/\\]/g

/** Strip path segments and collapse whitespace for safe object key file names. */
export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.replace(UNSAFE_SEGMENT, '').trim()
  if (!baseName) {
    throw new Error('fileName must not be blank after sanitization')
  }
  return baseName
}

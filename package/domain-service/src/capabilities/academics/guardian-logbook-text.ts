/** Family-visible parts of the lesson note, in display order. */
export function guardianLogbookText(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  if (!value || !value.startsWith('{"edayaLogbook":'))
    return value || undefined
  try {
    const note = JSON.parse(value)?.edayaLogbook
    if (!note || typeof note !== 'object')
      return undefined
    return [note.content, ...(Array.isArray(note.objectives) ? note.objectives : []), note.homework]
      .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
      .map(part => part.trim())
      .join('\n') || undefined
  }
  catch { return undefined }
}

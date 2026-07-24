export function buildDocsArtifactKey(input: {
  readonly schoolId: string
  readonly templateKey: string
  readonly renderId: string
  readonly fileName: string
}): string {
  return `${input.schoolId}/docs/${input.templateKey}/${input.renderId}/${input.fileName}`
}

export function fileNameForFormat(format: 'pdf' | 'xlsx', templateKey: string): string {
  const base = templateKey.replaceAll('.', '-')
  return format === 'pdf' ? `${base}.pdf` : `${base}.xlsx`
}

export function createObjectId(): string {
  return `obj_${crypto.randomUUID().replaceAll('-', '')}`
}

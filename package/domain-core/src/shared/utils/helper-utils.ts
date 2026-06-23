export function dateTime(value: Date | undefined): number | undefined {
  return value?.getTime()
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

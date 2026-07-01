export function splitDisplayName(fullName: string): { firstName: string, lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? 'Unknown', lastName: parts[0] ?? 'Unknown' }
  }
  return { firstName: parts[0] ?? 'Unknown', lastName: parts.slice(1).join(' ') }
}

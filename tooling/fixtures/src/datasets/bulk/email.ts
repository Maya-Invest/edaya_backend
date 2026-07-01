const GUARDIAN_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.ca',
  'icloud.com',
  'live.ca',
] as const

function slugifyEmailPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Realistic guardian inbox — aligned with narrative fixtures (e.g. n.martin@mail.com). */
export function buildBulkGuardianEmail(
  parentFirstName: string,
  lastName: string,
  studentNumber: number,
): string {
  const first = slugifyEmailPart(parentFirstName)
  const last = slugifyEmailPart(lastName)
  const domain = GUARDIAN_EMAIL_DOMAINS[studentNumber % GUARDIAN_EMAIL_DOMAINS.length]!
  const tag = String(studentNumber)

  switch (studentNumber % 4) {
    case 0:
      return `${first.charAt(0)}.${last}${tag}@${domain}`
    case 1:
      return `${first}.${last}${tag}@${domain}`
    case 2:
      return `${first.charAt(0)}.${last}.${tag}@${domain}`
    default:
      return `${first}${tag}@${domain}`
  }
}

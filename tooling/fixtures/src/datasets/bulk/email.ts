const GUARDIAN_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.ca',
  'icloud.com',
  'live.ca',
] as const

const CI_GUARDIAN_EMAIL_DOMAINS = [
  'mail.ci',
  'gmail.com',
  'yahoo.fr',
  'outlook.fr',
  'hotmail.fr',
  'live.fr',
] as const

function slugifyEmailPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function buildGuardianEmailFromDomains(
  parentFirstName: string,
  lastName: string,
  studentNumber: number,
  domains: readonly string[],
): string {
  const first = slugifyEmailPart(parentFirstName)
  const last = slugifyEmailPart(lastName)
  const domain = domains[studentNumber % domains.length]!
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

/** Realistic guardian inbox — aligned with narrative fixtures (e.g. n.martin@mail.com). */
export function buildBulkGuardianEmail(
  parentFirstName: string,
  lastName: string,
  studentNumber: number,
): string {
  return buildGuardianEmailFromDomains(parentFirstName, lastName, studentNumber, GUARDIAN_EMAIL_DOMAINS)
}

/** Ivorian guardian inbox — prefers `@mail.ci` with French webmail fallbacks. */
export function buildBulkGuardianEmailCi(
  parentFirstName: string,
  lastName: string,
  studentNumber: number,
): string {
  return buildGuardianEmailFromDomains(parentFirstName, lastName, studentNumber, CI_GUARDIAN_EMAIL_DOMAINS)
}

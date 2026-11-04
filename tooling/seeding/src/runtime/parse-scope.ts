import type { HttpDevSeedScope } from './types'

export function parseHttpDevSeedScope(argv: string[]): HttpDevSeedScope {
  const arg = argv.slice(2).find(entry => !entry.startsWith('-'))

  if (!arg || arg === 'all') {
    return 'all'
  }

  if (
    arg === 'school'
    || arg === 'school-switching'
    || arg === 'auth'
    || arg === 'auth:link'
    || arg === 'access'
    || arg === 'profile-pictures'
    || arg === 'smoke'
    || arg === 'service-account'
    || arg === 's2s-clients'
    || arg === 'validate'
    || arg === 'doctor'
  ) {
    return arg
  }

  throw new Error(
    `Unknown HTTP seed scope: ${arg}. Valid scopes: all, school, school-switching, auth, auth:link, access, profile-pictures, service-account, s2s-clients, smoke, validate, doctor`,
  )
}

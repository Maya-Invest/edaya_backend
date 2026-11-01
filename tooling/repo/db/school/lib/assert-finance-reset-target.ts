import process from 'node:process'

const LOOPBACK_HOST = '127.0.0.1'

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  return env[key]
}

function parseHostname(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, 'postgres://')).hostname.toLowerCase()
  }
  catch {
    throw new Error('Finance reset URL is not a valid Postgres connection string.')
  }
}

export function assertLoopbackNativeFinanceResetUrl(databaseUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error('Finance reset requires an explicit loopback URL. It never reads DATABASE_URL.')
  }
  if (trimmed === 'pglite' || trimmed.startsWith('pglite:') || trimmed === 'memory') {
    throw new Error('Finance reset requires the disposable native-runner Postgres cluster, not PGlite.')
  }
  const databaseUrlDefault = readEnv(env, 'DATABASE_URL')?.trim()
  if (databaseUrlDefault && trimmed === databaseUrlDefault) {
    throw new Error('Refuse to reset: the explicit URL must not reuse DATABASE_URL.')
  }
  const hostname = parseHostname(trimmed)
  if (hostname !== LOOPBACK_HOST) {
    throw new Error(`Finance reset refuses ${hostname}. Only the recorded 127.0.0.1 native-runner cluster is admitted.`)
  }
  return trimmed
}

export function assertRecordedFinanceSchoolId(schoolId: string): string {
  const trimmed = schoolId.trim()
  if (!/^[\w:-]+$/.test(trimmed)) {
    throw new Error('Finance reset schoolId must be a recorded fixture identity.')
  }
  return trimmed
}

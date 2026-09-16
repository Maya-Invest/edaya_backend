import type { HttpSeedClient } from '../transport/http/client'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { postEntityCount, postEntityList } from '../transport/http/core-entity'
import { isServiceAccountApiKeyValid } from '../transport/http/verify-service-account'
import {
  isLocalDevApiUrl,
  probeLocalFilesService,
  resolveLocalFilesUrl,
} from './profile-photo-preflight'
import { countPublishedProfilePhotos } from './published-profile-photos'

function expectedAccessPermissionAssignments(): number {
  const context = resolveDevSeedContext()
  return resolveExpectedCounts(context.dataset)['staff-permission-assignments'] ?? 0
}

function expectedProfilePhotoCount(): number {
  const context = resolveDevSeedContext()
  return resolveExpectedCounts(context.dataset)['profile-photos'] ?? 0
}

export type SeedDoctorStatus = 'healthy' | 'repairable' | 'broken'

export interface SeedDoctorFinding {
  severity: 'ok' | 'warn' | 'error'
  code: string
  message: string
  repair?: string
}

export interface SeedDoctorResult {
  status: SeedDoctorStatus
  findings: readonly SeedDoctorFinding[]
}

const WIPE_AND_RESEED_REPAIR = 'Stop `bun repo dev`, run `bun repo seed clean --yes`, restart the API, then `bun repo seed`.'

function finding(
  severity: SeedDoctorFinding['severity'],
  code: string,
  message: string,
  repair?: string,
): SeedDoctorFinding {
  return { severity, code, message, repair }
}

export async function runHttpSeedDoctor(
  client: HttpSeedClient,
  serviceAccountApiKey?: string,
): Promise<SeedDoctorResult> {
  const context = resolveDevSeedContext()
  const findings: SeedDoctorFinding[] = []

  const health = await client.jsonRequest('/')
  if (!health.response.ok) {
    findings.push(finding(
      'error',
      'api-unreachable',
      `API at ${client.origin} returned HTTP ${health.response.status}.`,
      'Start the API (`bun repo dev`) and retry.',
    ))
    return { status: 'broken', findings }
  }

  findings.push(finding('ok', 'api-reachable', `API at ${client.origin} is reachable.`))

  const signInResponse = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: context.minimalStaffEmail,
      password: context.authPassword,
    }),
  })

  if (!signInResponse.ok) {
    findings.push(finding(
      'error',
      'auth-missing',
      `Dev staff sign-in failed for ${context.minimalStaffEmail} (HTTP ${signInResponse.status}).`,
      `Run \`bun repo seed\` while the API is up. ${WIPE_AND_RESEED_REPAIR}`,
    ))
    return { status: 'broken', findings }
  }

  findings.push(finding('ok', 'auth-present', `Dev staff sign-in succeeded for ${context.minimalStaffEmail}.`))

  const staffGrants = await client.jsonRequest('/core/authorization/effective-grants')
  if (!staffGrants.response.ok) {
    findings.push(finding(
      'warn',
      'staff-unlinked',
      'Sign-in succeeded but effective-grants failed — staff actor is likely not linked.',
      `Run \`bun repo seed --scope auth:link\` or \`bun repo seed --scope doctor --repair\`. ${WIPE_AND_RESEED_REPAIR}`,
    ))
  }
  else {
    findings.push(finding('ok', 'staff-grants', 'Dev staff effective-grants resolved.'))
  }

  const listOptions = serviceAccountApiKey && await isServiceAccountApiKeyValid(client, serviceAccountApiKey)
    ? { client, serviceAccountApiKey, requestId: 'http-seed-doctor' }
    : { client, requestId: 'http-seed-doctor' }

  let schools: unknown[] = []
  try {
    schools = await postEntityList(listOptions, 'schools')
  }
  catch {
    findings.push(finding(
      'error',
      'school-missing',
      'Could not list schools. The identity session may be valid while the school database is empty.',
      `Run \`bun repo seed\`. ${WIPE_AND_RESEED_REPAIR}`,
    ))
    return { status: 'broken', findings }
  }
  const demoSchool = schools.find(school => typeof school === 'object' && school && 'id' in school && school.id === context.schoolId)

  if (schools.length === 0) {
    findings.push(finding(
      'error',
      'school-missing',
      'No school records found in the database.',
      `Run \`bun repo seed\`. ${WIPE_AND_RESEED_REPAIR}`,
    ))
    return { status: 'broken', findings }
  }

  if (!demoSchool) {
    findings.push(finding(
      'warn',
      'demo-school-missing',
      `School data exists (${schools.length} school(s)) but expected demo school ${context.schoolId} is absent.`,
      'Check `SEED_DATASET` / `SEED_SCHOOL_ID`, then reseed.',
    ))
  }
  else {
    findings.push(finding('ok', 'demo-school-present', `Demo school ${context.schoolId} is present.`))
  }

  const studentCount = await postEntityCount(listOptions, 'students', { schoolId: context.schoolId })
  if (studentCount === 0) {
    findings.push(finding(
      'error',
      'students-missing',
      `Demo school ${context.schoolId} has no students.`,
      `Run \`bun repo seed\`. ${WIPE_AND_RESEED_REPAIR}`,
    ))
    return { status: 'broken', findings }
  }

  findings.push(finding('ok', 'students-present', `Demo school has ${studentCount} student(s).`))

  if (serviceAccountApiKey) {
    const apiKeyValid = await isServiceAccountApiKeyValid(client, serviceAccountApiKey)
    if (!apiKeyValid) {
      findings.push(finding(
        'warn',
        'service-account-key-rejected',
        'The profile seeding API key was rejected (401).',
        'Run `bun repo seed --scope doctor --repair` or `bun repo seed` on a fresh database.',
      ))
    }
    else {
      const serviceGrants = await client.jsonRequest('/core/authorization/effective-grants', {
        headers: { authorization: `Bearer ${serviceAccountApiKey}` },
      })
      if (!serviceGrants.response.ok) {
        findings.push(finding(
          'warn',
          'service-account-grants',
          'Seeding service account API key is accepted but effective-grants failed.',
          'Run `bun repo seed --scope doctor --repair` or `bun repo seed` to reprovision the seeding service account.',
        ))
      }
      else {
        findings.push(finding('ok', 'service-account-ready', 'Seeding service account API key is valid.'))
      }
    }
  }

  if (demoSchool) {
    const expectedPermissions = expectedAccessPermissionAssignments()
    if (expectedPermissions > 0) {
      const permissionCount = await postEntityCount(listOptions, 'staffPermissionAssignments', { schoolId: context.schoolId })
      if (permissionCount < expectedPermissions) {
        findings.push(finding(
          'warn',
          'access-assignments-missing',
          `Demo school has ${permissionCount} staff permission assignment(s); expected at least ${expectedPermissions}.`,
          'Run `bun repo seed --scope access` or `bun repo seed --scope doctor --repair`.',
        ))
      }
      else {
        findings.push(finding(
          'ok',
          'access-assignments-present',
          `Staff permission assignments present (${permissionCount}).`,
        ))
      }
    }

    const expectedPhotos = expectedProfilePhotoCount()
    if (expectedPhotos > 0) {
      const canSeedPhotos = !isLocalDevApiUrl(client.origin)
        || await probeLocalFilesService(resolveLocalFilesUrl())

      if (!canSeedPhotos) {
        findings.push(finding(
          'warn',
          'profile-photos-unavailable',
          `Local file storage is not reachable at ${resolveLocalFilesUrl()}; profile photos were not checked.`,
          'Start `bun repo dev` (API + @edaya/local-files-server), then run `bun repo seed --scope profile-pictures`.',
        ))
      }
      else {
        const photoCount = await countPublishedProfilePhotos(listOptions)
        if (photoCount < expectedPhotos) {
          findings.push(finding(
            'warn',
            'profile-photos-missing',
            `Demo school has ${photoCount} published profile photo(s); expected at least ${expectedPhotos}.`,
            'Run `bun repo seed --scope profile-pictures` or `bun repo seed --scope doctor --repair`.',
          ))
        }
        else {
          findings.push(finding(
            'ok',
            'profile-photos-present',
            `Profile photos present (${photoCount}).`,
          ))
        }
      }
    }
  }

  const hasError = findings.some(entry => entry.severity === 'error')
  const hasWarn = findings.some(entry => entry.severity === 'warn')
  return {
    status: hasError ? 'broken' : hasWarn ? 'repairable' : 'healthy',
    findings,
  }
}

export function logSeedDoctorResult(result: SeedDoctorResult): void {
  for (const entry of result.findings) {
    const prefix = entry.severity === 'ok' ? '✓' : entry.severity === 'warn' ? '!' : '✗'
    // eslint-disable-next-line no-console
    console.log(`${prefix} [${entry.code}] ${entry.message}`)
    if (entry.repair) {
      // eslint-disable-next-line no-console
      console.log(`    → ${entry.repair}`)
    }
  }

  if (result.status === 'healthy') {
    // eslint-disable-next-line no-console
    console.log('Seed doctor: database looks healthy.')
  }
  else if (result.status === 'repairable') {
    // eslint-disable-next-line no-console
    console.log('Seed doctor: repairable issues detected (see above).')
  }
  else {
    // eslint-disable-next-line no-console
    console.log('Seed doctor: database is not ready for dev login.')
  }
}

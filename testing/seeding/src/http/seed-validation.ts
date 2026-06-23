/* eslint-disable dot-notation -- Record<string, unknown> responses require bracket access for tsc */
import type { CoreHttpRequestOptions } from './core-entity'
import {
  assertSeedManifestComplete,
  buildSeedQueryValidationTargets,
  buildSeedValidationTargets,
  countSeedStudents,
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { signInViaHttp } from './auth'
import { isSeedEntityKey } from './catalog'
import { postEntityList } from './core-entity'

export interface SeedEntityValidationResult {
  entity: string
  serviceName: string
  expectedMin: number
  actual: number
  status: 'passed' | 'failed'
  httpStatus?: number
  reason?: string
}

export interface SeedQueryValidationResult {
  name: string
  path: string
  status: 'passed' | 'failed'
  httpStatus: number
  reason?: string
}

export interface HttpSeedValidationResult {
  status: 'passed' | 'failed'
  entities: SeedEntityValidationResult[]
  queries: SeedQueryValidationResult[]
  failures: string[]
}

async function validateEntityTarget(
  options: CoreHttpRequestOptions,
  target: ReturnType<typeof buildSeedValidationTargets>[number],
): Promise<SeedEntityValidationResult> {
  try {
    if (!isSeedEntityKey(target.serviceName)) {
      throw new Error(`Generated API bindings do not contain entity key: ${target.serviceName}`)
    }
    const rows = await postEntityList(options, target.serviceName)
    const actual = rows.length
    const passed = actual >= target.minCount
    return {
      entity: target.entity,
      serviceName: target.serviceName,
      expectedMin: target.minCount,
      actual,
      status: passed ? 'passed' : 'failed',
      ...(passed ? {} : { reason: `Expected >= ${target.minCount}, got ${actual}` }),
    }
  }
  catch (error) {
    return {
      entity: target.entity,
      serviceName: target.serviceName,
      expectedMin: target.minCount,
      actual: 0,
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

async function validateQueryTarget(
  options: CoreHttpRequestOptions,
  target: ReturnType<typeof buildSeedQueryValidationTargets>[number],
): Promise<SeedQueryValidationResult> {
  const { response, body } = await options.client.jsonRequest<Record<string, unknown>>(
    target.path,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.serviceAccountApiKey ? { authorization: `Bearer ${options.serviceAccountApiKey}` } : {}),
        ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
      },
      body: JSON.stringify(target.payload),
    },
  )

  if (!response.ok) {
    return {
      name: target.name,
      path: target.path,
      status: 'failed',
      httpStatus: response.status,
      reason: `HTTP ${response.status}`,
    }
  }

  if (target.name === 'get-school-overview') {
    const kpis = body?.['kpis'] as { studentCount?: number } | undefined
    const studentCount = kpis?.['studentCount'] ?? 0
    if (studentCount < countSeedStudents()) {
      return {
        name: target.name,
        path: target.path,
        status: 'failed',
        httpStatus: response.status,
        reason: `Overview studentCount ${studentCount} < ${countSeedStudents()}`,
      }
    }
  }

  if (target.minCount !== undefined) {
    const count = typeof body?.['count'] === 'number' ? body['count'] : 0
    if (count < target.minCount) {
      return {
        name: target.name,
        path: target.path,
        status: 'failed',
        httpStatus: response.status,
        reason: `Expected count >= ${target.minCount}, got ${count}`,
      }
    }
  }

  return {
    name: target.name,
    path: target.path,
    status: 'passed',
    httpStatus: response.status,
  }
}

export async function runHttpSeedValidation(
  options: CoreHttpRequestOptions & { useStaffSession?: boolean },
): Promise<HttpSeedValidationResult> {
  assertSeedManifestComplete()

  if (options.useStaffSession !== false && !options.serviceAccountApiKey) {
    await signInViaHttp(options.client, {
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
    })
  }

  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: options.requestId ?? 'http-seed-validate',
  }

  const entityResults = await Promise.all(
    buildSeedValidationTargets().map(target => validateEntityTarget(requestOptions, target)),
  )

  const queryResults = await Promise.all(
    buildSeedQueryValidationTargets().map(target => validateQueryTarget(requestOptions, target)),
  )

  const failures = [
    ...entityResults.filter(result => result.status === 'failed').map(result => `${result.entity}: ${result.reason}`),
    ...queryResults.filter(result => result.status === 'failed').map(result => `${result.name}: ${result.reason}`),
  ]

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    entities: entityResults,
    queries: queryResults,
    failures,
  }
}

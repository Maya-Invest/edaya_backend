#!/usr/bin/env bun

import process from 'node:process'
import postgres from 'postgres'
import { assertLoopbackNativeFinanceResetUrl, assertRecordedFinanceSchoolId } from './lib/assert-finance-reset-target'
import { captureFinancePreservationDigestBySql, resetFinanceTablesBySql } from './lib/reset-finance-tables'

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const matched = process.argv.find(value => value.startsWith(prefix))
  return matched ? matched.slice(prefix.length) : undefined
}

function envString(key: string): string | undefined {
  return process.env[key]
}

const databaseUrl = assertLoopbackNativeFinanceResetUrl(
  readArg('url') ?? envString('EDAYA_NATIVE_TEST_URL') ?? '',
)
const schoolId = assertRecordedFinanceSchoolId(readArg('school-id') ?? '')

const client = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
})

async function query(statement: string): Promise<Array<Record<string, unknown>>> {
  return await client.unsafe(statement) as unknown as Array<Record<string, unknown>>
}

try {
  const before = await captureFinancePreservationDigestBySql(query, schoolId)
  await resetFinanceTablesBySql(query, schoolId)
  const after = await captureFinancePreservationDigestBySql(query, schoolId)
  if (before.identity !== after.identity || before.content !== after.content)
    throw new Error('Finance reset changed preserved identity or content digests.')
  console.log(`Finance reset complete for ${schoolId} on loopback native-runner identity.`)
  console.log(`preservation identity ${after.identity}`)
  console.log(`preservation content ${after.content}`)
}
finally {
  await client.end({ timeout: 5 })
}

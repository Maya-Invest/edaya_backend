#!/usr/bin/env bun

import process from 'node:process'
import { assertFinanceResetTarget, resetDisposableFinanceRecords } from '@edaya/adaptor-postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

function envString(key: string): string | undefined {
  return process.env[key]
}

const url = assertFinanceResetTarget(envString('EDAYA_FINANCE_RESET_URL'))
const client = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
})
const db = drizzle(client)

try {
  console.log('> Resetting disposable finance records on loopback target')
  await resetDisposableFinanceRecords(db)
  console.log('Finance reset complete. Non-finance rows and command journal were not cleared.')
}
finally {
  await client.end({ timeout: 5 })
}

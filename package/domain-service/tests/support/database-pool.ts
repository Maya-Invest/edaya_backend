import { createRepositoryDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

type RepositoryDatabase = Awaited<ReturnType<typeof createRepositoryDatabase>>

const availableDatabases: RepositoryDatabase[] = []
const usedDatabases = new Set<RepositoryDatabase>()

async function emptyDatabase(fixture: RepositoryDatabase): Promise<boolean> {
  try {
    const { rows } = await fixture.db.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'')
    const tables = rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    if (tables.length)
      await fixture.db.exec(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
    return true
  }
  catch {
    try {
      await fixture.db.close()
    }
    catch {}
    return false
  }
}

export async function resetServiceTestDatabases(): Promise<void> {
  const fixtures = [...usedDatabases]
  usedDatabases.clear()
  for (const fixture of fixtures) {
    if (await emptyDatabase(fixture))
      availableDatabases.push(fixture)
  }
}

export async function closeServiceTestDatabases(): Promise<void> {
  if (usedDatabases.size > 0)
    return
  const idle = availableDatabases.splice(0)
  for (const fixture of idle) {
    try {
      await fixture.db.close()
    }
    catch {}
  }
}

// Reuse empty SQL databases, never application instances or authorization facts.
// Repeated Wasm initialization exhausts memory in the complete service suite.
export async function acquireDatabase(): Promise<RepositoryDatabase> {
  while (availableDatabases.length > 0) {
    const fixture = availableDatabases.pop()!
    if (await emptyDatabase(fixture)) {
      usedDatabases.add(fixture)
      return fixture
    }
  }
  const fixture = await createRepositoryDatabase()
  usedDatabases.add(fixture)
  return fixture
}

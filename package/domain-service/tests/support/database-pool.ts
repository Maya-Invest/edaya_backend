import { createRepositoryDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

type RepositoryDatabase = Awaited<ReturnType<typeof createRepositoryDatabase>>
const availableDatabases: RepositoryDatabase[] = []
const usedDatabases = new Set<RepositoryDatabase>()
export async function resetServiceTestDatabases() {
  for (const fixture of usedDatabases) {
    const { rows } = await fixture.db.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'')
    const tables = rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    if (tables.length)
      await fixture.db.exec(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
    availableDatabases.push(fixture)
  }
  usedDatabases.clear()
}
export async function closeServiceTestDatabases() {
  for (const fixture of [...availableDatabases, ...usedDatabases]) await fixture.db.close()
  availableDatabases.length = 0
  usedDatabases.clear()
}

// Reuse empty SQL databases, never application instances or authorization facts.
// Repeated Wasm initialization exhausts memory in the complete service suite.
export async function acquireDatabase(): Promise<RepositoryDatabase> {
  const fixture = availableDatabases.pop() ?? await createRepositoryDatabase()
  usedDatabases.add(fixture)
  return fixture
}

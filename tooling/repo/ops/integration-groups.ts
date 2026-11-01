import { relative, resolve } from 'node:path'
import { root, run, verificationPhase } from './runtime'

export const integrationGroups = ['services', 'adapters-http', 'seed-native'] as const
export type IntegrationGroup = typeof integrationGroups[number]

/** Exhaustive ownership: new integration locations require an explicit lane. */
export function integrationOwner(path: string): IntegrationGroup | undefined {
  const owners: IntegrationGroup[] = []
  if (/^package\/domain-(?:service|authorization)\/.*\.integration\.test\.ts$/.test(path)
    || /^tooling\/integration-tests\/src\/(?:services|runtime|adaptor)\//.test(path)) {
    owners.push('services')
  }
  if (/^(?:package\/adaptor-[^/]+|apps\/api)\/.*\.integration\.test\.ts$/.test(path)
    || /^tooling\/integration-tests\/src\/(?:auth|routes|compatibility)\//.test(path)) {
    owners.push('adapters-http')
  }
  if (/^tooling\/integration-tests\/src\/(?:seed|native)\//.test(path))
    owners.push('seed-native')
  if (owners.length > 1)
    throw new Error(`Multiply assigned integration test: ${path}`)
  return owners[0]
}

export function integrationInventory(): Record<IntegrationGroup, string[]> {
  const inventory: Record<IntegrationGroup, string[]> = { 'services': [], 'adapters-http': [], 'seed-native': [] }
  const candidates = ['package', 'apps', 'tooling'].flatMap(directory => Array.from(new Bun.Glob('**/*.test.ts').scanSync({ cwd: resolve(root, directory), onlyFiles: true })).filter(path => !path.split('/').includes('node_modules')).map(path => `${directory}/${path}`))
  for (const path of candidates) {
    const central = path.startsWith('tooling/integration-tests/src/')
    const optional = path.startsWith('tooling/integration-tests/src/benchmarks/') || path === 'package/adaptor-r2/tests/r2-file-storage.integration.test.ts'
    if (optional || (!central && !path.endsWith('.integration.test.ts')))
      continue
    const owner = integrationOwner(path)
    if (!owner)
      throw new Error(`Unassigned integration test: ${path}`)
    inventory[owner].push(path)
  }
  const assigned = Object.values(inventory).flat()
  if (new Set(assigned).size !== assigned.length || integrationGroups.some(group => !inventory[group].length))
    throw new Error('Duplicate or empty integration group')
  return inventory
}

export async function runIntegrationGroup(group: IntegrationGroup): Promise<void> {
  const inventory = integrationInventory()
  const packages = new Set(inventory[group].filter(path => !path.startsWith('tooling/')).map(path => path.split('/').slice(0, 2).join('/')))
  for (const directory of [...packages].sort()) {
    const manifest = await Bun.file(resolve(root, directory, 'package.json')).json()
    if (!manifest.scripts?.['test:integration'])
      throw new Error(`Missing integration command: ${directory}`)
    await verificationPhase(`integration ${relative(root, resolve(root, directory))}`, () => run(['bun', 'run', 'test:integration'], { cwd: resolve(root, directory), timeout: 120 * 60000 }))
  }
  const slices = group === 'services' ? ['api'] : group === 'adapters-http' ? ['http'] : ['seed', 'native']
  for (const slice of slices)
    await verificationPhase(`integration ${slice}`, () => run(['bun', 'run', `test:integration:${slice}`], { cwd: resolve(root, 'tooling/integration-tests'), timeout: 120 * 60000 }))
}

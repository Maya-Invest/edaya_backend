import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface ContractRegistry {
  readonly packets: readonly {
    readonly key: string
    readonly path: string
  }[]
}

interface ContractPacket {
  readonly key: string
  readonly status: string
  readonly contractSource?: string
  readonly semanticSpec?: string
  readonly testAssets?: {
    readonly conformanceSuite?: {
      readonly path: string
    }
  }
}

const root = resolve(import.meta.dir, '../../..')
const registryPath = join(root, 'contracts/registry.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as ContractRegistry

const failures: string[] = []

for (const entry of registry.packets) {
  const packetPath = join(root, entry.path)
  if (!existsSync(packetPath)) {
    failures.push(`Missing packet file: ${entry.path}`)
    continue
  }

  const packet = JSON.parse(readFileSync(packetPath, 'utf8')) as ContractPacket
  if (packet.key !== entry.key)
    failures.push(`Packet key mismatch for ${entry.path}`)

  if (packet.contractSource && !existsSync(join(root, packet.contractSource)))
    failures.push(`Missing contract source: ${packet.contractSource}`)

  if (packet.semanticSpec && !existsSync(join(root, packet.semanticSpec)))
    failures.push(`Missing semantic spec: ${packet.semanticSpec}`)

  const suitePath = packet.testAssets?.conformanceSuite?.path
  if (suitePath && !existsSync(join(root, suitePath)))
    failures.push(`Missing conformance suite: ${suitePath}`)
}

if (failures.length > 0) {
  console.error('Contract check failed:')
  for (const failure of failures)
    console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Contract check passed (${registry.packets.length} packet(s)).`)

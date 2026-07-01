import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Monorepo root (`edaya_backend/`). */
export function resolveRepoRoot(fromModuleUrl: string): string {
  const moduleDir = path.dirname(fileURLToPath(fromModuleUrl))
  return path.resolve(moduleDir, '../../../..')
}

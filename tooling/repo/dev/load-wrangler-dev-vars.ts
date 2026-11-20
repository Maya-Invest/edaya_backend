import process from 'node:process'
import { loadConfiguration } from '../../../apps/api/configuration/index.ts'

/** Staging settings plus private Wrangler-local secrets; never used by bun dev. */
export function loadWranglerDevVars(): void {
  Object.assign(process.env, loadConfiguration('staging'))
}

import process from 'node:process'
import { loadConfiguration } from '../../../apps/api/configuration/index.mjs'

/** Staging settings plus private Wrangler-local secrets; never used by bun dev. */
export function loadWranglerDevVars(): void {
  Object.assign(process.env, loadConfiguration('staging'))
}

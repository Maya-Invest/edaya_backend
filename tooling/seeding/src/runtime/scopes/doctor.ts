import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import { runHttpSeedDoctor } from '../../diagnostics/seed-doctor'
import { runHttpSeedDoctorWithRepair } from '../../diagnostics/seed-doctor-repair'
import { createEmptyHttpSeedResults } from '../helpers'
import { logHttpDevSeedResults } from '../log-http-results'

export async function runDoctorScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const { client, options, serviceAccountApiKey } = ctx
  const results = createEmptyHttpSeedResults()

  if (options.repair) {
    results.doctorRepair = await runHttpSeedDoctorWithRepair(options)
    results.doctor = results.doctorRepair.after
  }
  else {
    results.doctor = await runHttpSeedDoctor(client, serviceAccountApiKey)
  }

  if (options.log) {
    logHttpDevSeedResults(results, options.log)
  }

  return results
}

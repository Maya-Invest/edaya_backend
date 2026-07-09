import type { LogDevSeedResultsOptions } from '../orchestration/run-dev-seeds'
import type { RunHttpDevSeedsResults } from './types'
import { logSeedDoctorRepairResult, logSeedDoctorResult } from '../diagnostics'
import { logDevSeedResults } from '../orchestration/run-dev-seeds'

export function logHttpDevSeedResults(results: RunHttpDevSeedsResults, log: LogDevSeedResultsOptions = {}): void {
  logDevSeedResults(results, log)

  if (results.smoke) {
    if (results.smoke.status === 'passed') {
      // eslint-disable-next-line no-console
      console.log('HTTP smoke seed passed (sign-in + effective-grants).')
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`HTTP smoke seed failed: ${results.smoke.reason ?? 'unknown reason'}`)
    }
  }

  if (results.validation) {
    const passedEntities = results.validation.entities.filter(entry => entry.status === 'passed').length
    const skippedEntities = results.validation.entities.filter(entry => entry.status === 'skipped').length
    const passedQueries = results.validation.queries.filter(entry => entry.status === 'passed').length
    if (results.validation.status === 'passed') {
      // eslint-disable-next-line no-console
      console.log(`HTTP seed validation passed (${passedEntities} entities, ${passedQueries} queries).`)
      for (const warning of results.validation.warnings) {
        // eslint-disable-next-line no-console
        console.log(`  ! ${warning}`)
      }
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`HTTP seed validation failed (${results.validation.failures.length} issues).`)
      for (const failure of results.validation.failures) {
        // eslint-disable-next-line no-console
        console.log(`  - ${failure}`)
      }
      if (skippedEntities > 0) {
        for (const warning of results.validation.warnings) {
          // eslint-disable-next-line no-console
          console.log(`  ! ${warning}`)
        }
      }
    }
  }

  if (results.doctorRepair) {
    if (results.doctorRepair.repairs.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Seed doctor (before repair):')
      logSeedDoctorResult(results.doctorRepair.before)
      // eslint-disable-next-line no-console
      console.log('Seed doctor (after repair):')
      logSeedDoctorResult(results.doctorRepair.after)
      logSeedDoctorRepairResult(results.doctorRepair)
    }
    else if (results.doctor) {
      logSeedDoctorResult(results.doctor)
    }
  }
  else if (results.doctor) {
    logSeedDoctorResult(results.doctor)
  }
}

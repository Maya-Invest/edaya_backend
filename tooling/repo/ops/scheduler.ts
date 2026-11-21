import type { SchedulerAdminPort } from '../../../package/domain-service/src/ports/platform/job-scheduler'
import { resolve } from 'node:path'
import { sqliteSchedulerAdmin } from '../../../apps/api/src/runtime/shared/adapters/sqlite-scheduler-admin'
import { validateJobCron } from '../../../package/domain-service/src/capabilities/scheduling-jobs/compute-next-run-at'
import { maintenanceJobKeys } from '../../../package/domain-service/src/ports/platform/job-scheduler'
import { root, run } from './runtime'

export async function runSchedulerOperation(port: SchedulerAdminPort, operation: string, ref?: string, value?: string) {
  switch (operation) {
    case 'schedules':
      return port.settings()
    case 'configure': {
      const maintenance = maintenanceJobKeys.find(key => key === ref)
      if (!maintenance || !value)
        throw new Error('Expected school-recovery or identity-cleanup and a five-field UTC cron expression')
      const schedule = validateJobCron(value)
      await port.configureMaintenance(maintenance, schedule, Date.now())
      return { kind: maintenance, schedule }
    }
    case 'inspect':
      return port.inspect(ref)
    case 'replay':
      if (ref)
        return port.replay(ref)
      break
    case 'reconcile':
      if (!ref)
        return port.reconcile()
      break
  }
  throw new Error('Invalid scheduler operation or arguments')
}

export async function schedulerOperation([operation, target, ref, value]: string[]) {
  if ((target !== 'local' && target !== 'staging' && target !== 'production') || !operation)
    throw new Error('Select a scheduler environment')
  if (target === 'local') {
    const { openLocalScheduler, localSchedulerPath }
      = await import('../../../apps/api/src/runtime/local/scheduler-database')
    const { loadLocalConfiguration } = await import('../../../apps/api/configuration')
    const local = openLocalScheduler(localSchedulerPath(loadLocalConfiguration()))
    try {
      const admin = sqliteSchedulerAdmin(
        async <T>(sql: string) => (await local.binding.prepare(sql).bind().all<T>()).results,
      )
      console.log(JSON.stringify(await runSchedulerOperation(admin, operation, ref, value), null, 2))
    }
    finally {
      local.close()
    }
  }
  else {
    const admin = sqliteSchedulerAdmin(async (sql) => {
      const output = await run(
        [
          'bun',
          'x',
          'wrangler',
          'd1',
          'execute',
          'SCHEDULER_DB',
          '--remote',
          '--env',
          target === 'production' ? 'prod' : 'staging',
          '--json',
          '--command',
          sql,
        ],
        { cwd: resolve(root, 'apps/api'), quiet: true },
      )
      return JSON.parse(output)[0].results
    })
    console.log(JSON.stringify(await runSchedulerOperation(admin, operation, ref, value), null, 2))
  }
}

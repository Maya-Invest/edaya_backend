import type { SchoolApplication } from '../../services/school-application'
import type { SchoolCronJobContext } from '../scheduling-jobs/cron-job-context'
import { createSystemActorMetadata } from '@edaya/authorization'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { sweepExpiredStudentPortraitAttachments } from './student-photo-lifecycle'

export const PRIVATE_FILE_CLEANUP_KIND = 'private-file.cleanup'

/** Persist tombstones and reference-only outbox work together; never delete storage in a cron transaction. */
export async function preparePrivateFileCleanup(context: SchoolCronJobContext) {
  const base = context.service.baseService
  await base.access.attachments.assertCleanup()
  const portraits = await sweepExpiredStudentPortraitAttachments(base, context.asOf)
  const candidates = await base.repositories.privateFiles.listDue(base.actor.schoolId, 50)
  let processed = 0
  for (const object of candidates) {
    const jobId = crypto.randomUUID()
    const prepared = await base.atomicExecution.execute(async () => {
      await base.access.attachments.assertCleanup()
      if (!await base.repositories.privateFiles.prepareDeletion(base.actor.schoolId, object.id, jobId))
        return false
      await base.commandExecution.execute({
        scope: { schoolId: base.actor.schoolId, command: 'preparePrivateFileCleanup', callerId: 'preparePrivateFileCleanup', requestId: jobId },
        input: { objectId: object.id },
        resultMode: 'ordinary',
        authorize: () => base.access.attachments.assertCleanup(),
        replay: async () => undefined,
        execute: async () => undefined,
        persistResult: () => ({ objectId: object.id }),
        audit: () => [{ event: 'private_file.cleanup_requested', resourceType: 'private-file-object', resourceId: object.id }],
        outbox: () => [{ id: jobId, kind: PRIVATE_FILE_CLEANUP_KIND, version: 1, resourceType: 'private-file-object', resourceId: object.id }],
      })
      return true
    })
    if (prepared)
      processed++
  }
  return { processed: portraits.processed + processed, skipped: portraits.skipped + candidates.length - processed }
}

/** Shared work leases/retries; tombstones prevent both new references and stale upload completion. */
export async function dispatchPrivateFileCleanup(application: Pick<SchoolApplication, 'forActor' | 'durableWork'>) {
  return runDurableWorkBatch(application.durableWork, {
    [PRIVATE_FILE_CLEANUP_KIND]: {
      version: 1,
      run: async (work) => {
        if (work.resourceType !== 'private-file-object')
          throw new DurableWorkFailure('PRIVATE_FILE_WORK_INVALID', true)
        const base = application.forActor(createSystemActorMetadata({ systemId: 'private-file-cleanup', schoolId: work.schoolId, requestId: work.id, reason: 'durable private object cleanup' })).baseService
        await base.access.attachments.assertCleanup()
        const object = await base.repositories.privateFiles.findDeletion(work.schoolId, work.resourceId, work.id)
        if (!object)
          throw new DurableWorkFailure('PRIVATE_FILE_WORK_INVALID', true)
        if (object.status === 'deleted')
          return
        try {
          await base.fileStorage.deleteObject(object.storageKey)
        }
        catch {
          throw new DurableWorkFailure('PRIVATE_FILE_STORAGE_UNAVAILABLE')
        }
        await base.atomicExecution.execute(async () => {
          await base.access.attachments.assertCleanup()
          await base.repositories.privateFiles.completeDeletion(work.schoolId, work.resourceId, work.id)
        })
      },
    },
  })
}

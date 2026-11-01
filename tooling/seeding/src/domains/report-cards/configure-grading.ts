import type { GradingPolicy } from '@edaya/core'
import type { GradingPolicySeedRecord } from './port'

/** Both seed transports wait for the authoritative policy before creating marks. */
export async function configureSeedGrading(
  record: GradingPolicySeedRecord,
  operations: {
    read: () => Promise<GradingPolicy | undefined>
    configure: () => Promise<void>
    advance: () => Promise<unknown>
  },
): Promise<void> {
  if (!await operations.read())
    await operations.configure()
  for (let attempt = 0; attempt < 240; attempt++) {
    const policy = await operations.read()
    if (policy) {
      if (policy.scale.id !== record.scaleId || policy.mode !== record.mode || policy.aggregateLabel !== record.aggregateLabel)
        throw new Error(`Seed grading differs from the existing policy for ${record.gradeLevelId}/${record.academicYearId}`)
      if (policy.status === 'completed')
        return
      if (policy.status === 'failed')
        throw new Error(`Seed grading recalculation failed for ${record.gradeLevelId}/${record.academicYearId}`)
    }
    await operations.advance()
  }
  throw new Error(`Timed out waiting for seed grading for ${record.gradeLevelId}/${record.academicYearId}`)
}

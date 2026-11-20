export type { AppShellCounts } from '@edaya/core'

export interface GetAppShellCountsInput {
  schoolId: string
  classGroupIds?: readonly string[]
}

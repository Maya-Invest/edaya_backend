import type { SystemActorMetadata } from '../authorization'
import type { SchoolService } from '../services/school-service'

export interface SchoolCronJobContext {
  readonly asOf: Date
  readonly actor: SystemActorMetadata
  readonly service: SchoolService
}

export interface CronJobResult {
  readonly processed: number
  readonly skipped: number
}

export type SchoolCronJobHandler = (context: SchoolCronJobContext) => Promise<CronJobResult>

import type { MessageDeliveryStatus } from '@edaya/core'
import type { CronJobSchedule } from './cron-job-schedule'

export const schedulerLeaseMs = 5 * 60_000
export const schedulerMaxAttempts = 8

export type ScheduleDefinition = CronJobSchedule & { revision: number }

export const maintenanceJobKeys = ['school-recovery', 'identity-cleanup'] as const
export type MaintenanceJobKey = typeof maintenanceJobKeys[number]

export interface SchedulerWork {
  cronExpression: string | null
  ref: string
  kind: string
  revision: number
  dueAt: number | null
  availableAt: number | null
  lease: string | null
  attempts: number
  projectionPending: boolean
  replayRequested: boolean
  exhausted: boolean
  failure: string | null
}
export interface SchedulerMessage {
  version: 1
  ref: string
  lease: string
}

/** The scheduler owns deadlines. Each mutation must be conditional in the backing store. */
export interface SchedulerPort {
  schedules: () => Promise<CronJobSchedule[]>
  importDefinitions: (definitions: ScheduleDefinition[]) => Promise<void>
  get: (ref: string) => Promise<SchedulerWork | undefined>
  project: (ref: string, kind: string, revision: number, due: number | null) => Promise<void>
  deferProjection: (ref: string, kind: string, revision: number, now: number) => Promise<void>
  exhausted: (ref: string, kind: string, revision: number, attempts: number, code: string) => Promise<boolean>
  wakePublisher: () => Promise<void>
  /** Atomically lease due work. A crash makes the same logical work available after lease expiry. */
  claim: (now: number) => Promise<SchedulerWork[]>
  begin: (message: SchedulerMessage, now: number) => Promise<SchedulerWork | undefined>
  finish: (work: SchedulerWork, next: number | null) => Promise<boolean>
  fail: (work: SchedulerWork, now: number, code: string) => Promise<void>
  dueBusiness: (now: number) => Promise<{ ref: string, kind: string }[]>
  advanceShadowRecovery: (expected: SchedulerWork, next: number | null) => Promise<void>
}

export interface SchoolSignal {
  ref: string
  kind: string
  sourceId: string
  revision: number
  lastSlot: number | null
  changedAt: number
}

/** Transactional business facts needed to project deadlines and recheck delivery. */
export interface SchoolSchedulingPort {
  definitions: () => Promise<ScheduleDefinition[]>
  readySources: (at: Date) => Promise<{ kind: string, sourceId: string }[]>
  pending: () => Promise<{ ref: string }[]>
  read: (ref: string, lock?: boolean) => Promise<SchoolSignal | undefined>
  published: (signal: SchoolSignal) => Promise<void>
  rebuild: () => Promise<void>
  advance: (signal: SchoolSignal, at: number, ifUnchanged?: boolean) => Promise<void>
  source: (
    signal: SchoolSignal,
  ) => Promise<{ kind: string, status: string, attempts: number, failureCode: string | null, due: number } | undefined>
  replayDead: (signal: SchoolSignal) => Promise<void>
  eligible: (signal: SchoolSignal, at: number) => Promise<boolean>
  deadline: (
    signal: SchoolSignal,
    schedule: CronJobSchedule | undefined,
    now: number,
    previousDue?: number | null,
  ) => Promise<number | null>
  mismatches: (school: string) => Promise<{ id: string, subjectId: string, status: MessageDeliveryStatus }[]>
}

export interface SchedulerInspection {
  ref: string
  kind: string
  revision: number
  dueAt: number | null
  availableAt: number | null
  attempts: number
  state: 'exhausted' | 'executing' | 'leased' | 'waiting' | 'idle'
  failure: string | null
}

export interface MaintenanceSchedule {
  kind: MaintenanceJobKey
  schedule: string
}

export interface SchedulerAdminPort {
  settings: () => Promise<MaintenanceSchedule[]>
  configureMaintenance: (kind: MaintenanceJobKey, expression: string, now: number) => Promise<void>
  inspect: (ref?: string) => Promise<SchedulerInspection[]>
  replay: (ref: string) => Promise<{ ref: string }[]>
  reconcile: () => Promise<{ ref: string }[]>
}

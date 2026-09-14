/** Delivery transports carry only an opaque persisted work reference. */
export interface CronJobDispatchMessage {
  readonly jobId: string
}

export interface CronJobDispatcherPort {
  dispatch: (message: CronJobDispatchMessage) => Promise<void>
}

export type LoggerWriteFn = (obj: object | string, msg?: string, ...args: unknown[]) => void

/** Structured application logging — implementations live in app adapters (e.g. Pino). */
export interface LoggerPort {
  child: (bindings: Record<string, unknown>) => LoggerPort
  trace: LoggerWriteFn
  debug: LoggerWriteFn
  info: LoggerWriteFn
  warn: LoggerWriteFn
  error: LoggerWriteFn
  fatal: LoggerWriteFn
}

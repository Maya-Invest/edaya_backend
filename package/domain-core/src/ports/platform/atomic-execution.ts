/**
 * Executes one application operation atomically across participating repository
 * adapters. Persistence implementations must bind repository calls made within
 * `execute` to the same transaction context.
 */
export interface AtomicExecutionPort {
  execute: <T>(operation: () => Promise<T>, options?: { lockKeys?: readonly string[], readSnapshot?: boolean }) => Promise<T>
}

export type LocalControl = 'PAUSE_API' | 'PAUSE_SCHEDULER' | 'PAUSE_JOBS';
export interface LocalState { revision: number; controls: Record<LocalControl, boolean>; seed: { owner: string; pid: number } | null }
export function localOperations(env: Record<string, unknown>, base?: string, scopeOverride?: string): {
  scope: string; rootId: string; directory: string; read(): LocalState;
  set(values: Record<string, string | boolean>, expectedRevision?: number): Promise<LocalState>;
  background<T>(keys: LocalControl[], work: () => Promise<T>): Promise<T | undefined>;
  beginSeed(): Promise<{ drain(timeout?: number): Promise<void>; finish(success: boolean): Promise<void> }>;
};

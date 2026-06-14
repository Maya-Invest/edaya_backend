export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

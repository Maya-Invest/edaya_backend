import type { ResolvedActorScope } from "@edaya/core";

export interface ActorScopeCacheEntry {
  scope: ResolvedActorScope;
  expiresAt: number;
  actorScope: string;
  generation: number;
}

export interface ActorScopeCacheStore {
  get: (key: string) => ActorScopeCacheEntry | undefined;
  set: (key: string, entry: ActorScopeCacheEntry) => void;
  delete: (key: string) => void;
  deleteForActor: (actorId: string, actorType: string, schoolId?: string) => void;
  clear: () => void;
  getGeneration: () => number;
  bumpGeneration: () => number;
}

export class InMemoryActorScopeCacheStore implements ActorScopeCacheStore {
  private generation = 0;
  private readonly entries = new Map<string, ActorScopeCacheEntry>();
  private readonly actorIndex = new Map<string, Set<string>>();

  get(key: string): ActorScopeCacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.generation < this.generation) {
      if (entry) {
        this.delete(key);
      }
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: ActorScopeCacheEntry): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.removeIndexEntry(key, existing.actorScope);
    }
    this.entries.set(key, entry);
    this.indexEntry(entry.actorScope, key);
  }

  delete(key: string): void {
    const existing = this.entries.get(key);
    if (!existing) {
      return;
    }
    this.entries.delete(key);
    this.removeIndexEntry(key, existing.actorScope);
  }

  deleteForActor(actorId: string, actorType: string, schoolId?: string): void {
    const scopeSuffix = `:${actorType}:${actorId}`;
    for (const actorScope of [...this.actorIndex.keys()]) {
      if (schoolId && actorScope !== `${schoolId}:${actorType}:${actorId}`) {
        continue;
      }
      if (!schoolId && !actorScope.endsWith(scopeSuffix)) {
        continue;
      }

      for (const key of this.actorIndex.get(actorScope) ?? []) {
        this.entries.delete(key);
      }
      this.actorIndex.delete(actorScope);
    }
  }

  clear(): void {
    this.entries.clear();
    this.actorIndex.clear();
    this.bumpGeneration();
  }

  getGeneration(): number {
    return this.generation;
  }

  bumpGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  private indexEntry(actorScope: string, key: string): void {
    const keys = this.actorIndex.get(actorScope) ?? new Set<string>();
    keys.add(key);
    this.actorIndex.set(actorScope, keys);
  }

  private removeIndexEntry(key: string, actorScope: string): void {
    const keys = this.actorIndex.get(actorScope);
    if (!keys) {
      return;
    }
    keys.delete(key);
    if (keys.size === 0) {
      this.actorIndex.delete(actorScope);
    }
  }
}

let activeStore: ActorScopeCacheStore = new InMemoryActorScopeCacheStore();

export function getActorScopeCacheStore(): ActorScopeCacheStore {
  return activeStore;
}

export function setActorScopeCacheStore(store: ActorScopeCacheStore): void {
  activeStore = store;
}

export function resetActorScopeCacheStore(): void {
  activeStore = new InMemoryActorScopeCacheStore();
}

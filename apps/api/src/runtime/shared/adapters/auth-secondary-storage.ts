import {
  createKvAuthSecondaryStorage,
  isAuthKeyValueStore,
  type AuthSecondaryStoragePort,
} from "@edaya/adaptor-auth";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

export function readAuthKvBinding(source: RuntimeBindings): unknown {
  return source.AUTH_KV;
}

export function resolveAuthSecondaryStorage(
  runtime: RuntimeKind,
  bindings: RuntimeBindings,
): AuthSecondaryStoragePort | undefined {
  if (runtime !== "worker") {
    return undefined;
  }

  const kv = readAuthKvBinding(bindings);
  if (!isAuthKeyValueStore(kv)) {
    return undefined;
  }

  return createKvAuthSecondaryStorage(kv);
}

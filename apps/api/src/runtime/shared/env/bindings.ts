import { resolveDatabaseUrl } from "@/runtime/shared/env/hyperdrive";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

export function inferRuntimeKind(source: RuntimeBindings): RuntimeKind {
  const value = source.RUNTIME;
  if (value === "worker" || value === "local" || value === "in-memory") {
    return value;
  }
  return "local";
}

export function prepareRuntimeBindings(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): RuntimeBindings & { RUNTIME: RuntimeKind; DATABASE_URL: string } {
  return {
    ...source,
    RUNTIME: runtime,
    DATABASE_URL: resolveDatabaseUrl(source, runtime),
  };
}

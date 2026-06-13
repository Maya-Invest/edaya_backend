import { resolveDatabaseUrl } from "./hyperdrive";
import type { RuntimeBindings, RuntimeKind } from "./types";

export function inferRuntimeKind(source: RuntimeBindings): RuntimeKind {
  const value = source["RUNTIME"];
  if (value === "node" || value === "worker") {
    return value;
  }
  return "node";
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

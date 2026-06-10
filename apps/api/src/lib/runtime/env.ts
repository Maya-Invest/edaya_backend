import { parseEnv, type Environment } from "@/lib/bootstrap/env";
import type { RuntimeBindings, RuntimeKind } from "@/lib/runtime/types";

export function parseRuntimeEnv(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): Environment {
  return parseEnv({
    ...source,
    RUNTIME: runtime,
  });
}

function inferRuntimeKind(source: RuntimeBindings): RuntimeKind {
  const value = source.RUNTIME;
  if (value === "node" || value === "worker") {
    return value;
  }
  return "node";
}

import type { Environment } from "@/lib/runtime/env";

export function resolveSystemActorSecret(env: Environment): string | undefined {
  return env.SYSTEM_ACTOR_SECRET?.trim() || undefined;
}

export function isValidSystemActorSecret(env: Environment, provided: string | undefined): boolean {
  const configured = resolveSystemActorSecret(env);
  return Boolean(configured && provided && configured === provided);
}

export interface SystemActorRequestBody {
  schoolId: string;
  systemId: string;
  reason: string;
}

export function readSystemActorRequestBody(body: SystemActorRequestBody) {
  return {
    schoolId: body.schoolId,
    systemId: body.systemId,
    reason: body.reason,
  };
}

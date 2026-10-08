import { envBooleanSchema } from "@/runtime/shared/env/boolean";

export type PauseControl = "PAUSE_API" | "PAUSE_SCHEDULER" | "PAUSE_JOBS";

/** Read before runtime construction so paused handlers never open a database. */
export function isPaused(bindings: Record<string, unknown>, key: PauseControl): boolean {
  const result = envBooleanSchema.default(false).safeParse(bindings[key]);
  if (!result.success)
    throw new Error(`${key}: expected a boolean`);
  return result.data;
}

export function maintenanceResponse(): Response {
  return Response.json({ message: "Maintenance in progress" }, {
    status: 503,
    headers: { "retry-after": "60", "cache-control": "no-store" },
  });
}

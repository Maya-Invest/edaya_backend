import type { SchoolSignal } from "@edaya/service";
import { computeNextRunAt } from "@edaya/service";
import type { LoggerPort } from "@edaya/core";
import type { ApiRuntime } from "@/runtime/types";
import { publishSchoolChanges, schedulerStore } from "./runtime";

/** Compare school/slot pairs while the legacy path remains the only producer. */
export async function compareShadow(runtime: ApiRuntime, asOf: Date, logger: LoggerPort) {
  const application = await runtime.getSchoolApplication();
  const school = await runtime.schedulerSignals!();
  const store = schedulerStore(runtime);
  const recovery = await store.get("school-recovery");
  if (recovery?.availableAt != null && recovery.availableAt <= asOf.getTime()) {
    await school.rebuild();
    const next = recovery.cronExpression ? computeNextRunAt(recovery.cronExpression, asOf).getTime() : null;
    await store.advanceShadowRecovery(recovery, next);
  }
  await publishSchoolChanges(runtime);
  const candidates = await application.repositories.cronJobSchedules.listDue(asOf);
  const expected = new Set<string>();
  for (const row of candidates) {
    for (const id of await application.repositories.cronJobSchedules.listDueSchoolIds(row.jobKey, asOf))
      expected.add(JSON.stringify([row.jobKey, id]));
  }
  for (const source of await school.readySources(asOf)) expected.add(JSON.stringify([source.kind, source.sourceId]));
  const seen = new Set<string>();
  const entries = await store.dueBusiness(asOf.getTime());
  const observed: SchoolSignal[] = [];
  for (const entry of entries) {
    const signal = await school.read(entry.ref);
    if (signal) {
      seen.add(JSON.stringify([signal.kind, signal.sourceId]));
      if (signal.kind !== "outbox" && signal.kind !== "notification")
        observed.push(signal);
    }
  }
  logger.info(
    {
      event: "scheduler.shadow",
      scheduledAt: asOf.toISOString(),
      legacy: expected.size,
      d1: seen.size,
      legacyOnly: [...expected].filter(k => !seen.has(k)).length,
      d1Only: [...seen].filter(k => !expected.has(k)).length,
      pendingPublication: (await school.pending()).length,
    },
    "compared scheduler decisions",
  );
  return async () => {
    for (const signal of observed) await school.advance(signal, asOf.getTime(), true);
    await publishSchoolChanges(runtime);
  };
}

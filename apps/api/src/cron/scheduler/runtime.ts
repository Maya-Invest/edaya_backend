import type {
  CronJobKey,
  CronJobSchedule,
  SchedulerMessage,
  SchedulerPort,
  SchedulerWork,
  SchoolSchedulingPort,
  SchoolSignal,
} from "@edaya/service";
import type { ApiRuntime } from "@/runtime/types";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import {
  computeNextRunAt,
  dispatchAutoBilling,
  dispatchConversationNotifications,
  dispatchCronOccurrences,
  dispatchDocumentRender,
  dispatchGradingRecalculation,
  dispatchPrivateFileCleanup,
  dispatchSchoolImports,
  executeCronOccurrence,
  reconcileExhaustedImports,
  runCronJobForSchool,
} from "@edaya/service";

import { dispatchScheduler, reportFailure } from "./dispatch";

export function schedulerStore(runtime: ApiRuntime) {
  if (!runtime.scheduler)
    throw new Error("Missing scheduler adapter");
  return runtime.scheduler;
}

async function signals(runtime: ApiRuntime) {
  if (!runtime.schedulerSignals)
    throw new Error("Missing school scheduling repository");
  return runtime.schedulerSignals();
}

async function project(
  store: SchedulerPort,
  school: SchoolSchedulingPort,
  signal: SchoolSignal,
  definitions: CronJobSchedule[],
  now: number,
  environment: string,
) {
  let due: number | null;
  let kind = signal.kind;
  if (signal.kind === "notification" || signal.kind === "outbox") {
    const source = await school.source(signal);
    kind = source?.kind ?? kind;
    if (source?.status === "dead") {
      const code = source.failureCode ?? "SOURCE_ATTEMPTS_EXHAUSTED";
      const recorded = await store.exhausted(signal.ref, kind, signal.revision, source.attempts, code);
      if (recorded)
        reportFailure({ ref: signal.ref, kind, attempts: source.attempts }, environment, code);
      await school.published(signal);
      return null;
    }
    due = source && ["pending", "failed", "running", "sending"].includes(source.status) ? Math.ceil(source.due) : null;
  }
  else {
    const previous = await store.get(signal.ref);
    due = await school.deadline(
      signal,
      definitions.find(s => s.jobKey === signal.kind),
      now,
      previous?.dueAt,
    );
  }
  await store.project(signal.ref, kind, signal.revision, due);
  await school.published(signal);
  return due;
}

async function definitions(store: SchedulerPort, school: SchoolSchedulingPort) {
  await store.importDefinitions(await school.definitions());
  return store.schedules();
}

async function publishPage(runtime: ApiRuntime, store: SchedulerPort, school: SchoolSchedulingPort) {
  const pending = await school.pending();
  if (!pending.length)
    return;
  // Read revisions before the definitions that will be used to publish them.
  // A concurrent edit after this point creates a newer, still-unpublished revision.
  const page: SchoolSignal[] = [];
  for (const { ref } of pending.slice(0, 40)) {
    const item = await school.read(ref);
    if (item)
      page.push(item);
  }
  const schedules = await definitions(store, school);
  for (const signal of page) {
    try {
      await project(store, school, signal, schedules, Date.now(), runtime.env.API_ORIGIN);
    }
    catch {
      reportFailure({ ...signal, attempts: 1 }, runtime.env.API_ORIGIN, "SCHEDULER_PUBLICATION_FAILED");
      await store.deferProjection(signal.ref, signal.kind, signal.revision, Date.now());
      await school.published(signal);
    }
  }
  if (pending.length > 40)
    await store.wakePublisher();
}

export async function publishSchoolChanges(runtime: ApiRuntime) {
  if (!runtime.env.SCHEDULER_MODE || runtime.env.SCHEDULER_MODE === "legacy" || !runtime.schoolOpened?.())
    return;
  const store = schedulerStore(runtime);
  try {
    await publishPage(runtime, store, await signals(runtime));
    if (runtime.env.SCHEDULER_MODE === "active")
      await tickScheduler(runtime, Date.now());
  }
  catch (error) {
    reportFailure(
      { ref: "school-publish", kind: "school-publish", attempts: 1 },
      runtime.env.API_ORIGIN,
      "POST_COMMIT_HANDOFF_FAILED",
    );
    await store.wakePublisher();
    throw error;
  }
}

export async function tickScheduler(runtime: ApiRuntime, at: number) {
  if (runtime.env.SCHEDULER_MODE !== "active")
    return 0;
  if (runtime.runSchedulerTick)
    return (await runtime.runSchedulerTick(() => dispatchReady(runtime, at))) ?? 0;
  if (runtime.env.PAUSE_JOBS || runtime.env.PAUSE_SCHEDULER)
    return 0;
  return dispatchReady(runtime, at);
}

async function dispatchReady(runtime: ApiRuntime, at: number) {
  const store = schedulerStore(runtime);
  if (!runtime.sendSchedulerMessage)
    throw new Error("Missing scheduler queue");
  let count = await dispatchScheduler(store, runtime.sendSchedulerMessage, at, runtime.env.API_ORIGIN);
  let total = count;
  // Worker consumers wake their own continuations. Bun delivers inline within one bounded turn.
  const stopAt = Date.now() + 20_000;
  while (runtime.inlineScheduler && count > 0 && Date.now() < stopAt) {
    count = await dispatchScheduler(store, runtime.sendSchedulerMessage, Date.now(), runtime.env.API_ORIGIN);
    total += count;
  }
  return total;
}

async function runOutbox(runtime: ApiRuntime, application: ApiSchoolApplication, id: string, kind: string) {
  const durable = application.durableWork;
  const scoped = {
    get importPersistence() {
      return application.importPersistence;
    },
    repositories: application.repositories,
    commandExecution: application.commandExecution,
    atomicExecution: application.atomicExecution,
    forActor: application.forActor.bind(application),
    durableWork: {
      claim: (options: Parameters<typeof durable.claim>[0]) => durable.claim({ ...options, jobId: id }),
      complete: durable.complete.bind(durable),
      fail: durable.fail.bind(durable),
      renew: durable.renew.bind(durable),
      getState: durable.getState.bind(durable),
    },
  };
  switch (kind) {
    case "grading.recalculate":
      return dispatchGradingRecalculation(scoped);
    case "finance.auto-billing":
      return dispatchAutoBilling(scoped, { maxPages: 1 });
    case "school-import.execute":
      return dispatchSchoolImports(scoped, { maxPages: 1 });
    case "private-file.cleanup":
      return dispatchPrivateFileCleanup(scoped);
    case "document.preview":
    case "document.render":
      return dispatchDocumentRender(scoped);
    case "conversation.message":
      return dispatchConversationNotifications(scoped);
    case "cron.execute":
      return executeCronOccurrence(application, id);
    case "cron.dispatch": {
      if (!runtime.legacyCronDispatcher)
        throw new Error("Missing legacy cron dispatcher");
      return dispatchCronOccurrences(scoped, runtime.legacyCronDispatcher(application));
    }
    default:
      throw new Error("SCHEDULER_UNKNOWN_WORK_KIND");
  }
}

async function executeSchool(runtime: ApiRuntime, store: SchedulerPort, work: SchedulerWork) {
  const school = await signals(runtime);
  const signal = await school.read(work.ref);
  if (!signal) {
    await store.finish(work, null);
    return;
  }
  if (work.projectionPending) {
    // Restore the deadline so the scheduler can claim the business work when it becomes due.
    const schedules = signal.kind === "outbox" || signal.kind === "notification" ? [] : await definitions(store, school);
    await project(store, school, signal, schedules, Date.now(), runtime.env.API_ORIGIN);
    return;
  }
  const application = await runtime.getSchoolApplication();
  if (signal.kind === "notification" || signal.kind === "outbox") {
    if (work.replayRequested && signal.revision === work.revision)
      await school.replayDead(signal);
    const source = await school.source(signal);
    if (source && ["pending", "failed", "running", "sending"].includes(source.status) && source.due <= Date.now()) {
      if (signal.kind === "notification") {
        if (!runtime.sendNotificationJob)
          throw new Error("Notification runtime unavailable");
        await runtime.sendNotificationJob(signal.sourceId);
      }
      else {
        await runOutbox(runtime, application, signal.sourceId, source.kind);
      }
    }
  }
  else {
    const schedules = await store.schedules();
    await application.atomicExecution.execute(async () => {
      const current = await school.read(work.ref, true);
      const schedule = schedules.find(s => s.jobKey === current?.kind);
      if (!current || current.revision !== work.revision || !schedule?.enabled || work.dueAt === null)
        return;
      const now = Date.now();
      const slot = work.dueAt;
      if (
        (!current.lastSlot || current.lastSlot < slot)
        && (await school.eligible(current, now))
        && !(await application.repositories.cronJobSchedules.hasOccurrence(current.sourceId, schedule.id, new Date(slot)))
      ) {
        const requestId = `${schedule.id}:${new Date(slot).toISOString()}`;
        const occurrence = {
          id: crypto.randomUUID(),
          schoolId: current.sourceId,
          scheduleId: schedule.id,
          jobKey: current.kind as CronJobKey,
          version: 1,
          scheduledFor: new Date(slot),
          asOf: new Date(now),
          requestId,
        };
        await application.commandExecution.execute({
          scope: { schoolId: current.sourceId, command: "cron.occurrence", callerId: "system:cron", requestId },
          input: {
            scheduleId: schedule.id,
            jobKey: current.kind,
            scheduledFor: occurrence.scheduledFor,
            asOf: occurrence.asOf,
          },
          resultMode: "ordinary",
          authorize: async () => {
            if (!(await application.repositories.schools.findById(current.sourceId)))
              throw new Error("Missing school");
          },
          execute: async () => {
            await application.repositories.cronJobSchedules.saveOccurrence(occurrence);
            const changedDeliveries
              = current.kind === "reconcilePendingDeliveries" ? await school.mismatches(current.sourceId) : undefined;
            await runCronJobForSchool(application, { ...occurrence, changedDeliveries });
            return { id: occurrence.id };
          },
          persistResult: r => r,
          replay: async r => r,
          audit: r => [{ event: "cron.occurrence", resourceType: "cron-occurrence", resourceId: r.id }],
        });
      }
      await school.advance(current, now);
    });
  }
  const current = await school.read(work.ref);
  if (current) {
    const schedules = current.kind === "outbox" || current.kind === "notification" ? [] : await definitions(store, school);
    const next = await project(store, school, current, schedules, Date.now(), runtime.env.API_ORIGIN);
    await store.finish({ ...work, revision: current.revision }, next);
  }
  await publishPage(runtime, store, school);
}

export async function consumeScheduler(runtime: ApiRuntime, message: SchedulerMessage, clock = Date.now) {
  const store = schedulerStore(runtime);
  const work = await store.begin(message, clock());
  if (!work)
    return;
  runtime.schedulerStarted?.(work, clock());
  try {
    if (work.ref === "school-recovery" || work.ref === "identity-cleanup") {
      if (work.ref === "identity-cleanup") {
        if (!runtime.getIdentityRuntime)
          throw new Error("Missing Identity runtime");
        await (await runtime.getIdentityRuntime()).auth.purgeExpiredCredentials();
      }
      else {
        const school = await signals(runtime);
        await school.rebuild();
        await reconcileExhaustedImports(await runtime.getSchoolApplication());
        await definitions(store, school);
        await publishPage(runtime, store, school);
      }
      // An operator can change the next slot while this maintenance run is in progress.
      let current: SchedulerWork | undefined = work;
      while (current && current.lease === work.lease) {
        const next = current.cronExpression ? computeNextRunAt(current.cronExpression, new Date(clock())).getTime() : null;
        if (await store.finish(current, next))
          break;
        current = await store.get(work.ref);
      }
    }
    else if (work.ref === "school-publish") {
      const school = await signals(runtime);
      await publishPage(runtime, store, school);
      await store.finish(work, (await school.pending()).length ? Date.now() : null);
    }
    else {
      await executeSchool(runtime, store, work);
    }
  }
  catch {
    reportFailure(work, runtime.env.API_ORIGIN, "SCHEDULER_EXECUTION_FAILED");
    await store.fail(work, clock(), "SCHEDULER_EXECUTION_FAILED");
    if (work.attempts >= 8)
      reportFailure(work, runtime.env.API_ORIGIN, "SCHEDULER_RETRIES_EXHAUSTED");
  }
}

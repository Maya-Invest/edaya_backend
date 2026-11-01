/// <reference types="@cloudflare/workers-types" />

import type { Context } from "hono";
import type { ActorMetadata } from "@edaya/authorization";
import type { SchoolService } from "@edaya/service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { AppBindings } from "@/http/bindings";
import { buildWorkerApiRuntime } from "@/runtime/worker/build-runtime";

type BackgroundTask = (service: SchoolService) => Promise<void>;

export function scheduleBackgroundTask(
  c: Context<AppBindings>,
  actor: ActorMetadata,
  task: BackgroundTask,
): void {
  scheduleBackgroundApplicationTask(c, application => task(application.forActor(actor)));
}

export function scheduleBackgroundApplicationTask(
  c: Context<AppBindings>,
  task: (application: ApiSchoolApplication) => Promise<unknown>,
): void {
  const logFailure = (error: unknown) => {
    c.var.logger.error({ err: error }, "background task failed");
  };

  const run = async () => {
    if (c.env.RUNTIME === "worker") {
      const runtime = await buildWorkerApiRuntime(c.env);
      try {
        const schoolApp = await runtime.getSchoolApplication();
        await task(schoolApp);
      }
      finally {
        await runtime.close();
      }
      return;
    }

    await task(c.get("schoolApp"));
  };

  if (c.env.RUNTIME === "worker") {
    c.executionCtx.waitUntil(run().catch(logFailure));
    return;
  }

  void run().catch(logFailure);
}

import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import type { IdentityClient } from "../identity/server/index";

export type RuntimeKind = "in-memory" | "local" | "worker";

export type RuntimeBindings = Record<string, unknown>;

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

export interface ApiRuntime {
  getIdentityRuntime?: () => Promise<import("@/identity/runtime").IdentityRuntime>;
  legacyCronDispatcher?: (app: ApiSchoolApplication) => import("@edaya/service").CronJobDispatcherPort;
  inlineScheduler?: boolean;
  runSchedulerTick?: (work: () => Promise<number>) => Promise<number | undefined>;
  schedulerStarted?: (work: import("@edaya/service").SchedulerWork, at: number) => void;
  schedulerUsage?: () => { rowsRead: number; rowsWritten: number };
  scheduler?: import("@edaya/service").SchedulerPort;
  sendSchedulerMessage?: (message: import("@edaya/service").SchedulerMessage) => Promise<void>;
  schedulerSignals?: () => Promise<import("@edaya/service").SchoolSchedulingPort>;
  schoolOpened?: () => boolean;
  sendNotificationJob?: (id: string) => Promise<void>;
  drainNotifications?: () => Promise<void>;
  readonly env: Environment;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getIdentityClient: () => IdentityClient;
  close: () => Promise<void>;
}

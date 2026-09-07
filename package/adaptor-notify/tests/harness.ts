import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { EmailTransportPort } from "../src/email/port";
import type { FcmTransport } from "../src/push/fcm";
import { createNotifyRuntimeFromDrizzle } from "../src/runtime";
import { applyNotifySchemaOnDrizzle } from "../src/store/sql";
import type { NotifyRuntime } from "../src/runtime";

export interface TestNotifyHarness {
  runtime: NotifyRuntime;
  sent: Array<{ to: string; subject: string }>;
  pushes: Array<{ token: string; title: string; data: Record<string, string> }>;
  close: () => Promise<void>;
}

export async function createTestNotifyRuntime(options: {
  email?: EmailTransportPort;
  fcm?: FcmTransport;
} = {}): Promise<TestNotifyHarness> {
  const pglite = new PGlite();
  const db = drizzle(pglite);
  await applyNotifySchemaOnDrizzle(db);
  const sent: Array<{ to: string; subject: string }> = [];
  const pushes: Array<{ token: string; title: string; data: Record<string, string> }> = [];
  const runtime = createNotifyRuntimeFromDrizzle({
    db,
    env: { EMAIL_TRANSPORT: "log" },
    log: () => {},
    email: options.email ?? {
      async send(input) {
        sent.push({ to: input.to, subject: input.subject });
        return { providerMessageId: "log-1" };
      },
    },
    fcm: options.fcm ?? {
      async send(input) {
        pushes.push({ token: input.token, title: input.title, data: input.data });
        return { providerMessageId: "fcm-1" };
      },
    },
  });
  return {
    runtime,
    sent,
    pushes,
    close: () => pglite.close(),
  };
}

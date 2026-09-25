import type { EmailTransportPort } from "../src/email/port";
import type { FcmTransport } from "../src/push/fcm";
import type { NotifyRuntime } from "../src/runtime";
import type { SmsTransportPort } from "@edaya/core";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createNotifyRuntimeFromDrizzle } from "../src/runtime";

export interface TestNotifyHarness {
  runtime: NotifyRuntime;
  sent: Array<{ to: string; subject: string }>;
  sentSms: Array<{ to: string; body: string }>;
  pushes: Array<{ token: string; title: string; data: Record<string, string> }>;
  close: () => Promise<void>;
}

export const unimplementedTestSms: SmsTransportPort = {
  implemented: false,
  async send() {
    throw new Error("SMS transport is not implemented");
  },
};

export async function createTestNotifyRuntime(options: {
  email?: EmailTransportPort;
  sms?: SmsTransportPort;
  fcm?: FcmTransport;
} = {}): Promise<TestNotifyHarness> {
  const pglite = new PGlite();
  const db = drizzle(pglite);
  await pglite.exec(readFileSync(new URL("../../adaptor-postgres/drizzle/0013_notification_schema.sql", import.meta.url), "utf8"));
  await pglite.exec(readFileSync(new URL("../../adaptor-postgres/drizzle/0016_notification_tenants.sql", import.meta.url), "utf8"));
  await pglite.exec(readFileSync(new URL("../../adaptor-postgres/drizzle/0020_notification_copy_types.sql", import.meta.url), "utf8"));
  await pglite.exec(readFileSync(new URL("../../adaptor-postgres/drizzle/0033_push_installations.sql", import.meta.url), "utf8"));
  const sent: Array<{ to: string; subject: string }> = [];
  const sentSms: Array<{ to: string; body: string }> = [];
  const pushes: Array<{ token: string; title: string; data: Record<string, string> }> = [];
  const runtime = createNotifyRuntimeFromDrizzle({
    db,
    env: {},
    log: () => {},
    email: options.email ?? {
      async send(input) {
        sent.push({ to: input.to, subject: input.subject });
        return { providerMessageId: "log-1" };
      },
    },
    sms: options.sms ?? {
      implemented: true,
      async send(input) {
        sentSms.push({ to: input.to, body: input.body });
        return { providerMessageId: "sms-1" };
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
    sentSms,
    pushes,
    close: () => pglite.close(),
  };
}

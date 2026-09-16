import { describe, expect, mock, test } from "bun:test";
import { closeRequestApiRuntime as closeLocalRequestApiRuntime } from "@/runtime/local/resolve-api-runtime";
import { closeRequestApiRuntime as closeWorkerRequestApiRuntime } from "@/runtime/worker/resolve-api-runtime";
import type { ApiRuntime } from "@/runtime/types";

function createRuntime(options: {
  drain?: () => Promise<void>;
  close?: () => Promise<void>;
}): ApiRuntime {
  return {
    env: {} as ApiRuntime["env"],
    drainNotifications: options.drain,
    getSchoolApplication: async () => {
      throw new Error("unused");
    },
    getIdentityClient: () => {
      throw new Error("unused");
    },
    close: options.close ?? (async () => undefined),
  };
}

function createContext(options: {
  runtime?: "local" | "worker";
  apiRuntime?: ApiRuntime;
  waitUntil?: (promise: Promise<unknown>) => void;
  loggerErrors?: unknown[];
}) {
  const values = new Map<string, unknown>([
    ["apiRuntime", options.apiRuntime],
  ]);
  const loggerErrors = options.loggerErrors ?? [];
  const context = {
    env: { RUNTIME: options.runtime ?? "local" },
    executionCtx: options.waitUntil
      ? { waitUntil: options.waitUntil }
      : undefined,
    set(key: string, value: unknown) {
      values.set(key, value);
    },
    get(key: string) {
      return values.get(key);
    },
    var: {
      get apiRuntime() {
        return values.get("apiRuntime");
      },
      logger: {
        error(payload: unknown) {
          loggerErrors.push(payload);
        },
      },
    },
  };
  return { context: context as never, values };
}

describe("closeRequestApiRuntime notification drain", () => {
  test("local runtime drains queued invitations after the request", async () => {
    const drain = mock(async () => undefined);
    const close = mock(async () => undefined);
    const { context } = createContext({
      apiRuntime: createRuntime({ drain, close }),
    });

    await closeLocalRequestApiRuntime(context);

    expect(drain).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  test("local runtime skips drain when the request never opened a runtime", async () => {
    await closeLocalRequestApiRuntime(createContext({}).context);
  });

  test("worker runtime drains then closes through waitUntil", async () => {
    const order: string[] = [];
    const drain = mock(async () => {
      order.push("drain");
    });
    const close = mock(async () => {
      order.push("close");
    });
    const waitUntilTasks: Array<Promise<unknown>> = [];
    const { context, values } = createContext({
      runtime: "worker",
      apiRuntime: createRuntime({ drain, close }),
      waitUntil: (promise) => {
        waitUntilTasks.push(promise);
      },
    });

    await closeWorkerRequestApiRuntime(context);

    expect(waitUntilTasks).toHaveLength(1);
    await waitUntilTasks[0];
    expect(order).toEqual(["drain", "close"]);
    expect(values.get("apiRuntime")).toBeUndefined();
  });

  test("worker runtime still closes when drain fails", async () => {
    const drain = mock(async () => {
      throw new Error("provider unavailable");
    });
    const close = mock(async () => undefined);
    const loggerErrors: unknown[] = [];
    const waitUntilTasks: Array<Promise<unknown>> = [];
    const { context } = createContext({
      runtime: "worker",
      apiRuntime: createRuntime({ drain, close }),
      waitUntil: (promise) => {
        waitUntilTasks.push(promise);
      },
      loggerErrors,
    });

    await closeWorkerRequestApiRuntime(context);
    await waitUntilTasks[0];

    expect(close).toHaveBeenCalledTimes(1);
    expect(loggerErrors).toHaveLength(1);
  });
});

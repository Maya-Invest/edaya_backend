import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { createDependenciesInjection } from "@/lib/http/dependency-injection";
import { prepareRuntimeBindings } from "@/lib/runtime/bindings";
import { resolveDatabaseUrl, usesHyperdriveBinding } from "@/lib/runtime/hyperdrive";
import { createRuntimeRegistry } from "@/lib/runtime/process-registry";
import { createWorkerRequestRuntimeResolver } from "@/lib/runtime/request-runtime";

describe("resolveDatabaseUrl", () => {
  it("prefers Hyperdrive on the worker runtime", () => {
    const url = resolveDatabaseUrl({
      DATABASE_URL: "postgres://fallback",
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "worker");

    expect(url).toBe("postgres://hyperdrive");
  });

  it("falls back to DATABASE_URL when Hyperdrive is absent", () => {
    const url = resolveDatabaseUrl({ DATABASE_URL: "postgres://direct" }, "worker");
    expect(url).toBe("postgres://direct");
  });

  it("uses DATABASE_URL on the node runtime even when Hyperdrive is present", () => {
    const url = resolveDatabaseUrl({
      DATABASE_URL: "postgres://node",
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "node");

    expect(url).toBe("postgres://node");
  });
});

describe("usesHyperdriveBinding", () => {
  it("returns true only for worker bindings with Hyperdrive", () => {
    expect(usesHyperdriveBinding({
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "worker")).toBe(true);
    expect(usesHyperdriveBinding({
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "node")).toBe(false);
    expect(usesHyperdriveBinding({}, "worker")).toBe(false);
  });
});

describe("prepareRuntimeBindings", () => {
  it("injects resolved DATABASE_URL and runtime kind", () => {
    const bindings = prepareRuntimeBindings({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://direct",
      LOG_LEVEL: "info",
    });

    expect(bindings.RUNTIME).toBe("worker");
    expect(bindings.DATABASE_URL).toBe("postgres://direct");
    expect(bindings.LOG_LEVEL).toBe("info");
  });
});

describe("createDependenciesInjection", () => {
  it("runs dependencies in order and teardown after the handler", async () => {
    const events: string[] = [];

    interface TestEnv { Variables: { value?: string } }

    const app = new Hono<TestEnv>();
    app.use(createDependenciesInjection<TestEnv>([
      {
        name: "first",
        resolve() {
          events.push("first");
        },
      },
      {
        name: "second",
        resolve(c) {
          events.push("second");
          c.set("value", "ok");
        },
      },
    ], {
      onRequestComplete() {
        events.push("teardown");
      },
    }));
    app.get("/", (c) => {
      events.push(`handler:${c.var.value}`);
      return c.text("ok");
    });

    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(events).toEqual(["first", "second", "handler:ok", "teardown"]);
  });
});

describe("createWorkerRequestRuntimeResolver", () => {
  it("creates and closes a per-request runtime on worker", async () => {
    const builds: string[] = [];
    const closes: string[] = [];

    interface WorkerEnv {
      Bindings: { RUNTIME: "worker"; DATABASE_URL: string };
      Variables: { apiRuntime?: { value: string; close: () => Promise<void> } };
    }

    const resolver = createWorkerRequestRuntimeResolver<
      { RUNTIME: "worker"; DATABASE_URL: string },
      { value: string; close: () => Promise<void> },
      WorkerEnv
    >({
          get(c) {
            return c.var.apiRuntime;
          },
          set(c, runtime) {
            c.set("apiRuntime", runtime);
          },
        }, async (env) => {
          builds.push(env.DATABASE_URL);
          return {
            value: env.DATABASE_URL,
            close: async () => {
              closes.push(env.DATABASE_URL);
            },
          };
        }, runtime => runtime.close());

    const app = new Hono<WorkerEnv>();
    app.use(async (c, next) => {
      await resolver.resolve(c);
      try {
        await next();
      }
      finally {
        await resolver.close(c);
      }
    });
    app.get("/", c => c.text(c.var.apiRuntime?.value ?? "missing"));

    const response = await app.request("/", {}, {
      RUNTIME: "worker",
      DATABASE_URL: "postgres://worker",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("postgres://worker");
    expect(builds).toEqual(["postgres://worker"]);
    expect(closes).toEqual(["postgres://worker"]);
  });
});

describe("createRuntimeRegistry", () => {
  it("reuses cached runtimes on node and rejects worker env", async () => {
    let buildCount = 0;
    const registry = createRuntimeRegistry<
      { RUNTIME: "node" | "worker"; DATABASE_URL: string },
      { close: () => Promise<void> }
    >({
          buildRuntime: async () => {
            buildCount += 1;
            return { close: async () => {} };
          },
          closeRuntime: async () => {},
        });

    const env = { RUNTIME: "node" as const, DATABASE_URL: "postgres://node" };
    await registry.get(env);
    await registry.get(env);
    expect(buildCount).toBe(1);

    await expect(registry.get({ RUNTIME: "worker", DATABASE_URL: "postgres://worker" }))
      .rejects
      .toThrow(/worker runtime/i);
  });
});

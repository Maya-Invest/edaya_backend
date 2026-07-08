import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { createDependenciesInjection } from "@/http/dependency-injection";
import {
  parseEnv,
  prepareRuntimeBindings,
  resolveDatabaseUrl,
  usesHyperdriveBinding,
} from "@/runtime";
import * as localProfile from "@/runtime/local/profile";
import { createRuntimeRegistry } from "@/runtime/shared/process-registry";

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

  it("uses DATABASE_URL on process runtimes even when Hyperdrive is present", () => {
    const url = resolveDatabaseUrl({
      DATABASE_URL: "postgres://local",
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "local");

    expect(url).toBe("postgres://local");
  });
});

describe("usesHyperdriveBinding", () => {
  it("returns true only for worker bindings with Hyperdrive", () => {
    expect(usesHyperdriveBinding({
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "worker")).toBe(true);
    expect(usesHyperdriveBinding({
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
    }, "local")).toBe(false);
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

describe("runtime profiles migrations", () => {
  it("defaults on for local PGlite databases", () => {
    expect(localProfile.runMigrationsOnStartup({ DATABASE_URL: "pglite:.data/school" })).toBe(true);
  });

  it("defaults off for local Postgres databases", () => {
    expect(localProfile.runMigrationsOnStartup({ DATABASE_URL: "postgres://admin:admin@localhost:5432/edaya" })).toBe(false);
  });

  it("uses the explicit env flag over the database default", () => {
    expect(localProfile.runMigrationsOnStartup({
      DATABASE_URL: "pglite:.data/school",
      RUN_MIGRATIONS_ON_STARTUP: false,
    })).toBe(false);
    expect(localProfile.runMigrationsOnStartup({
      DATABASE_URL: "postgres://admin:admin@localhost:5432/edaya",
      RUN_MIGRATIONS_ON_STARTUP: true,
    })).toBe(true);
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

describe("createRuntimeRegistry", () => {
  it("reuses cached runtimes on process profiles and rejects worker env", async () => {
    let buildCount = 0;
    const registryConfig = {
      buildRuntime: async () => {
        buildCount += 1;
        return { close: async () => {} };
      },
      closeRuntime: async () => {},
    };
    const registry = createRuntimeRegistry<
      { RUNTIME: "local" | "worker"; DATABASE_URL: string },
      { close: () => Promise<void> }
    >(registryConfig);

    const env = { RUNTIME: "local" as const, DATABASE_URL: "postgres://local" };
    await registry.get(env);
    await registry.get(env);
    expect(buildCount).toBe(1);

    await expect(registry.get({ RUNTIME: "worker", DATABASE_URL: "postgres://worker" }))
      .rejects
      .toThrow(/worker runtime/i);
  });
});

describe("EnvSchema runtime", () => {
  it("rejects legacy RUNTIME=node", () => {
    expect(() => parseEnv({
      RUNTIME: "node",
      DATABASE_URL: "pglite:.data/school",
    })).toThrow(/RUNTIME/i);
  });
});

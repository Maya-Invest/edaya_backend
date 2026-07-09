import { describe, expect, it } from "bun:test";
import { createInMemoryFileStorage } from "@edaya/core";
import { parseEnv } from "@/runtime";
import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { Hono } from "hono";

const localEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

const workerEnv = parseEnv({
  ...localEnv,
  RUNTIME: "worker",
});

describe("memory file storage routes", () => {
  it("stores and retrieves bytes through the local memory endpoints", async () => {
    const fileStorage = createInMemoryFileStorage();
    const storageKey = "school-1/uploads/test.bin";
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = localEnv;
      c.set("schoolApp", { fileStorage } as never);
      await next();
    });
    app.route("/", indexRouter);

    const payload = new Uint8Array([1, 2, 3, 4]);
    const putRes = await app.request(`/core/files/memory/${encodeURIComponent(storageKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: payload,
    });
    expect(putRes.status).toBe(204);

    const getRes = await app.request(
      `/core/files/memory/${encodeURIComponent(storageKey)}?fileName=test.bin`,
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("content-type")).toBe("application/octet-stream");
    expect(new Uint8Array(await getRes.arrayBuffer())).toEqual(payload);
  });

  it("returns 404 when memory storage is unavailable on worker runtime", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = workerEnv;
      c.set("schoolApp", { fileStorage: createInMemoryFileStorage() } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/memory/school-1%2Fmissing.bin");
    expect(res.status).toBe(404);
  });
});

import { describe, expect, it } from "bun:test";
import createApp from "@/http/create-app";
import { parseEnv } from "@/runtime";

const env = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  API_ORIGIN: "http://localhost:9999",
  TRUSTED_ORIGINS: "http://localhost:5173",
});

describe("public request bounds", () => {
  for (const path of ["/core/commands/register-attachment", "/core/entities/students/list"]) {
    it(`rejects oversized ${path} input before dependency or command execution`, async () => {
      const response = await createApp().fetch(new Request(`http://localhost:9999${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:5173" },
        body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
      }), env);
      expect(response.status).toBe(413);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    });
  }

  it("bounds streamed input without relying on Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    const response = await createApp().fetch(new Request("http://localhost:9999/core/commands/register-attachment", {
      method: "POST",
      body,
    }), env);
    expect(response.status).toBe(413);
  });
});

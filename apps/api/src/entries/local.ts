import { serve } from "@hono/node-server";
import { resolvePdfRenderer } from "@edaya/adaptor-docs";
import app from "@/app";
import { loadLocalProcessEnv } from "@/runtime";

function fcmTransportKind(serviceAccountJson: string | undefined): "http-v1" | "log" | "invalid" {
  if (!serviceAccountJson?.trim())
    return "log";
  try {
    const parsed = JSON.parse(serviceAccountJson) as { project_id?: unknown };
    return typeof parsed.project_id === "string" && parsed.project_id.length > 0 ? "http-v1" : "invalid";
  }
  catch {
    return "invalid";
  }
}

async function main(): Promise<void> {
  const env = loadLocalProcessEnv();
  const pdfKind = resolvePdfRenderer(env)?.kind ?? "none";
  const fcmKind = fcmTransportKind(env.FCM_SERVICE_ACCOUNT_JSON);

  serve({
    fetch: request => app.fetch(request, env),
    port: env.PORT,
  });

  // eslint-disable-next-line no-console -- local dev startup banner
  console.log(`Server is running on port http://localhost:${env.PORT} (${env.RUNTIME} runtime, pdf=${pdfKind}, fcm=${fcmKind})`);
}

main().catch((error: unknown) => {
  console.error("Failed to start local API:", error);
  process.exit(1);
});

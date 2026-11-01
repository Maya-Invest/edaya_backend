import { dispatchSchoolImports } from "@edaya/service";
import { startImportRecovery } from "@/runtime/local/import-recovery";
import { localOperations } from "../../configuration/local-operations.ts";
import { maintenanceResponse } from "@/operational-controls";
import { createCapturedIdentity } from "@/identity/local/capture";
import { createOtpDelivery } from "@/identity/otp-delivery";
import { parseEnv } from "@/identity/env";
import { attachIdentityRuntime } from "@/identity/runtime";
import { getApiRuntime, resetApiRuntimesForTests } from "@/runtime/local/registry";
import { accountRequiresPrivilegedTotp } from "@/lib/account-security-policy";
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

  const operations = localOperations(env);
  const identityEnv = parseEnv({ ...env, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? (env.NODE_ENV === "production" ? undefined : "local-account-secret-at-least-32-characters"), BETTER_AUTH_URL: env.API_ORIGIN, FIRST_PARTY_API_ORIGINS: env.API_ORIGIN }, "local");
  const captured = env.LOCAL_OTP_CAPTURE
    ? await createCapturedIdentity(identityEnv, {
        delivery: createOtpDelivery(identityEnv),
        operationsScope: operations.scope,
        operationsRootId: operations.rootId,
        privilegedPolicy: { async requiresTotp(accountId) {
          return env.REQUIRE_PRIVILEGED_TOTP === true && accountRequiresPrivilegedTotp((await (await getApiRuntime(env)).getSchoolApplication()).repositories, accountId);
        } },
      })
    : undefined;
  if (captured)
    attachIdentityRuntime(env, captured.runtime);
  const server = serve({
    ...(captured ? { hostname: "127.0.0.1" } : {}),
    fetch: (request) => {
      if (operations.read().controls.PAUSE_API)
        return maintenanceResponse();
      if (captured && new URL(request.url).pathname.startsWith("/auth/edaya/testing/"))
        return captured.app.fetch(request, identityEnv);
      return app.fetch(request, env);
    },
    port: env.PORT,
  });

  const stopImportRecovery = startImportRecovery(
    () => operations.background(["PAUSE_SCHEDULER", "PAUSE_JOBS"], async () => {
      const runtime = await getApiRuntime(env);
      await dispatchSchoolImports(await runtime.getSchoolApplication(), { maxPages: 1000, maxDurationMs: 20000 });
    }),
    () => console.error("Local import recovery failed; it will retry on the next heartbeat"),
  );

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => server.close(() => {
      void stopImportRecovery().then(() => resetApiRuntimesForTests()).then(() => captured?.close()).then(() => process.exit(0));
    }));
  }
  // eslint-disable-next-line no-console -- local dev startup banner
  console.log(`Server is running on port http://localhost:${env.PORT} (${env.RUNTIME} runtime, pdf=${pdfKind}, fcm=${fcmKind})`);
}

main().catch((error: unknown) => {
  console.error("Failed to start local API:", error);
  process.exit(1);
});

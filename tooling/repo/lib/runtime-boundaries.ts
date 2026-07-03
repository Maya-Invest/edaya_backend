import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RuntimeBoundaryViolation {
  label: string;
  message: string;
}

function readRepoFile(repoRoot: string, relativePath: string): string | null {
  const filePath = resolve(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf8");
}

export function findRuntimeBoundaryViolations(repoRoot: string): RuntimeBoundaryViolation[] {
  const violations: RuntimeBoundaryViolation[] = [];

  const envExample = readRepoFile(repoRoot, "apps/api/.env.example");
  if (!envExample) {
    violations.push({
      label: "missing apps/api/.env.example",
      message: "apps/api/.env.example is required for local runtime documentation",
    });
  }
  else {
    if (!/\bRUNTIME=local\b/m.test(envExample)) {
      violations.push({
        label: "local env example",
        message: "apps/api/.env.example must set RUNTIME=local",
      });
    }
    if (/DATABASE_URL=postgres:\/\//m.test(envExample)) {
      violations.push({
        label: "local env example",
        message: "apps/api/.env.example must not default DATABASE_URL to postgres://",
      });
    }
    if (!/DATABASE_URL=pglite:\.data\/school/m.test(envExample)) {
      violations.push({
        label: "local env example",
        message: "apps/api/.env.example must default DATABASE_URL to pglite:.data/school",
      });
    }
  }

  const fileStorage = readRepoFile(repoRoot, "apps/api/src/runtime/shared/adapters/file-storage.ts");
  if (fileStorage) {
    if (!/switch\s*\(\s*env\.RUNTIME\s*\)/.test(fileStorage)) {
      violations.push({
        label: "flat file storage resolver",
        message: "resolveFileStorage must switch on env.RUNTIME",
      });
    }
    if (/if\s*\(\s*isR2FileStorageConfigured\(env\)\s*\)\s*\{[\s\S]*?return createR2FileStorageFromEnv/.test(fileStorage)
      && !/case\s+"worker"/.test(fileStorage)) {
      violations.push({
        label: "flat file storage resolver",
        message: "resolveFileStorage must not upgrade to R2 before selecting the worker runtime",
      });
    }
  }

  const localSchoolDb = readRepoFile(repoRoot, "apps/api/src/runtime/local/school-database.ts");
  if (localSchoolDb?.includes("createPostgresSchoolDatabase")) {
    violations.push({
      label: "local school database",
      message: "apps/api local school-database must not use createPostgresSchoolDatabase",
    });
  }

  const startLocalDev = readRepoFile(repoRoot, "tooling/repo/dev/start-local-dev.ts");
  if (startLocalDev) {
    if (!startLocalDev.includes("@edaya/local-files")) {
      violations.push({
        label: "local dev orchestrator",
        message: "start-local-dev.ts must start @edaya/local-files with bun dev",
      });
    }
    if (startLocalDev.includes("isR2FileStorageConfigured")) {
      violations.push({
        label: "local dev orchestrator",
        message: "start-local-dev.ts must not gate local-files on R2 configuration",
      });
    }
  }

  const notificationGateway = readRepoFile(repoRoot, "apps/api/src/runtime/shared/adapters/notification-gateway.ts");
  if (notificationGateway && !notificationGateway.includes('env.RUNTIME === "in-memory"')) {
    violations.push({
      label: "in-memory notification boundary",
      message: "resolveNotificationGateway must no-op on RUNTIME=in-memory",
    });
  }

  const authEmailDelivery = readRepoFile(repoRoot, "apps/api/src/runtime/shared/adapters/auth-email-delivery.ts");
  if (authEmailDelivery && !authEmailDelivery.includes('env.RUNTIME === "in-memory"')) {
    violations.push({
      label: "in-memory auth email boundary",
      message: "resolveAuthEmailDelivery must not use Novu on RUNTIME=in-memory",
    });
  }

  if (existsSync(resolve(repoRoot, "apps/cron"))) {
    violations.push({
      label: "legacy cron app",
      message: "apps/cron must be removed; scheduled cron runs on @edaya/api worker",
    });
  }

  const wrangler = readRepoFile(repoRoot, "apps/api/wrangler.jsonc");
  if (!wrangler) {
    violations.push({
      label: "wrangler cron",
      message: "apps/api/wrangler.jsonc is required for worker cron configuration",
    });
  }
  else {
    if (/0 2 \* \* \*/.test(wrangler) || /0 6 \* \* \*/.test(wrangler)) {
      violations.push({
        label: "wrangler cron",
        message: "apps/api/wrangler.jsonc must use a single heartbeat cron (*/5 * * * *), not per-job triggers",
      });
    }

    const cronBlocks = [...wrangler.matchAll(/"crons"\s*:\s*\[([^\]]*)\]/g)];
    if (cronBlocks.length === 0) {
      violations.push({
        label: "wrangler cron",
        message: "apps/api/wrangler.jsonc must declare triggers.crons heartbeat",
      });
    }
    else {
      for (const [, block] of cronBlocks) {
        const expressions = [...block.matchAll(/"([^"]+)"/g)].map(match => match[1]);
        if (expressions.length !== 1 || expressions[0] !== "*/5 * * * *") {
          violations.push({
            label: "wrangler cron",
            message: `each wrangler triggers.crons must contain only "*/5 * * * *" (found: ${expressions.join(", ") || "none"})`,
          });
          break;
        }
      }
    }

    if (!wrangler.includes('"binding": "CRON_JOBS"')) {
      violations.push({
        label: "wrangler cron queue",
        message: "apps/api/wrangler.jsonc must declare CRON_JOBS queue producer binding",
      });
    }
  }

  return violations;
}

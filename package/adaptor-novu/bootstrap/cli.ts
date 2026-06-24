#!/usr/bin/env bun
import { buildBootstrapWorkflows } from "./catalog/workflows";
import { applyBootstrapIntegrations, formatIntegrationApplyResult } from "./lib/apply-integrations";
import { applyBootstrapWorkflows, formatWorkflowApplyResult } from "./lib/apply-workflows";
import { createBootstrapNovuClient } from "./lib/client";
import { loadBootstrapEnv, resolveBootstrapIntegrations } from "./lib/env";
import { loadBootstrapEmailTemplates } from "./lib/load-templates";

type Command = "apply" | "plan" | "validate";

function parseCommand(argv: string[]): Command {
  const command = argv[2] ?? "plan";
  if (command === "apply" || command === "plan" || command === "validate") {
    return command;
  }
  throw new Error(`Unknown command "${command}". Use: apply | plan | validate`);
}

function printUsage() {
  console.log(`Usage: bun package/adaptor-novu/bootstrap/cli.ts <apply|plan|validate>

Commands:
  plan      Show what would change (default)
  apply     Create or update Novu workflows and integrations
  validate  Check the local catalog only (no API calls)

Environment (from process.env or apps/api/.env):
  NOVU_SECRET_KEY              required
  NOVU_API_URL                 optional (e.g. https://eu.api.novu.co)

Email webhook integration (optional but recommended):
  NOVU_EMAIL_WEBHOOK_URL       e.g. https://novu-email-staging.example.com
  NOVU_EMAIL_WEBHOOK_SECRET    HMAC secret (matches novu-email-bridge)
  NOVU_EMAIL_FROM              e.g. announcements@example.com
  NOVU_EMAIL_SENDER_NAME       default: Edaya
`);
}

async function validateCatalog(workflows: ReturnType<typeof buildBootstrapWorkflows>) {
  const workflowIds = new Set<string>();
  for (const workflow of workflows) {
    if (workflowIds.has(workflow.workflowId)) {
      throw new Error(`Duplicate workflowId in catalog: ${workflow.workflowId}`);
    }
    workflowIds.add(workflow.workflowId);
    if (workflow.steps.length === 0) {
      throw new Error(`Workflow ${workflow.workflowId} has no steps`);
    }
  }
  console.log(`✓ catalog valid (${workflows.length} workflows)`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const command = parseCommand(process.argv);

  const templates = await loadBootstrapEmailTemplates();
  const workflows = buildBootstrapWorkflows(templates);

  if (command === "validate") {
    await validateCatalog(workflows);
    return;
  }

  const env = await loadBootstrapEnv();
  await validateCatalog(workflows);

  const novu = createBootstrapNovuClient({
    secretKey: env.secretKey,
    ...(env.serverURL ? { serverURL: env.serverURL } : {}),
  });

  const integrations = resolveBootstrapIntegrations(env);
  const dryRun = command === "plan";

  console.log(dryRun ? "Novu bootstrap plan" : "Novu bootstrap apply");
  if (env.serverURL) {
    console.log(`API: ${env.serverURL}`);
  }

  const workflowResult = await applyBootstrapWorkflows(novu, workflows, { dryRun });
  console.log(formatWorkflowApplyResult(workflowResult));

  const integrationResult = await applyBootstrapIntegrations(novu, integrations, { dryRun });
  console.log(formatIntegrationApplyResult(integrationResult));

  if (dryRun) {
    console.log("\nRun with `apply` to push changes.");
  }
  else {
    console.log("\n✓ Bootstrap complete.");
    console.log("Manual follow-up: configure Novu outbound webhooks → POST /webhooks/novu (see bootstrap/README.md).");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

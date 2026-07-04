#!/usr/bin/env bun
import { buildBootstrapWorkflows } from "./catalog/workflows";
import { applyBootstrapWorkflows, formatWorkflowApplyResult } from "./lib/apply-workflows";
import { createBootstrapNovuClient } from "./lib/client";
import { loadBootstrapEnv, validateNovuSecretKeyHint } from "./lib/env";
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
  console.log(`Usage: bun tooling/novu-ops/bootstrap/cli.ts <apply|plan|validate>

Commands:
  plan      Show what would change (default)
  apply     Create or update Novu workflows
  validate  Check the local catalog only (no API calls)

Environment (from process.env or apps/api/.env):
  NOVU_SECRET_KEY              required
  NOVU_API_URL                 optional (e.g. https://eu.api.novu.co)
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
  const keyHint = validateNovuSecretKeyHint(env.secretKey);
  if (keyHint) {
    console.warn(`⚠ ${keyHint}`);
  }
  await validateCatalog(workflows);

  const novu = createBootstrapNovuClient({
    secretKey: env.secretKey,
    ...(env.serverURL ? { serverURL: env.serverURL } : {}),
  });

  const dryRun = command === "plan";

  console.log(dryRun ? "Novu bootstrap plan" : "Novu bootstrap apply");
  if (env.serverURL) {
    console.log(`API: ${env.serverURL}`);
  }

  const workflowResult = await applyBootstrapWorkflows(novu, workflows, { dryRun });
  console.log(formatWorkflowApplyResult(workflowResult));

  if (dryRun) {
    console.log("\nRun with `apply` to push changes.");
  }
  else {
    console.log("\n✓ Bootstrap complete.");
    console.log("Manual follow-up: configure Novu outbound webhooks → POST /webhooks/notification-delivery (see bootstrap/README.md).");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("API Key not found")) {
    console.error(message);
    console.error("");
    console.error("Novu rejected NOVU_SECRET_KEY. Check:");
    console.error("  1. Novu dashboard → Settings → API Keys → Secret Key (not Application Identifier)");
    console.error("  2. Same region as NOVU_API_URL (EU workspace → https://eu.api.novu.co)");
    console.error("  3. Key stored in apps/api/.env (local dev) or Wrangler secrets (deployed workers)");
    process.exit(1);
  }
  console.error(message);
  process.exit(1);
});

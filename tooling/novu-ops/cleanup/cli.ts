#!/usr/bin/env bun
import { createBootstrapNovuClient } from "../bootstrap/lib/client";
import { loadBootstrapEnv } from "../bootstrap/lib/env";
import type { SubscriberCleanupSelector } from "../src/subscriber-cleanup";
import {
  deleteNovuSubscribers,
  hasSubscriberCleanupSelector,
  listAllNovuSubscribers,
  selectNovuSubscribersForCleanup,
} from "../src/subscriber-cleanup";

type Command = "apply" | "plan";

interface ParsedCli {
  command: Command;
  selector: SubscriberCleanupSelector;
  limit?: number;
  yes: boolean;
}

function parseArgs(argv: string[]): ParsedCli {
  const args = argv.slice(2);
  const command = args[0];
  if (command !== "plan" && command !== "apply") {
    throw new Error(`Unknown command "${command ?? ""}". Use: plan | apply`);
  }

  const selector: SubscriberCleanupSelector = {};
  let limit: number | undefined;
  let yes = false;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]!;
    switch (arg) {
      case "--all":
        selector.all = true;
        break;
      case "--transient-invites":
        selector.transientInvites = true;
        break;
      case "--prefix": {
        const value = args[++index];
        if (!value) {
          throw new Error("--prefix requires a value");
        }
        selector.prefix = value;
        break;
      }
      case "--ids": {
        const value = args[++index];
        if (!value) {
          throw new Error("--ids requires a comma-separated list");
        }
        selector.ids = value.split(",").map(id => id.trim()).filter(Boolean);
        break;
      }
      case "--limit": {
        const value = Number(args[++index]);
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error("--limit requires a positive integer");
        }
        limit = value;
        break;
      }
      case "--yes":
        yes = true;
        break;
      default:
        throw new Error(`Unknown option "${arg}"`);
    }
  }

  return { command, selector, limit, yes };
}

function printUsage() {
  console.log(`Usage: bun tooling/novu-ops/cleanup/cli.ts <plan|apply> [options]

Commands:
  plan      List subscribers that would be deleted (default)
  apply     Delete matching subscribers

Selectors (at least one required):
  --transient-invites       Delete invite:* subscribers (pre-account invitations)
  --prefix <value>          Delete subscribers whose subscriberId starts with value
  --ids <id1,id2,...>       Delete explicit subscriber ids
  --all                     Delete every subscriber (apply also requires --yes)

Safety:
  --limit <n>               Cap deletions per run (default: no cap)
  --yes                     Skip confirmation prompt on apply (required with --all)

Environment (from process.env or apps/api/.env):
  NOVU_SECRET_KEY           required
  NOVU_API_URL              optional (e.g. https://eu.api.novu.co)

Examples:
  bun novu:cleanup -- --transient-invites
  bun novu:cleanup:apply -- --prefix smoke- --yes
  bun tooling/novu-ops/cleanup/cli.ts plan --ids auth-g1,invite:inv-123
`);
}

function describeSelector(selector: SubscriberCleanupSelector): string {
  if (selector.ids?.length) {
    return `${selector.ids.length} explicit id(s)`;
  }
  if (selector.transientInvites) {
    return "transient invitation subscribers (invite:*)";
  }
  if (selector.prefix) {
    return `subscriberId prefix "${selector.prefix}"`;
  }
  if (selector.all) {
    return "all subscribers";
  }
  return "none";
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const { command, selector, limit, yes } = parseArgs(process.argv);
  if (!hasSubscriberCleanupSelector(selector)) {
    printUsage();
    throw new Error("At least one selector is required.");
  }

  const env = await loadBootstrapEnv();
  const novu = createBootstrapNovuClient({
    secretKey: env.secretKey,
    ...(env.serverURL ? { serverURL: env.serverURL } : {}),
  });

  console.log(command === "plan" ? "Novu subscriber cleanup plan" : "Novu subscriber cleanup apply");
  if (env.serverURL) {
    console.log(`API: ${env.serverURL}`);
  }
  console.log(`Selector: ${describeSelector(selector)}`);

  const allSubscribers = await listAllNovuSubscribers(novu);
  const matches = selectNovuSubscribersForCleanup(allSubscribers, selector);
  const targets = limit ? matches.slice(0, limit) : matches;

  console.log(`Found ${allSubscribers.length} subscriber(s) in Novu`);
  console.log(`Matched ${matches.length} subscriber(s)`);
  if (limit && matches.length > limit) {
    console.log(`Limited to ${limit} subscriber(s) for this run`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  for (const subscriber of targets.slice(0, 20)) {
    const email = subscriber.email ? `  ${subscriber.email}` : "";
    console.log(`  • ${subscriber.subscriberId}${email}`);
  }
  if (targets.length > 20) {
    console.log(`  … and ${targets.length - 20} more`);
  }

  if (command === "plan") {
    console.log("\nRun with `apply` to delete these subscribers.");
    return;
  }

  if (selector.all && !yes) {
    throw new Error("Refusing to delete all subscribers without --yes");
  }

  if (!yes && process.stdin.isTTY) {
    process.stdout.write(`\nDelete ${targets.length} subscriber(s)? [y/N] `);
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", data => resolve(String(data).trim().toLowerCase()));
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted.");
      return;
    }
  }
  else if (!yes && !process.stdin.isTTY) {
    throw new Error("Non-interactive apply requires --yes");
  }

  const result = await deleteNovuSubscribers(
    novu,
    targets.map(subscriber => subscriber.subscriberId),
  );

  console.log(`\nDeleted: ${result.deleted}`);
  console.log(`Skipped (not found): ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  if (result.errors.length > 0) {
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  ✗ ${error.subscriberId}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { staging } from "./staging-target.mjs";

export function summarizeEvent(value) {
  return {
    at: value.eventTimestamp,
    outcome: value.outcome,
    scheduled: typeof value.event?.cron === "string",
    queue: typeof value.event?.queue === "string",
    errors: (value.exceptions?.length || 0) + (value.logs || []).filter(log => log.level === "error").length,
    warnings: (value.logs || []).filter(log => log.level === "warn").length,
    httpStatus: value.event?.response?.status ?? null,
  };
}

// Wrangler pretty-prints each JSON event; chunks need not align with JSON records.
export function jsonEventReader(consume) {
  let buffer = "";
  return chunk => {
    buffer += chunk;
    for (;;) {
      const start = buffer.indexOf("{");
      if (start < 0) { buffer = ""; return; }
      let depth = 0, quoted = false, escaped = false, end = -1;
      for (let i = start; i < buffer.length; i++) {
        const character = buffer[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') quoted = false;
        } else if (character === '"') quoted = true;
        else if (character === "{") depth++;
        else if (character === "}" && --depth === 0) { end = i + 1; break; }
      }
      if (end < 0) { if (buffer.length > 2_000_000) throw new Error("Worker tail record is too large"); return; }
      const value = JSON.parse(buffer.slice(start, end));
      buffer = buffer.slice(end);
      if (typeof value.outcome === "string") consume(value);
    }
  };
}

export async function observeStaging(root) {
  const observations = [], events = { identity: [], api: [] }, tails = [];
  let failure;
  let stopping = false;
  const save = () => writeFileSync(resolve(root, "release/observation.json"), JSON.stringify({ observations, events, complete: false }, null, 2));
  try {
    for (const [app, repo, worker] of [["identity", "edaya_identity", "edaya-identity-staging"], ["api", "edaya_backend", "edaya-api-staging"]]) {
      const cwd = resolve(root, repo, "apps", app);
      const child = spawn(resolve(cwd, "node_modules/.bin/wrangler"), ["tail", worker, "--format", "json"], { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
      tails.push(child);
      const consume = jsonEventReader(value => {
        const event = summarizeEvent(value);
        events[app].push(event);
        if (event.errors || event.outcome !== "ok" || event.httpStatus >= 500) failure = new Error(`Unhealthy ${app} Worker event during observation`);
      });
      child.stdout.on("data", chunk => { try { consume(chunk.toString()); } catch { failure = new Error("Could not parse Worker observation stream"); } });
      // Tail diagnostics may contain request data. Record only stream availability.
      child.stderr.resume();
      child.on("error", () => { failure = new Error("Could not start Worker tail"); });
      child.on("exit", () => { if (!stopping) failure = new Error("Worker tail disconnected during observation"); });
    }
    for (let minute = 0; minute <= 30; minute++) {
      if (minute) await new Promise(done => setTimeout(done, 60000));
      if (failure) throw failure;
      for (const [app, base] of Object.entries(staging.urls)) {
        const path = app === "api" ? "/reference" : app === "identity" ? "/" : "/login";
        const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
        if (response.status !== 200) throw new Error(`HTTP ${response.status} from ${app} during observation`);
      }
      observations.push({ minute, at: new Date().toISOString(), http: "passed" });
      save();
    }
    if (failure) throw failure;
    if (events.identity.filter(event => event.scheduled).length < 1 || events.api.filter(event => event.scheduled).length < 5) throw new Error("Observation did not capture the required scheduled executions");
    if ([...events.identity, ...events.api].some(event => event.warnings)) throw new Error("Worker warnings require review before acceptance");
    writeFileSync(resolve(root, "release/observation.json"), JSON.stringify({ observations, events, complete: true }, null, 2));
  } finally {
    stopping = true;
    for (const child of tails) child.kill("SIGTERM");
  }
}

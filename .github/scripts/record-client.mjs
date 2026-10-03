import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export function recordClient(name, version, sourceSha, status) {
  if (name !== "api") throw new Error("Only the unified API client may be recorded");
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid backend source commit");
  if (!process.env.RELEASE_ROOT) return;
  const directory = resolve(process.env.RELEASE_ROOT, "release");
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "client-publication.json");
  const clients = {};
  clients[name] = { version, sourceSha, status, verifiedAt: new Date().toISOString() };
  writeFileSync(file, `${JSON.stringify(clients, null, 2)}\n`);
}

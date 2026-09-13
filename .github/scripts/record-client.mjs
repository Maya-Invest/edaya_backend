import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export function recordClient(name, version, sourceSha, status) {
  if (!process.env.RELEASE_ROOT) return;
  const directory = resolve(process.env.RELEASE_ROOT, "release");
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "client-publication.json");
  const clients = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  clients[name] = { version, sourceSha, status, verifiedAt: new Date().toISOString() };
  writeFileSync(file, `${JSON.stringify(clients, null, 2)}\n`);
}

import { localOperations } from "../../../configuration/local-operations";
import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import type { SchedulerDatabase } from "@/runtime/shared/adapters/sqlite-scheduler";

export function localSchedulerPath(env: Record<string, unknown>) {
  return resolve(localOperations(env).directory, "scheduler.sqlite");
}

export function openLocalScheduler(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file, { create: true });
  db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL");
  const migrations = fileURLToPath(new URL("../../../scheduler-migrations/", import.meta.url));
  db.exec("CREATE TABLE IF NOT EXISTS d1_migrations(name TEXT PRIMARY KEY)");
  db.transaction(() => {
    for (const name of readdirSync(migrations)
      .filter(n => n.endsWith(".sql"))
      .sort()) {
      if (db.query("SELECT 1 FROM d1_migrations WHERE name=?").get(name))
        continue;
      db.exec(readFileSync(join(migrations, name), "utf8"));
      db.query("INSERT INTO d1_migrations(name) VALUES(?)").run(name);
    }
  }).immediate();
  const binding: SchedulerDatabase = {
    prepare: sql => ({
      bind: (...values) => ({
        all: async <T>() => ({ results: db.query(sql).all(...values) as T[] }),
      }),
    }),
  };
  return { binding, close: () => db.close() };
}

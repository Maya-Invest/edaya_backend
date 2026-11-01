import type { SQL } from "drizzle-orm";
import type { NotifySql } from "./types";
import { sql } from "drizzle-orm";

function bindSql(query: string, params: unknown[] = []): SQL {
  if (params.length === 0) {
    return sql.raw(query);
  }

  let result: SQL | undefined;
  const append = (piece: SQL): void => {
    result = result ? sql`${result}${piece}` : piece;
  };

  const regex = /\$(\d+)/g;
  let lastIndex = 0;
  let match = regex.exec(query);
  while (match !== null) {
    if (match.index > lastIndex) {
      append(sql.raw(query.slice(lastIndex, match.index)));
    }
    append(sql`${params[Number(match[1]) - 1]}`);
    lastIndex = match.index + match[0].length;
    match = regex.exec(query);
  }
  if (lastIndex < query.length) {
    append(sql.raw(query.slice(lastIndex)));
  }
  return result ?? sql.raw(query);
}

function extractRows(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows;
    }
  }
  return [];
}

export function createNotifySqlFromDrizzle(db: unknown, getExecutor?: () => unknown): NotifySql {
  const executor = (): { execute: (query: SQL) => Promise<unknown> } => (getExecutor?.() ?? db) as { execute: (query: SQL) => Promise<unknown> };
  return {
    async query<T>(query: string, params: unknown[] = []) {
      const result = await executor().execute(bindSql(query, params));
      return extractRows(result) as T[];
    },
    async execute(query: string, params: unknown[] = []) {
      await executor().execute(bindSql(query, params));
    },
    async close() {},
  };
}

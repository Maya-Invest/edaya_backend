import { expect, test } from "bun:test";
import { jsonEventReader, summarizeEvent } from "./observe-staging.mjs";

test("observation parser handles split records and braces inside quoted logs", () => {
  const records = [];
  const read = jsonEventReader(value => records.push(value));
  const value = JSON.stringify({ outcome: "ok", logs: [{ message: ['secret { content } \\"'] }] }, null, 2);
  for (const character of `Connected\n${value}\n${value}`) read(character);
  expect(records).toHaveLength(2);
});
test("observation artifacts retain health evidence without request or log content", () => {
  const summary = summarizeEvent({ outcome: "exception", eventTimestamp: 1, event: { cron: "*/5 * * * *", request: { url: "secret" } }, exceptions: [{ message: "secret" }], logs: [{ level: "error", message: ["secret"] }] });
  expect(summary.errors).toBe(2);
  expect(summary.scheduled).toBe(true);
  expect(JSON.stringify(summary)).not.toContain("secret");
});

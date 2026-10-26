import { expect, test } from "bun:test";
import { startImportRecovery } from "../import-recovery";

test("startup recovery cannot overlap and shutdown waits for its active drain", async () => {
  let runs = 0;
  let release!: () => void;
  const stop = startImportRecovery(async () => {
    runs++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  }, () => {}, 5);
  await Bun.sleep(20);
  expect(runs).toBe(1);
  let stopped = false;
  const stopping = stop().then(() => {
    stopped = true;
  });
  await Bun.sleep(10);
  expect(stopped).toBe(false);
  release();
  await stopping;
  await Bun.sleep(10);
  expect(runs).toBe(1);
});

test("failed local drains report an error and retry on the next heartbeat", async () => {
  let runs = 0;
  let failures = 0;
  let recovered!: () => void;
  const recovery = new Promise<void>((resolve) => {
    recovered = resolve;
  });
  const stop = startImportRecovery(async () => {
    runs++;
    if (runs === 1)
      throw new Error("transient");
    recovered();
  }, () => { failures++; }, 5);
  await recovery;
  await stop();
  expect(runs).toBe(2);
  expect(failures).toBe(1);
});

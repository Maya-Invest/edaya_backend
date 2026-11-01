/** One local recovery loop shares the API runtime, including its PGlite connection. */
export function startImportRecovery(run: () => Promise<unknown>, onError: (error: unknown) => void, intervalMs = 60000) {
  let stopped = false;
  let active: Promise<void> | undefined;
  const tick = () => {
    if (stopped || active)
      return;
    active = Promise.resolve().then(run).then(() => {}, onError).finally(() => {
      active = undefined;
    });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await active;
  };
}

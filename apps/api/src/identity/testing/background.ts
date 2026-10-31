/** Serial disposable-fixture heartbeats; teardown waits before closing shared runtimes. */
export function startFixtureBackgroundTasks(task: () => Promise<unknown>, onFailure: () => void, intervalMs = 1000) {
  let stopped = false;
  let pending: Promise<unknown> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(() => {
      pending = task().catch(() => {
        stopped = true;
        onFailure();
      }).finally(() => {
        if (!stopped)
          schedule();
      });
    }, intervalMs);
  };
  schedule();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
  };
}

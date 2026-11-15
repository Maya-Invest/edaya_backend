/** Wait for every scheduled task before closing shared runtime resources. */
export async function runIndependentJobs(tasks: readonly (() => Promise<void>)[]): Promise<void> {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(failures.map(result => result.reason), "Scheduled API tasks failed");
}

export function runHeartbeatJobs(scheduledAt: Date, schoolHeartbeat: () => Promise<void>, identityCleanup: () => Promise<void>): Promise<void> {
  const tasks = [schoolHeartbeat];
  if (scheduledAt.getUTCMinutes() === 0)
    tasks.push(identityCleanup);
  return runIndependentJobs(tasks);
}

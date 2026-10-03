/** Start both jobs even when one fails; wait for both before closing connections. */
export async function runIndependentJobs(tasks: readonly (() => Promise<void>)[]): Promise<void> {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(failures.map(result => result.reason), "Scheduled API tasks failed");
}

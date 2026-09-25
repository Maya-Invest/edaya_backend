# Backend remediation benchmark

Local native PostgreSQL, fresh disposable database per size, `ANALYZE` after fixture loading. Measurements are one cold application call per size; authorization-scope construction is excluded from both implementations. `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` runs separately after timing. These measurements are evidence of query shape and local behavior, not a production latency guarantee.

| Students | Classes | Before queries | After queries | Before returned rows | After returned rows | Before ms | After ms |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 30 | 1 | 15 | 1 | 129 | 1 | 58.58 | 58.80 |
| 300 | 10 | 15 | 1 | 1,227 | 1 | 75.82 | 68.22 |
| 3,000 | 100 | 15 | 1 | 12,207 | 1 | 186.00 | 102.12 |

The single returned row contains aggregate totals, one record per class, and at most 14 upcoming events as JSON. It does not contain individual student, enrollment, mark, or charge collections. Fixtures include one original test student/class in addition to the labeled generated dataset. Each generated charge has a partial payment and two installments; the benchmark asserts that only the remaining overdue installment amount contributes to arrears.

The first SQL implementation used three independently planned queries. Its 3,000-student latency was slower than the reference despite returning fewer rows. That result is retained in `backend-remediation-initial-projection.json`. The final implementation shares scoped CTEs and one database snapshot across totals, class risk, and events; grouped class aggregates replace repeated correlated class scans.

At 3,000 students the final plan reports approximately 55 ms planning and 43 ms execution. Existing indexes serve selective references; sequential scans over the selected school's large share of the fixture are appropriate for these aggregates. The measured plans do not justify another index solely for this projection, so no speculative dashboard index was added. The complete execution plans, row counts, and buffer evidence are in `backend-remediation-benchmarks.json`.

Reproduce in `tooling/integration-tests`:

```sh
EDAYA_BENCHMARK_OUTPUT="$PWD/../../docs/performance/backend-remediation-benchmarks.json" \
  bun src/native/run.ts --test-name-pattern 'dashboard projection benchmark'
```

The runner creates and destroys its own loopback cluster. It never reads project `DATABASE_URL`. Run without competing test/build processes to avoid measuring host contention.

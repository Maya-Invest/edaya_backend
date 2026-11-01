# Unit test coverage

How to run coverage, interpret reports, and add tests in the backend monorepo.

## Commands

```sh
# All packages (via Turbo) — informational lcov reports
bun run test:coverage

# Raw Turbo (use lcov reporter; text table breaks Turbo on large packages)
turbo run test --force -- --coverage --coverage-reporter=lcov

# Single package
bun --filter @edaya/core test --coverage --coverage-reporter=lcov
bun --filter @edaya/api test --coverage --coverage-reporter=lcov
```

Pre-PR verification (lint, types, tests — no coverage gate yet):

```sh
bun run verify
```

## Thresholds

| Package | Phase 1 floor | Long-term target |
|---------|---------------|------------------|
| `@edaya/core` | Informational only (no enforced floor yet) | 95% T1 |
| Other packages | Informational only (root `coverageThreshold = 0`) | See [unit-test-coverage-plan](../sprints/unit-test-coverage-plan.md) |

Coverage is collected explicitly with `bun run test:coverage`; the current CI workflows do not run a separate coverage job. The command bypasses Turbo test caches so lcov files are produced. No package fails the build on coverage today.

## Exclusions

Ignored from coverage reports (see `bunfig.toml`):

- Barrel `index.ts` re-exports
- `package/api-client/**`
- `tooling/integration-tests/**` (scene harness, not unit tests)
- `*.integration.test.ts` files are excluded by package unit selectors, so their execution is outside unit coverage
- `@edaya/core`: `src/ports/**` (interface-only ports)

Add new exclusions only with justification in the sprint plan or PR description.

## Adding tests

Keep a unit test when all three are true:

1. It locks a branch a developer can get wrong (reject, map, sequence, conflict).
2. It is the cheapest suite that locks that branch.
3. No lower layer already asserts the same inputs and outcome.

Test a behavior at the lowest layer that can fail. A higher layer keeps a test only when it adds a branch the lower layer cannot see (HTTP error mapping, SQL scope filters, seed fixture mapping).

Remove or do not add a test when:

- The assertion is a constant or empty object literal that TypeScript already types.
- The same plumbing is copied per domain with no domain-specific branch.
- A higher-layer case repeats a rejection already asserted by the focused gate or policy test, and adds no new branch.

Line coverage is not a reason to add or keep a test. [unit-test-coverage-plan.md](../sprints/unit-test-coverage-plan.md) is a **historical** record of folds U0–U7. Do not extend it to chase a coverage percentage.

Also:

1. Prefer **behavior-focused** filenames — see [§4 of the coverage plan](../sprints/unit-test-coverage-plan.md#4-test-file-naming-conventions).
2. Do **not** duplicate integration HTTP tests; unit-test branches, policy strategies, and domain invariants.
3. Reuse shared fixtures: `AuthFixtures`, `describeMatrix`, `policy-fixtures.ts`, `workflow-test-context.ts`.
4. Entity configurations that only wire managed-entity policies belong in the shared operation matrices. Test custom authorization behavior through the production policy and HTTP dependency.

## Temporary below-target files

`below-target-sources.json` at the repo root tracks T1 files intentionally under 95% during fold work. Do not add entries without a fold id and owner.

## Related

- [unit-test-coverage-plan.md](../sprints/unit-test-coverage-plan.md) — historical epic (line coverage is not a reason to add a test)
- [authorization-operations-plan.md](../sprints/archive/authorization-operations-plan.md) — auth test patterns
- [AGENTS.md](../../AGENTS.md) — `bun run verify` before PRs

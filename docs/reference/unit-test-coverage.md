# Unit test coverage

How to run coverage, interpret reports, and add tests in the backend monorepo.

## Commands

```sh
# All packages (via Turbo) — informational lcov reports
bun run test:coverage

# Raw Turbo (use lcov reporter; text table breaks Turbo on large packages)
turbo run test -- --coverage --coverage-reporter=lcov

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

CI runs `bun run test:coverage` as an **informational** job on pull requests. No package fails the build on coverage today.

## Exclusions

Ignored from coverage reports (see `bunfig.toml`):

- Barrel `index.ts` re-exports
- `package/generated-api-client/**`
- `tooling/integration-tests/**` (scene harness, not unit tests)
- `@edaya/core`: `src/ports/**` (interface-only ports)

Add new exclusions only with justification in the sprint plan or PR description.

## Adding tests

1. Prefer **behavior-focused** filenames — see [§4 of the coverage plan](../sprints/unit-test-coverage-plan.md#4-test-file-naming-conventions).
2. Do **not** duplicate integration HTTP tests; unit-test branches, policy strategies, and domain invariants.
3. Reuse shared fixtures: `AuthFixtures`, `describeMatrix`, `policy-fixtures.ts`, `workflow-test-context.ts`.
4. Authorization entities that only wire `operationModule` belong in operation matrices, not new entity auth tests.

## Temporary below-target files

`below-target-sources.json` at the repo root tracks T1 files intentionally under 95% during fold work. Do not add entries without a fold id and owner.

## Related

- [unit-test-coverage-plan.md](../sprints/unit-test-coverage-plan.md) — full epic plan
- [authorization-operations-plan.md](../sprints/authorization-operations-plan.md) — auth test patterns
- [AGENTS.md](../../AGENTS.md) — `bun run verify` before PRs

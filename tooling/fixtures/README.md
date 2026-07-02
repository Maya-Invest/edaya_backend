# @edaya/fixtures

Reference data and dev seed scenarios for Edaya backend tooling.

Orchestration (HTTP seed CLI, ports, workflows) lives in `@edaya/seeding`. This package owns **data only**.

## Layout

```text
assets/profile-pictures/     Binary profile photo pool (pic####.jpg)
data/onboarding/             Country onboarding templates (JSON source files)
test/                        Package tests (mirrors src layout)
src/
  datasets/                  Purpose-driven typed fixture sets (*Input from @edaya/core)
    minimal/                 Auth smoke — school, owner staff, primary guardian
    integration/             Fast integration tests — students g1–g6 / s1–s6
    demo/                    Full dev school — school.ts, people.ts, domains/
    bulk/                    demo + procedural 1000-student population
  onboarding/                Structure templates (CI primaire / collège / lycée)
  meta/                      Dates, manifest, validation harness, dev login
  shared/                    Cross-scenario helpers (ids, builders, profile pictures)
```

## Typed datasets

Records use `satisfies *Input` from `@edaya/core` so schema changes fail at compile time in fixtures.

| Dataset | Import | Purpose |
|---------|--------|---------|
| `minimalDataset` | `@edaya/fixtures` | Better Auth / register-school smoke (`st8`, `g1`) |
| `integrationDataset` | `@edaya/fixtures` | Six auth-linked guardian/student pairs for fast tests |
| `demoDataset` | `@edaya/fixtures` | Full dev school structure and domain entities (**default for `bun seed`**) |
| `devSeedDataset` | `@edaya/fixtures` | Alias of `demoDataset` — used by seed orchestration and validation |
| `bulkDataset` | `@edaya/fixtures` | `demoDataset` merged with 1000-student bulk population (opt-in scale tests) |

Sprint plan: `edaya_backend/docs/sprints/fixture-typed-datasets-plan.md`

## Package exports

| Import | Contents |
|--------|----------|
| `@edaya/fixtures` | `minimalDataset`, `integrationDataset`, `demoDataset`, `devSeedDataset`, `bulkDataset`, `FixtureDataset` types, `demoSchoolOwnerStaffId` |
| `@edaya/fixtures/datasets/minimal` | `minimalDataset` only |
| `@edaya/fixtures/datasets/integration` | `integrationDataset` only |
| `@edaya/fixtures/datasets/demo` | `demoDataset` only |
| `@edaya/fixtures/datasets/bulk` | `bulkDataset` only |
| `demoDataset.extensions.classSubjectStaffAssignments` | `@edaya/fixtures` | Class-subject teacher assignments for access seeding |
| `@edaya/fixtures/onboarding` | CI structure templates, registry, country resolver |
| `@edaya/fixtures/demo-login` | Dev login account helpers |
| `@edaya/fixtures/meta/dev-auth-fixtures` | Auth accounts separate from `FixtureDataset` |
| `@edaya/fixtures/shared/ids` | Stable school and entity ids |

## Related packages

- `@edaya/seeding` — loads `devSeedDataset` (`demoDataset`) through HTTP or in-process ports by default
- `apps/api` — consumes `@edaya/fixtures/onboarding` for onboarding routes

See `tooling/seeding/README.md` for seed commands and `src/meta/entity-manifest.ts` for entity coverage.

# @edaya/fixtures

Reference data and dev seed scenarios for Edaya backend tooling.

Orchestration (HTTP seed CLI, ports, workflows) lives in `@edaya/seeding`. This package owns **data only**.

## Layout

```text
assets/profile-pictures/     Binary profile photo pool (pic####.jpg)
data/onboarding/             Country onboarding templates (JSON source files)
test/                        Package tests (mirrors src layout)
src/
  datasets/                  The seed dataset (*Input from @edaya/core)
    demo-ci/                 Collège ivoirien (Abidjan) — the only seed dataset
  onboarding/                Structure templates (CI primaire / collège / lycée)
  meta/                      Dates, manifest, validation harness, dev login
  shared/                    Cross-scenario helpers (ids, builders, profile pictures)
```

## Typed datasets

Records use `satisfies *Input` from `@edaya/core` so schema changes fail at compile time in fixtures.

| Dataset | Import | Purpose |
|---------|--------|---------|
| `demoCiDataset` | `@edaya/fixtures` | Collège ivoirien (Abidjan). `bun repo seed` loads it in full. |
| `bootstrapSeedDataset()` | `@edaya/fixtures` | School, owner `ci-st8`, guardian `ci-g1` |
| `routeSeedDataset()` | `@edaya/fixtures` | Structure plus auth-linked guardians `ci-g1`–`ci-g6` and their students |

## Package exports

| Import | Contents |
|--------|----------|
| `@edaya/fixtures` | `demoCiDataset`, `bootstrapSeedDataset`, `routeSeedDataset`, `FixtureDataset` types, `demoCiSchoolOwnerStaffId` |
| `@edaya/fixtures/datasets/demo-ci` | `demoCiDataset` only |
| `@edaya/fixtures/onboarding` | CI structure templates, registry, country resolver |
| `@edaya/fixtures/demo-login` | Dev login account helpers |
| `@edaya/fixtures/meta/dev-auth-fixtures` | Auth accounts separate from `FixtureDataset` |
| `@edaya/fixtures/shared/ids` | Stable school and entity ids |

## Related packages

- `@edaya/seeding` — loads `demoCiDataset` through HTTP or in-process ports. Tests pass `bootstrapSeedDataset()` or `routeSeedDataset()` when they do not need every domain.
- `apps/api` — consumes `@edaya/fixtures/onboarding` for onboarding routes

See `tooling/seeding/README.md` for seed commands and `src/meta/entity-manifest.ts` for entity coverage.


## Shared authorization scenario

`createAuthorizationScenario()` from `@edaya/fixtures` returns fresh synthetic domain records and selected-profile actors for two schools. Stable `v1-*` identities include a school owner, staff with explicit student-detail grants, assigned/unassigned teachers, two siblings, an unrelated child, a foreign child, multiple guardians and a disabled guardian. The owner, assigned teacher, primary guardian and one student intentionally share an identity to test profile isolation. The second guardian links only to the first sibling.

The factory performs no persistence, identity provisioning, provider calls or permission copying. Its records are separate from the existing demo datasets and are not automatically installed by the seed CLI. Integration harnesses may arrange a disposable database; mutation seed workflows consume the records through their admitted command paths. Every call returns independent records, so revocation scenarios can remove links/assignments, disable a guardian or expire a grant without contaminating another fixture. Feature tests extend the same graph rather than changing its baseline audiences.

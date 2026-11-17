# @edaya/fixtures

Reference data and dev seed scenarios for EDaya backend tooling.

Orchestration (HTTP seed CLI, ports, workflows) lives in `@edaya/seeding`. This package owns **data only**.

## Layout

```text
assets/profile-pictures/     Binary profile photo pool (pic####.jpg)
data/onboarding/             Versioned onboarding datasets (JSON source files)
tests/                       Package tests (mirrors src layout)
src/
  datasets/                  The seed dataset (*Input from @edaya/core)
    demo-ci/                 Collège ivoirien (Abidjan) — the only seed dataset
  onboarding/                Canonical datasets and legacy template projections
  meta/                      Dates, manifest, validation harness, dev login
  shared/                    Cross-scenario helpers (ids, builders, profile pictures)
```

## Typed datasets

Records use `satisfies *Input` from `@edaya/core` so schema changes fail at compile time in fixtures.

| Dataset | Import | Purpose |
|---------|--------|---------|
| `demoCiDataset` | `@edaya/fixtures` | Collège ivoirien (Abidjan). `bun repo ops seed` loads it in full. |
| `bootstrapSeedDataset()` | `@edaya/fixtures` | School, owner `ci-st8`, guardian `ci-g1` |
| `routeSeedDataset()` | `@edaya/fixtures` | Structure plus auth-linked guardians `ci-g1`–`ci-g6` and their students |

## Package exports

| Import | Contents |
|--------|----------|
| `@edaya/fixtures` | `demoCiDataset`, `bootstrapSeedDataset`, `routeSeedDataset`, `FixtureDataset` types, `demoCiSchoolOwnerStaffId` |
| `@edaya/fixtures/datasets/demo-ci` | `demoCiDataset` only |
| `@edaya/fixtures/onboarding` | Canonical dataset types, exact-version lookup, dataset choices and legacy template registry |
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

## Versioned onboarding dataset

`data/onboarding/ivory-coast/fixture.json` owns `ci-general-secondary@1.0.0`
(schema version 1). Its catalogs define disciplines, subject categories, full grade
scales, and calendar profiles. Templates reference twelve independent level files.
Each level declares subjects with explicit discipline/category codes, coefficients,
optional status, ordered chapters, one optional report module reference, and a
grading policy. Module membership is authored only on subjects.

The numeric preset has continuous bands beginning at 0, 4, 6, 8, 10, 12, 14, 16,
and 18, ending at 20. Boundary scores belong to the next band; 20 is Excellent.
The dataset stores the nine French interpretations explicitly.

`resolveOnboardingDataset(id, version)` requires an exact supported version and
returns a fresh copy. Schema validation rejects unsupported schemas, duplicate
identities, unresolved references, invalid weights/ranges and unsafe file paths.
Add new versions explicitly to the registry; do not silently replace a published
version. File and bundled loaders must produce identical validated records.

The existing template exports are a one-way compatibility projection for older
template-list clients and fixture consumers. The current wizard uses canonical
dataset reads. Remove this adapter after its remaining consumers use canonical
datasets; provisioning never reads the projection.

Backend requests accept either `dataset: { id, version }` or a complete
`datasetSnapshot`, never both. Without either, built-in requests are pinned to
`ci-general-secondary@1.0.0`. Custom legacy `templateSnapshots` are rejected.
Obsolete wizard `disciplineMappings` are discarded; the dataset is authoritative.
The resolved dataset, including its content, participates in request replay checks.

Applying a dataset initializes its categories and disciplines transactionally
before subjects, then applies modules and exact grading-policy snapshots. Categories
reuse existing IDs/names; matching active disciplines reuse their codes. Conflicting
disciplines fail without overwriting school records. Scales are shared across selected
levels and cycles. CI now activates the nine-band numeric-first preset, passing
threshold 10, two decimals, nearest rounding, and “Moyenne générale”.

Submitted school calendars take precedence over dataset defaults. Existing periods
are scoped to the selected academic year and must match a submitted calendar.
Standalone structure application generates dataset periods only when that year has
none. It never adds trimesters to an existing semester calendar.

Generic school registration starts with no categories and subject validation never
seeds them. The demo curriculum explicitly seeds dataset categories before subjects.
Existing schools are not migrated or cleaned up automatically. Runtime persistence/rendering of exam and presentation metadata remain deferred.

The wizard reads `GET /core/onboarding/datasets?country=…` for labels and defaults,
then `GET /core/onboarding/datasets/{id}/{version}` for the resolved canonical dataset.
Omitting country lists all supported choices; an unsupported country returns an empty list.
Exact retrieval never substitutes a newer version. Structure and Review share the pinned
dataset, and provisioning submits its reference rather than a browser-authored snapshot.

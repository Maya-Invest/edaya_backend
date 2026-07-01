# @edaya/fixtures

Reference data and dev seed scenarios for Edaya backend tooling.

Orchestration (HTTP seed CLI, ports, workflows) lives in `@edaya/seeding`. This package owns **data only**.

## Layout

```text
assets/profile-pictures/     Binary profile photo pool (pic####.jpg)
data/onboarding/             Country onboarding templates (JSON source files)
src/
  onboarding/                Structure templates (CI primaire / collège / lycée)
  scenarios/
    demo-central/            Full local dev school (`sch-edaya-central`)
      core.ts                School structure, people, curriculum instances
      population.ts          Narrative student/guardian expansion
      integration-light.ts   Subset for fast integration tests
      domains/               Vertical seed slices (assessments, finance, …)
    generators/              Procedural fill (bulk students/guardians)
  meta/                      Dates, manifest, validation harness, dev login, school profiles
  shared/                    Cross-scenario helpers (profile pictures)
```

## Three layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **Templates** | `data/onboarding/`, `src/onboarding/` | Country curricula for onboarding (no school-specific IDs) |
| **Scenarios** | `src/scenarios/<name>/` | Instantiated schools with concrete IDs and narrative |
| **Generators** | `src/scenarios/generators/` | Procedural extensions (e.g. 1000-student bulk population) |

## Package exports

| Import | Contents |
|--------|----------|
| `@edaya/fixtures` | Main barrel (demo-central scenario + meta + shared) |
| `@edaya/fixtures/onboarding` | CI structure templates, registry, country resolver |
| `@edaya/fixtures/demo-login` | Dev login account helpers |
| `@edaya/fixtures/scenarios/demo-central` | Demo school core records only |

## Related packages

- `@edaya/seeding` — loads fixture data through HTTP or in-process ports
- `apps/api` — consumes `@edaya/fixtures/onboarding` for onboarding routes

See `tooling/seeding/README.md` for seed commands and `src/meta/entity-manifest.ts` for entity coverage.

# Domain modules

Each file under `domain/<context>/` follows the same layout:

1. **Zod schemas** — `fooSchema`, `fooCreateSchema`, `fooUpdateSchema`
2. **Types** — `FooData` (`z.infer`), `FooInput` (`z.input`)
3. **Entity class** — `constructor` calls `parseDomain(fooSchema, args)`; optional domain methods
4. **Config** — `fooConfig` factory for `ManagedEntityService` (tenant, auth, gates, hooks)

Exports are re-exported from `@edaya/core` via `domain/index.ts`. Value objects with behavior live in `domain/value-objects/`; shared parsing helpers (`parseDomain`, `zodDate`, etc.) live in `domain/shared/utils.ts`.

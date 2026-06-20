# Domain modules

Each file under `domains/` follows the same layout:

1. **Zod schemas** — `fooSchema`, `fooCreateSchema`, `fooUpdateSchema`
2. **Types** — `FooData` (`z.infer`), `FooInput` (`z.input`)
3. **Entity class** — `constructor` calls `parseDomain(fooSchema, args)`; optional domain methods
4. **Config** — `fooConfig` factory for `ManagedEntityService` (tenant, auth, gates, hooks)

Exports are re-exported from `@edaya/core` via `domains/index.ts`. Value objects with behavior live in `value_object/`; embed schemas (e.g. `guardianContactMethodSchema`) stay in domain files when they are not standalone resources.

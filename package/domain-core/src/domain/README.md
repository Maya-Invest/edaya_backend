# Domain modules

Each file under `domain/<context>/` follows the same layout:

1. **Zod schemas** — `fooSchema`, `fooCreateSchema`, `fooUpdateSchema`
2. **Types** — `FooData` (`z.infer`), `FooInput` (`z.input`)
3. **Entity class** — `constructor` calls `parseDomain(fooSchema, args)`; optional domain methods

Managed-entity `*Config` factories (tenant, operation gates, hooks) live in `@edaya/service` under `services/entities/config/<context>/`, not next to the entity.

Exports are re-exported from `@edaya/core` via `domain/index.ts`. Value objects with behavior live in `domain/value-objects/`; shared parsing helpers (`parseDomain`, `zodDate`, etc.) live in `domain/shared/utils.ts`.

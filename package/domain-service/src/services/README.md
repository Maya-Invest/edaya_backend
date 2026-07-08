# Application layer

Use cases that orchestrate domain entities, capabilities, and ports. No I/O implementations here — only orchestration and the managed-entity service.

## Layout

```text
application/
  runtime/              # Entity/command catalogs, core-entity-map
  entities/
    managed-entity-service.ts
    entity-config/      # Tenant, auth, and config DSL for entities
  workflows/            # Multi-entity service workflows
  commands/             # School command handlers (catalog dispatch)
  queries/              # Read models (e.g. school overview)
  account-linking/      # Link platform subjects to actors
  school-service.ts     # Per-school facade
  school-application.ts # Multi-school application shell
  base-school-service.ts
```

## Where to put new code

| Kind | Location |
|------|----------|
| New entity or command catalog entry | `runtime/` |
| Managed-entity CRUD orchestration | `entities/managed-entity-service.ts` |
| Entity tenant/auth/gate config helpers | `entities/entity-config/` |
| Multi-step business process | `workflows/<context>.ts` |
| Command handler wired to catalog | `commands/school-command-handlers.ts` |
| Aggregated read/query surface | `queries/` |
| Actor ↔ subject linking | `account-linking/` |

Workflows extend `BaseServiceWorkflow` and receive a `BaseSchoolService` for repositories, authorization, and gateways.

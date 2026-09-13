# School service layer

Use cases that orchestrate domain entities, capabilities, and ports. No I/O implementations here — only orchestration and the managed-entity service.

This package is `@edaya/service` (`package/domain-service`). The monorepo map lives in the repo README.

## Layout

```text
src/
  services/
    runtime/              # Entity/command catalogs, core-entity-map re-exports
    entities/
      managed-entity-service.ts
      config/             # Per-entity *Config factories
      entity-config/      # Tenant, auth, and config DSL
    workflows/            # Multi-entity service workflows
    commands/             # School command handlers (catalog dispatch)
    queries/              # Read models (e.g. school overview)
    account-linking/      # Link platform subjects to actors
    school-service.ts     # Per-school facade
    school-application.ts # Multi-school application shell
    base-school-service.ts
  capabilities/           # notifications, invitations, files, documents, onboarding, cron, timetable
  ports/                  # SchoolRepositories + cron platform ports
  adapters/               # Inline cron dispatcher (in-process)
```

## Where to put new code

| Kind | Location |
|------|----------|
| New entity or command catalog entry | `services/runtime/` |
| Managed-entity CRUD orchestration | `services/entities/managed-entity-service.ts` |
| Entity tenant and business validation config | `services/entities/config/<context>/` |
| Multi-step business process | `services/workflows/<context>.ts` |
| Command handler wired to catalog | `services/commands/school-command-handlers.ts` |
| Aggregated read/query surface | `services/queries/` |
| Actor ↔ subject linking | `services/account-linking/` |

Workflows extend `BaseServiceWorkflow` and receive a `BaseSchoolService` for repositories, authorization, and gateways.

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

## Teacher correction lifecycle

TeacherCorrectionsWorkflow uses typed adapters for submitted attendance, published report comments, explicitly validated logbooks and incidents after staff takeover/formal decisions. Initial attendance is a command-owned private draft; complete-roster submission makes records and family alerts official. Arrival events append within the active occurrence and preserve the original call/evidence. Logbook saves are atomic with chapter progress; reviewed reductions recompute cumulative summaries. Incident edits preserve sanctions/resolution and flag their consequences for staff review; follow-ups remain immediate. Report comment approval preserves immutable original results and report facts, requests a durable replacement, and exposes the revised comments/document to families only after rendering succeeds. Failed rendering retains the prior document and supports retry.

Requests have immutable revisions and versioned decisions; author subject identity prevents self-review across profiles. Review scopes are applied before queue counts and pagination. Generic single/batch/offline writes enforce the same lifecycle boundaries. Migration 0035 preserves existing rows: legacy attendance rows count as submitted, and existing incident status/sanctions count as staff decisions. Legacy logbooks remain editable until explicit validation. Existing mark corrections retain their history; pending requests may target independent students in one assessment.

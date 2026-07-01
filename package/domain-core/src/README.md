# `@edaya/core` source layout

Business rules and application orchestration for the school platform. Adaptors (`package/adaptor-*`) implement the ports defined here; `apps/api` wires runtime and HTTP.

## Layers

```text
src/
  domain/                 # Pure model — entities, value objects, shared kernel
    <context>/            # Bounded-context entity modules
    value-objects/
    shared/               # parseDomain, DomainValidationError, business-rule-error

  application/            # Use cases — orchestrates domain + ports
    runtime/              # Entity/command catalogs, core-entity-map
    entities/             # Managed-entity service + entity-config DSL
    workflows/            # Multi-entity service workflows
    commands/             # School command handlers
    queries/              # Read models
    account-linking/
    school-service.ts     # Per-school facade
    school-application.ts

  capabilities/           # Cross-cutting subsystems (not CRUD entities)
    authorization/
    notifications/        # delivery/, templates/, triggers/, handlers/
    invitations/          # Invitation process (entity stays in domain/access)
    scheduling-jobs/      # Background scans (was cron/)
    files/                # Upload policy, key layout (was storage/)
    email/                # Email helpers (was auth/)

  ports/                  # Outbound interfaces only
    repositories/
    gateways/
    platform/

  adapters/               # In-core test/dev doubles (no-op, in-memory, recording)
```

## Dependency rules

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `domain/` | `domain/value-objects`, `domain/shared` | `application`, `ports`, `capabilities`, `adapters` |
| `application/` | `domain`, `capabilities`, `ports` | adaptors, `apps/` |
| `capabilities/` | `domain`, `ports`, `application` (facades only) | adaptors, `apps/` |
| `ports/` | `domain` | `application`, `capabilities`, adaptors, `apps/` |
| `adapters/` | `ports`, `domain` | `application`, `capabilities` |

**New code:** pick the innermost layer that can own it. Do not add new top-level folders without updating this file.

## Where to put new code

| Kind | Location |
|------|----------|
| Entity schema, class, `*Config` factory | `domain/<context>/<entity>.ts` |
| Value object with behavior | `domain/value-objects/` |
| Entity/command catalog entry | `application/runtime/` |
| Managed-entity auth/tenant helpers | `application/entities/entity-config/` |
| Multi-entity workflow | `application/workflows/` |
| Repository interface | `ports/repositories/` |
| Gateway interface (email, files, notifications) | `ports/gateways/` |
| No-op / in-memory / recording test double | `adapters/` |
| Invitation send/accept process | `capabilities/invitations/` |
| Notification delivery, templates, triggers | `capabilities/notifications/` |
| Scheduled background scans | `capabilities/scheduling-jobs/jobs/` |
| File upload policy / storage keys | `capabilities/files/` |

See `domain/README.md`, `application/README.md`, and `capabilities/authorization/README.md` for layer-specific patterns.

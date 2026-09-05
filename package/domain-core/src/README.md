# `@edaya/core` source layout

School-domain types, Zod schemas, repository/gateway ports, and the entity registry. Orchestration lives in `@edaya/service`; authorization policy lives in `@edaya/authorization`. Adaptors implement the ports defined here; `apps/api` wires runtime and HTTP.

The monorepo map lives in the repo [README.md](../../../../README.md) and [integrations-restructure.md](../../../../docs/reference/integrations-restructure.md).

## Layers

```text
src/
  domain/                 # Pure model — entities, value objects, shared kernel
    <context>/            # Bounded-context entity modules
    permissions/          # Permission enum + staff grant scope grammar
    value-objects/
    shared/               # parseDomain, DomainValidationError, business-rule-error

  registry/               # CoreEntityMap, CORE_ENTITY_KEYS

  entity-access/          # Read/write authorization type hooks used by configs

  ports/                  # Outbound interfaces only
    repositories/
    gateways/
    platform/

  adapters/               # In-core test/dev doubles (no-op, in-memory, recording)

  shared/                 # Small cross-cutting helpers
```

## Dependency rules

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `domain/` | `domain/value-objects`, `domain/shared` | `ports`, `adapters`, `@edaya/authorization`, `@edaya/service` |
| `ports/` | `domain` | `adapters`, authorization, service, apps |
| `adapters/` | `ports`, `domain` | authorization, service, apps |
| `registry/` | `domain` | authorization, service |

Production `src/` must not import `@edaya/authorization` or `@edaya/service`.

**New code:** pick the innermost layer that can own it. Do not add new top-level folders without updating this file.

## Where to put new code

| Kind | Location |
|------|----------|
| Entity schema, class, domain methods | `domain/<context>/<entity>.ts` |
| `*Config` factory (tenant, auth, gates) | `@edaya/service` (`services/entities/config/`) |
| Value object with behavior | `domain/value-objects/` |
| Entity registry key | `registry/core-entity-map.ts` |
| Repository interface | `ports/repositories/` |
| Gateway interface (email, files, notifications) | `ports/gateways/` |
| No-op / in-memory / recording test double | `adapters/` |
| Workflows, notifications, cron | `@edaya/service` |
| Grants, policy, operations | `@edaya/authorization` |

See [domain/README.md](./domain/README.md) for entity-file layout.

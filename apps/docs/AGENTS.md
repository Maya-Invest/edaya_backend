# Agent guidance

Document rendering lives in this monorepo as `apps/docs` plus `package/document-*` / `package/docs-client`. It stays a **separate HTTP process** (JWT service token); it does not share the school Worker or school DB.

## Required reading

1. [Document rendering service RFC](../../docs/architecture/document-rendering-service.md)
2. Contract packet: [contracts/packets/document-rendering.v1.json](../../contracts/packets/document-rendering.v1.json)

## Architectural constraints

- Prefer **Podman** over Docker for local Gotenberg: `bun run gotenberg:up`.
- Do not store school business data or connect to the school PostgreSQL database.
- Do not perform authorization against school permissions; validate service tokens only.
- Do not fetch report-card, student, or financial records from the school API during render.
- Callers supply fully prepared payloads; templates validate shape, not business rules.
- Keep the HTTP API stateless; optional async jobs may use an ephemeral queue, not tenant tables.
- Do not import `@edaya/core`, `@edaya/service`, `@edaya/authorization`, or school adaptor packages.
- Prefer inline artifact delivery until storage integration is required; Worker-first prod should prefer R2 delivery over large base64 responses.
- Template keys are versioned (`report-card.v1`); breaking layout changes require a new key.
- PDF engines are adapters behind `PdfRenderer`: **Browser Run for Worker prod**, Gotenberg for local/Swarm escape hatch, stub when neither is configured.
- Object storage is an adapter behind `ObjectStorage` (R2 via S3 SDK). Use school-prefixed keys; do not import school `ObjectStorageGateway`.
- Template assets must be bundler-friendly (static imports); do not use `readFileSync` for templates on the Worker path.
- Handlebars templates must be **precompiled** (`bun --filter @edaya/document-rendering run precompile`).
- Observability: log `templateKey`, `format`, `schoolId`, `renderId`, byte size — never payloads, tokens, or artifact bytes.

## Layout

| Path | Role |
|------|------|
| `apps/docs` | HTTP composition root (`@edaya/docs-api`) |
| `package/document-rendering` | Render orchestration, template registry, ports |
| `package/document-contracts` | Shared request/response types and stable errors |
| `package/docs-client` | `@maya-invest/edaya-docs-client` OpenAPI client |
| `contracts/packets` | Machine-readable contract metadata |
| `tests/docs/contract` | Contract conformance tests |
| `tests/docs/integration` | Gated live-engine tests (Gotenberg); not part of default unit `turbo test` |
| `tooling/docs` | OpenAPI export/generate, contract check, Gotenberg compose |

## Local commands

```sh
bun run docs:dev                 # http://localhost:3090 (or DOCS_PORT)
bun run gotenberg:up             # PDF engine on :3000
bun run test:docs:contract
GOTENBERG_URL=http://localhost:3000 bun run test:docs:integration
bun run docs:openapi:export && bun run docs:openapi:generate
```

School API talks to docs over HTTP (`EDAYA_DOCS_URL` + `DOCS_JWT_SECRET`). Root `bun run dev` / `bun repo dev` starts API, local-files, and docs together.

# Repo tooling layout (`@edaya/repo`)

`tooling/repo` groups repo automation by purpose: **openapi** (codegen), **ci** (non-mutating gates), **dev** (local tools), **lib** (pure helpers), and **tests** (unit tests). Smoke tests live in `@edaya/integration-tests`.

## Layout

```text
tooling/repo/
├── REORGANIZATION.md
├── lib/
│   ├── boundaries.ts
│   └── drift.ts
├── tests/
│   ├── boundaries.test.ts
│   ├── drift.test.ts
│   └── openapi-bindings.test.ts
├── openapi/
│   ├── paths.ts
│   ├── export.ts
│   ├── generate-schema.ts
│   ├── generate-bindings.ts
│   ├── check-drift.ts
│   └── update.ts
├── ci/
│   ├── check-boundaries.ts
│   └── doctor.ts
└── dev/
    ├── db-browser.ts
    ├── r2-check-credentials.ts
    └── r2-configure-cors.ts

tooling/integration-tests/smoke/novu-e2e.ts

package/generated-api-client/src/openapi-bindings.ts
```

## `package.json` command map

| Command | Entrypoint |
|---------|------------|
| `export-openapi` | `tooling/repo/openapi/export.ts` |
| `openapi:generate` / `generated:update` | `tooling/repo/openapi/update.ts` |
| `generated:check` / `openapi:check` | `tooling/repo/openapi/check-drift.ts` |
| `check:boundaries` | `tooling/repo/ci/check-boundaries.ts` |
| `doctor` | `tooling/repo/ci/doctor.ts` |
| `test:r2` | `tooling/repo/dev/r2-check-credentials.ts` |
| `configure:r2-cors` | `tooling/repo/dev/r2-configure-cors.ts` |
| `db:browser:school` / `db:browser:auth` | `tooling/repo/dev/db-browser.ts` |
| `novu:smoke` | `tooling/integration-tests/smoke/novu-e2e.ts` |
| `test:repo` | `bun --filter @edaya/repo test` |

`apps/webapp` still exposes `openapi:generate` for webapp-only iteration; the repo-wide pipeline uses `tooling/repo/openapi/generate-schema.ts`.

## Conventions

- **`lib/`** — pure functions only; no CLI, no `bun:test` imports.
- **`tests/`** — all repo-tool unit tests.
- **`openapi/`** — mutates tracked artifacts; run via `generated:update`.
- **`ci/`** — read-only checks used in `verify`.
- **`dev/`** — manual local tools.
- **Shared contracts** — `@edaya/api-client/openapi-bindings`.

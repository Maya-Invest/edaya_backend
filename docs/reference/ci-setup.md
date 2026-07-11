# CI setup

> **Audience:** humans — GitHub Actions workflows and reusable setup  
> **Not normative for agents**

`edaya_backend` CI uses a composite action for Bun install, dependency caching, and Turbo remote cache. Other Edaya repos (e.g. `edaya_web`) can copy the same action when aligning setup.

## Composite action: `ci-bun-turbo`

Path: [`.github/actions/ci-bun-turbo`](../../.github/actions/ci-bun-turbo/action.yml)

| Step | What it does |
|------|----------------|
| Setup Bun | `oven-sh/setup-bun@v2` — version from root `packageManager` (`bun@1.3.14`) |
| Cache Bun deps | `actions/cache@v4` on `~/.bun/install/cache`, keyed by `bun.lock` |
| Install | `bun install` |
| Turbo cache | `rharkor/caching-for-turbo@v2.5.0` — restores/saves `.turbo` via GitHub Actions cache |

### Inputs

| Input | Default | Purpose |
|-------|---------|---------|
| `bun-version` | `1.3.14` | Bun runtime (match `packageManager` in root `package.json`) |
| `cache-prefix` | `edaya-backend-turbo-` | Isolate Turbo cache keys per repo |

### Usage in a workflow

```yaml
- name: Setup Bun and Turbo cache
  uses: ./.github/actions/ci-bun-turbo
```

With a custom Turbo cache prefix (e.g. when copying into `edaya_web`):

```yaml
- name: Setup Bun and Turbo cache
  uses: ./.github/actions/ci-bun-turbo
  with:
    cache-prefix: edaya-web-turbo-
```

## Workflows that use it

| Workflow | Job | Notes |
|----------|-----|-------|
| [`_verify.yml`](../../.github/workflows/_verify.yml) | `verify` | Runs `bun run verify` |
| [`_coverage.yml`](../../.github/workflows/_coverage.yml) | `coverage` | Informational; `continue-on-error: true` |

Other jobs use inline `setup-bun` + `bun install` when they need extra steps (Docker login, GHCR, migrations) and do not benefit from Turbo cache alone.

## Verify entry point

The verify job always runs:

```sh
bun run verify
```

Which expands to:

```sh
bun repo verify && turbo run quality && turbo run build && turbo run test -- --dots
```

Repo hygiene (doctor, OpenAPI drift, boundaries, test naming) runs **first** and fails fast before the Turbo graph. See [repo-cli.md](./repo-cli.md).

Integration tests (`bun run test:integration`) are a **separate** PR job after verify — not part of `bun run verify`. Locally, run both blocking PR jobs with:

```sh
bun repo verify --full
```

After the first successful publish of `edaya-api-dev`, grant consumer repos read access to the GHCR package (one-time, org admin):

1. [edaya-api-dev package settings](https://github.com/orgs/Maya-Invest/packages/container/edaya-api-dev/settings)
2. **Manage Actions access** → add `edaya_web` and `edaya_mobile` with **Read**

Or set the package to **Public** so CI can pull without cross-repo token setup.

## Adopting in another repo

1. Copy `.github/actions/ci-bun-turbo/` into the target repo.
2. Set `cache-prefix` to a repo-specific value.
3. Replace inline `setup-bun` + `bun install` in `_verify.yml` with the composite action.
4. Keep `bun run verify` as the only verify-step command (no workflow-specific check logic).


## API client npm publish (`@edaya/api-client`)

[`_publish-api-client.yml`](../../.github/workflows/_publish-api-client.yml) runs on merge to `staging` / `main` when API-related paths change (same gate as `edaya-api-dev`). It exports OpenAPI in-process from the merged backend — no Docker — then regenerates and publishes the client from [edaya-client-codegen](https://github.com/Maya-Invest/edaya-client-codegen).

### One-time secrets (`edaya_backend` repo settings)

| Secret | Purpose |
|--------|---------|
| `CODEGEN_REPO_TOKEN` | PAT or fine-grained token with `contents: write` on `Maya-Invest/edaya-client-codegen` (cross-repo commit + push) |
| `NPM_TOKEN` | npm automation token with publish access to `@edaya/api-client` (public) |

### Branch alignment

`edaya-client-codegen` must have `staging` and `main` branches aligned with `edaya_backend` — the workflow checks out `ref: ${{ github.ref_name }}` in both repos.

### Consumer install

```sh
npm install @edaya/api-client@staging    # from staging channel
npm install @edaya/api-client@production # from main channel
```

Local development without npm:

```json
"@edaya/api-client": "file:../edaya-client-codegen/clients/school-api"
```

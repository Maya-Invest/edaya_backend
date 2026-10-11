# Repository commands


## Backend commands

```sh
bun install --frozen-lockfile
bun run repo check
bun run repo test tooling
bun run repo ci verify
bun run repo test integration
bun run repo build staging
bun run repo ci qualify staging
```

`ci qualify` runs verification, service/HTTP, seed and native PostgreSQL integrations, then schema compatibility and the environment-specific dry-run Worker build. PostgreSQL commands (`pg_config`, `initdb`, `pg_ctl`) must be available; CI setup exports their binary directory. No consumer checkout is needed.

Compatibility uses checksum-pinned oasdiff 1.11.7. PRs compare to the target-branch SHA; releases compare to the API definition in the last successful deployment commit for that environment. With no successful history, `tooling/repo/fixtures/compatibility/bootstrap.json` is the initial existing-contract snapshot to review. Behavioral API/authentication regression suites remain mandatory independently of schema generation. Successfully generating a new client is not a compatibility test for installed clients.

## Cloudflare and migrations

Configure environment secrets `CLOUDFLARE_API_TOKEN`, `STAGING_DATABASE_URL`, `STAGING_AUTH_DATABASE_URL`, `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL` as applicable, and environment variable `CLOUDFLARE_ACCOUNT_ID`. The deployment job explicitly migrates identity and school databases before deploying the verified Worker bundle. Normal deployment never resets or seeds.

For an emergency use `bun run repo maintenance emergency-deploy staging --dry-run`, then an explicit `--yes` to apply. It creates build evidence and uploads that build without implicit migrations/reset. This is an emergency bypass of ordinary qualification and is marked in its evidence.

## Separate staging maintenance

The **Staging maintenance** workflow shares the staging deployment concurrency group. Its default is a read-only dry run. Applying reset/reseed or recovery requires typing `STAGING MAINTENANCE` and turning dry run off. It requires dedicated staging DB roles, direct TLS connections, and deployed Hyperdrive bindings matching the configured targets.

Configure non-secret environment variables `STAGING_DATABASE_HOST`, `STAGING_SCHOOL_DATABASE`, `STAGING_IDENTITY_DATABASE`, `STAGING_IDENTITY_ROLE`, plus the staging database/Cloudflare credentials. Seed authentication uses the existing seed configuration. Queue edit and Worker settings permissions are required for maintenance only.

Reset/reseed pauses API, scheduler, jobs and queue delivery, drains work, checks HTTP maintenance state, resets the two staging databases while preserving signing keys, seeds, then restores owned controls. Failure retains the pause. Inspect sanitized maintenance evidence and `bun run repo maintenance status staging` before requesting the explicit recovery operation. Recovery resumes paused controls; it does not retry reset or seed. Settings operations performed outside Actions must also be serialized by the operator.

<!-- repo-commands:start -->

```text
Usage: bun run repo <command>

check         Repository hygiene, workflow lint, generated contract checks and type checks.
test          unit | integration | tooling
build         staging | production (build immutable release artifacts without deployment)
generate      openapi | openapi-export | codegen | templates | commands
dev           Start local API and file services.
maintenance   db | seed | vars | secrets | pause | resume | status | smoke | reset-staging | emergency-deploy
ci            verify | qualify | fixture | migrate | deploy | resolve | workflows
```

<!-- repo-commands:end -->

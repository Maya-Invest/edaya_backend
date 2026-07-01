# Novu subscriber cleanup

Delete stale Novu subscribers created during local dev, smoke tests, or invitation flows.

## Commands

```sh
# Preview matches (safe)
bun novu:cleanup -- --transient-invites
bun novu:cleanup -- --prefix smoke-

# Delete (requires confirmation, or --yes in CI)
bun novu:cleanup:apply -- --transient-invites --yes
bun novu:cleanup:apply -- --ids auth-g1,invite:inv-123 --yes

# Wipe every subscriber in the environment (dev only)
bun novu:cleanup:apply -- --all --yes
```

## Selectors

| Flag | Deletes |
|------|---------|
| `--transient-invites` | `invite:*` subscribers from pre-account invitations |
| `--prefix <value>` | Subscriber ids starting with `value` |
| `--ids <id1,id2>` | Explicit subscriber ids |
| `--all` | Every active subscriber (`--yes` required on apply) |

Use `--limit <n>` to cap how many deletions run in one apply.

## Environment

Reads `NOVU_SECRET_KEY` and optional `NOVU_API_URL` from `process.env` or `apps/api/.env` (same as bootstrap).

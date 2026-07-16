# @edaya/novu-ops

Novu operational CLI for EDAYA: workflow bootstrap and subscriber cleanup.

Runtime notification delivery lives in `@edaya/adaptor-novu` (`package/adaptor-novu`).

## Bootstrap workflows

Create or update Novu workflows from the declarative catalog in `bootstrap/catalog/`.

```sh
bun run bootstrap              # plan (dry run)
bun run bootstrap:apply        # push to Novu
bun run bootstrap:validate     # validate catalog only
```

From the monorepo root: `bun repo novu bootstrap`, `bun repo novu bootstrap apply`, `bun repo novu bootstrap validate`.

See [bootstrap/README.md](./bootstrap/README.md).

## Subscriber cleanup

```sh
bun run cleanup -- --transient-invites
bun run cleanup:apply -- --transient-invites --yes
```

From the monorepo root: `bun repo novu cleanup`, `bun repo novu cleanup apply`.

See [cleanup/README.md](./cleanup/README.md).

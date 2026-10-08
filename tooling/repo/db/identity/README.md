# Identity database commands

Apply Account and provider migrations, or perform guarded identity cleanup. Schemas and SQL stay in `@edaya/adaptor-account` and `@edaya/adaptor-auth`; these commands belong to `@edaya/repo`.

Run from the backend root:

```sh
bun repo db migrate identity local                 # AUTH_DATABASE_URL, or STAGING_/PRODUCTION_ variants
bun repo db wipe identity local --yes        # delete .data/identity after stopping identity
bun repo db wipe identity staging --yes      # guarded staging identity cleanup
```

Local identity startup already migrates PGlite. School commands remain under `bun repo db`; select the identity database for these commands.

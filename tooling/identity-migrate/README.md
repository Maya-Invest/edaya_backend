# @edaya/identity-migrate

Apply and wipe Central Identity auth migrations. Schema source: `@edaya/adaptor-auth`.

## Commands (identity repo root)

```sh
bun repo db migrate                 # AUTH_DATABASE_URL, or STAGING_/PRODUCTION_ variants
bun repo db wipe local --yes        # delete .data/identity (stop bun repo dev first)
bun repo db wipe staging --yes      # staging Neon; needs STAGING_AUTH_DATABASE_URL
```

Local `bun repo dev` already migrates PGlite on startup. Use this CLI for Postgres / Worker / Neon.

Do not run these scripts against the school database (`edaya_backend`).

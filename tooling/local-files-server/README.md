# @edaya/local-files-server

Local HTTP service for profile photos and other uploads. Started automatically by `bun repo dev` (port **9200**).

Run alone (API must still be configured with `LOCAL_FILES_*`):

```sh
bun --filter @edaya/local-files-server dev
```

Storage implementation: `@edaya/adaptor-local-fs`. Do not use this process on Worker / staging — those use R2.

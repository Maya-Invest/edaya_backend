# @edaya/adaptor-r2

Cloudflare R2 `FileStoragePort` adapter for Worker / staging / production.

Local dev uses `@edaya/adaptor-local-fs` + `@edaya/local-files-server` instead.

```sh
bun --filter @edaya/adaptor-r2 test
bun --filter @edaya/adaptor-r2 test:integration   # live R2; needs credentials
```

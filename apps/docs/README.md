# @edaya/docs-api

Document rendering HTTP service (local Bun host + Cloudflare Worker).

See [AGENTS.md](./AGENTS.md) and [document-rendering-service.md](../../docs/architecture/document-rendering-service.md).

```sh
# from edaya_backend root
cp apps/docs/.env.example apps/docs/.env
bun run docs:dev
bun run gotenberg:up   # optional real PDFs
```

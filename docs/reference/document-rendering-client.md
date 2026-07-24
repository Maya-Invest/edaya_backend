# Document rendering client

`@maya-invest/edaya-docs-client` lives in `package/docs-client` in this monorepo (workspace dependency of `@edaya/api`).

## Regenerate after docs OpenAPI changes

```sh
bun run docs:openapi:export
bun run docs:openapi:generate
bun run docs:openapi:check
```

School API uses `EDAYA_DOCS_URL` + `DOCS_JWT_SECRET` (or `DOCS_DEV_TOKEN`) to call `apps/docs`. See [document-rendering-service.md](../architecture/document-rendering-service.md).

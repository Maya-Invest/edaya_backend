# Maya School Core

Monorepo for the Maya school platform: Hono API (`apps/api`), SvelteKit webapp (`apps/webapp`), and shared packages (`packages/*`).

## Local development

```sh
bun install
cp apps/api/.env.example apps/api/.env
cp apps/webapp/.env.example apps/webapp/.env
bun dev
```

- Webapp: http://localhost:5173
- API: http://localhost:9999
- API docs: http://localhost:9999/reference

See [docs/local-dev.md](./docs/local-dev.md) for details (database options, dev seed, troubleshooting, how the webapp connects to the API).

# Edaya Webapp

SvelteKit staff UI for Edaya Core.

## Local development

```sh
cp .env.example .env   # from apps/webapp
bun dev                # http://localhost:5173
```

Requires the API running at `API_URL` (default `http://localhost:9999`). From the repo root, `bun dev` starts both apps.

See [docs/local-dev.md](../../docs/local-dev.md) for the full setup and how server-side API calls work.

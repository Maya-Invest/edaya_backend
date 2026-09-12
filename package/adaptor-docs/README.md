# @edaya/adaptor-docs

In-process document / PDF rendering for school reports (`DocumentRendererPort`).

Local default is a stub PDF unless `GOTENBERG_URL` is set. Workers can use the Cloudflare Browser binding.

```sh
bun --filter @edaya/adaptor-docs test
```

Templates are precompiled via `bun run precompile` (also run by `check` / `test`).

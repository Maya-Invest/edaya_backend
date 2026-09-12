# @edaya/integration-tests

Cross-package school API tests (PGlite, auth JWT, HTTP routes, optional seed). Not started as a server.

From **edaya_backend** root:

```sh
bun run test:integration            # api + http slices
bun run test:integration:seed       # slow seed slice
bun run test:integration:native     # native auth slice
```

Unit tests stay in each package (`bun run test`). Staging HTTP smoke is `bun repo smoke-test staging`.

# @edaya/client-codegen

OpenAPI → `@maya-invest/edaya-api-client` generator (`edaya-codegen`).

From **edaya_backend** root:

```sh
bun repo openapi export
bun repo openapi generate
bun repo openapi check
```

Do not run this from `edaya_web`. The web apps consume the generated package only.

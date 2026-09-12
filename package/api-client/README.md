# @maya-invest/edaya-api-client

Typed school API SDK generated in this repo. Web and mobile import it; they do not copy OpenAPI JSON.

```ts
import { createSchoolClient, ApiError } from '@maya-invest/edaya-api-client'
import type { components } from '@maya-invest/edaya-api-client/schema'
```

## Regenerate (edaya_backend root)

```sh
bun repo openapi export
bun repo openapi generate
```

Local web checkout uses a `file:` link (`edaya_web` → `../edaya_backend/package/api-client`). CI/deploy install the GitHub Packages build.

Do not hand-edit `src/generated/`.

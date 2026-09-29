# @maya-invest/edaya-identity-client

School-side package for Central Identity. Browsers and mobile apps do **not** use this; they call the stable `/auth/edaya/*` contract directly.

| Surface | Implementation |
|---------|----------------|
| `verifyIdentityToken(jwt)` | Handwritten `jose` verify (`iss`, `aud` = this API's origin, `exp`, `sub`, Account ID `sub`, `auth_time`, `amr`, optional `mfa_time`, maximum 5-minute lifetime) |
| Directory HTTP | Generated from identity OpenAPI |
| JWKS path | `/.well-known/jwks.json` |

```ts
import { createIdentityClient } from '@maya-invest/edaya-identity-client'
import { createTestIdentityKeys, signTestIdentityToken } from '@maya-invest/edaya-identity-client/testing'

const identity = createIdentityClient({
  issuer: 'http://localhost:9900',
  audience: 'http://localhost:9999',
  jwksUrl: 'http://localhost:9900/.well-known/jwks.json',
  directoryBaseUrl: 'http://localhost:9900',
  directorySecret: 'local-directory-secret',
})

await identity.verifyAccessToken(jwt)
await identity.directory.lookupByContact('email', 'a.kone@ecole-ci.edaya.dev')
```

Backend packages use `"@maya-invest/edaya-identity-client": "workspace:*"`. Contact claims are optional; authorization and invitation matching use the Account directory and its verified identifier list.

The identity service and this package are maintained in this backend repository. Provider SDKs and provider sessions are private implementation details.

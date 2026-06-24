# @edaya/adaptor-novu

Novu Cloud adapter for `NotificationGatewayPort` from `@edaya/core`.

## Usage

```typescript
import { createNovuNotificationGateway, createNovuSdkClient } from "@edaya/adaptor-novu";

const gateway = createNovuNotificationGateway({
  client: createNovuSdkClient({
    secretKey: process.env.NOVU_SECRET_KEY!,
    serverURL: process.env.NOVU_API_URL, // optional, e.g. https://eu.api.novu.co
  }),
  onError: (error, context) => logger.error({ err: error, ...context }, "novu notification failed"),
});
```

## Conventions

| Core field | Novu mapping |
|------------|--------------|
| `eventKey` | `workflowId` (override with `resolveWorkflowId`) |
| `idempotencyKey` | `transactionId` (dedup + cancel) |
| `schoolId` | `context.tenant` (Novu v2; auto-created if missing) |
| `recipients[]` | `to` subscriber ids: `{schoolId}:{kind}:{id}` |
| `title`, `body`, `metadata`, … | `payload` |

Create Novu workflows whose trigger identifiers match core `eventKey` values (e.g. `report_card.published`, `assessment.due_soon`).

The gateway never throws on Novu API failures — errors are passed to optional `onError` so business commands are not rolled back.

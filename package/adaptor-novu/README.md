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
| `upsertRecipient` channel prefs | `subscribers.preferences.update` (global) + `bulkUpdate` (per workflow) with `context.tenant` |

Create Novu workflows whose trigger identifiers match core `eventKey` values (e.g. `report_card.published`, `assessment.due_soon`).

**Bootstrap as code:** use `bun novu:bootstrap:apply` to create/update workflows from `bootstrap/catalog/`. See [bootstrap/README.md](./bootstrap/README.md).

The gateway never throws on Novu API failures — errors are passed to optional `onError` so business commands are not rolled back.

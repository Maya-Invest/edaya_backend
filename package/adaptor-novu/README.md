# @edaya/adaptor-novu

Novu Cloud adapter for `NotificationGatewayPort` from `@edaya/core`.

Operational CLI (workflow bootstrap, subscriber cleanup) lives in `@edaya/novu-ops` (`tooling/novu-ops`).

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

**Bootstrap as code:** use `bun repo novu bootstrap apply` to create/update workflows. See [tooling/novu-ops/bootstrap/README.md](../../tooling/novu-ops/bootstrap/README.md).

The gateway never throws on Novu API failures — errors are passed to optional `onError` so business commands are not rolled back.

**Subscriber cleanup:** use `bun repo novu cleanup -- --transient-invites` to preview deletions, or `bun repo novu cleanup apply -- --transient-invites --yes` to apply. See [tooling/novu-ops/cleanup/README.md](../../tooling/novu-ops/cleanup/README.md).

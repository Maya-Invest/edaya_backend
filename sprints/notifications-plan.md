# Notifications Feature — Sprint Plan

> **Status:** Phases 1–5 complete — **Phase 6 in progress** (G6 remains)  
> **Created:** 2026-06-22  
> **Last updated:** 2026-06-23  
> **Scope:** Notification gateway port, trigger infrastructure (entity hooks + workflow hooks), provider-centric delivery (Phase 6), and webapp UX  
> **Related domain:** `package/domain-core/src/domains/messaging/` (`Announcement`, `AnnouncementTarget`, `MessageDelivery`)

This plan introduced a **notification gateway** as a core port, wired **event-based triggers** through `ManagedEntityService` hooks and **workflow post-actions**, and reserved **job-based scheduling** and **provider delivery** for follow-on work.

Phases **1–5** are implemented and tested in `@edaya/core`. Phase **6** is largely complete: Novu outbound dispatch, slim `MessageDelivery`, webhook ingress, poll-based status reconcile, inbox UI, notification settings, and Novu preferences API sync are wired. **Remaining:** `premiumNotificationsEnabled` enforcement (G6) and ops (Novu workflows per `eventKey`).

---

## 1. Notification kinds

| Kind | Trigger | Examples | Integration status |
|------|---------|----------|-------------------|
| **Ad-hoc** | Staff publishes communication to a defined audience | School-wide notice, class message | **Live** — materialize per `subjectId` + Novu enqueue when `NOVU_SECRET_KEY` set |
| **Event-based** | Domain state change after a command or save | Attendance, report card, assessment result, incident | **Live** — all matrix event rows wired except premium gating (G6) |
| **Job-based** | Time / schedule (cron or deferred queue) | Assessment due in 3 days | **Live** — cron scanners in `apps/cron` (`processDueNotifications` daily) |

### Relationship to existing messaging domain

- `Announcement` + `AnnouncementTarget` define **what** is sent and **who** is in scope.
- `MessageDelivery` is the **per-recipient delivery record** in the school DB (status, read state, provider correlation). **`channel` removed from schema** — the notifier (Novu, Courier, internal) chooses email / push / SMS; school data stores outcome only.
- **Event** and **job** notifications enqueue through `NotificationGatewayPort`; they may optionally materialize `MessageDelivery` rows when an in-app inbox row is required (see G4).
- Guardian/staff **eligibility** flags remain in school domain (`receivesAttendanceAlerts`, `receivesAcademicReports`, `allowsNotifications`). **Channel preferences** are synced to the notifier via `NotificationGatewayPort.upsertRecipient` (Phase 6d).

---

## 2. Outcomes

### Phase 1–4 outcomes (achieved)

| # | Outcome | Status |
|---|---------|--------|
| 1 | `NotificationGatewayPort` in `@edaya/core` | Done |
| 2 | Gateway wired through `ServiceArgs` → `BaseSchoolService` | Done |
| 3 | Entity trigger registry + `postSave` hook infrastructure | Done |
| 4 | Workflow notification runner + registered handlers | Done |
| 5 | Ad-hoc `publishAnnouncement` enqueues after materialize | Done |
| 6 | Event verticals: report card + attendance (batch) | Done |
| 7 | Job intent: assessment `due_soon` via entity hook | Done (enqueue only) |

### Success metrics (verified 2026-06-22)

| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| Notification port in core | None | Exported from `ports/` | `notification-gateway.ts` exported |
| Gateway in `ServiceArgs` | N/A | All `SchoolService` instances | Wired; tests + API runtime updated |
| `publishAnnouncement` | Save only | Gateway after materialize | App-channel materialize + enqueue |
| Event trigger coverage | None | ≥1 workflow + registry tests | 3 workflow handlers + 1 entity trigger; 18 notification tests |
| Core tests | — | Green | **479 passed**, 0 failed (`package/domain-core`) |
| Full `bun run verify` | Green | Green | Fails on **unrelated** `@edaya/integration-tests` lint (pre-existing); core check + tests pass |

---

## 3. Guardrails and non-goals

Hard constraints observed in Phases 1–4:

- No real email/SMS/WhatsApp in core or unit tests.
- Gateway `enqueue` is non-blocking; no external I/O in `postSave` hooks.
- No HTTP/GraphQL payload changes **until Phase 6** (webhook route + inbox APIs excepted).
- Ports-and-adapters layout preserved.
- Authorization runs before notification triggers.

### Non-goals (still deferred)

- Webapp notification center UI
- Push notification device tokens
- Provider templates (SendGrid, Twilio, etc.)
- Replacing `CommunicationsServiceWorkflow` audience resolution
- Full event catalog document (`docs/notifications-triggers.md`) — Phase 0 was absorbed into implementation

---

## 4. Architecture (as built)

### 4.1 Module layout

```text
package/domain-core/src/
  ports/notification-gateway.ts          # Port interface (+ optional lookupDeliveryStatuses)
  notifications/
    ...
  cron/jobs/reconcile-pending-deliveries.ts

package/adaptor-novu/
  novu-notification-gateway.ts           # enqueue, cancel, subscriber stubs, status lookup
  delivery-webhook.ts                  # Svix verify + normalize inbound events
  delivery-status.ts                   # Novu Messages API → status mapping
  novu-messages-client.ts

apps/api/src/
  routes/novu-webhook.routes.ts        # POST /webhooks/novu
  runtime/shared/resolve-notification-gateway.ts

apps/api/src/runtime/shared/
  notification-gateway.ts                # Pino logging adapter
  message-delivery-notification-gateway.ts  # Log fallback when NOVU_SECRET_KEY unset
  school-application.ts                  # Gateway DI

scripts/novu-e2e-smoke.ts              # Local publish + optional webhook simulation
```

### 4.2 Notification gateway port

Single provider-facing port for **send** and **subscriber sync** (same adapter in practice — Novu, Courier, internal).

```typescript
export interface NotificationRecipientProfile {
  schoolId: string
  recipient: NotificationRecipient
  displayName?: string
  email?: string
  phone?: string
  locale?: string
  preferences: {
    receivesAttendanceAlerts?: boolean
    receivesAcademicReports?: boolean
    allowsNotifications?: boolean
    premiumNotificationsEnabled?: boolean
    channels?: Partial<Record<'email' | 'sms' | 'push' | 'in_app', boolean>>
  }
}

export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
  upsertRecipient: (profile: NotificationRecipientProfile) => Promise<void>
  removeRecipient: (schoolId: string, recipient: NotificationRecipient) => Promise<void>
  /** Optional — poll provider message status (reconcilePendingDeliveries cron) */
  lookupDeliveryStatuses?: (
    deliveries: ReadonlyArray<{ deliveryId: string; subjectId: string }>,
  ) => Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>>
}
```

`NotificationEnqueueInput` supports `kind: 'ad_hoc' | 'event' | 'job'`, optional `announcementId`, `deliverAfter`, `priority`, `premium`, and `metadata`. **Phase 6 removes `channels` from routing** — see § Phase 6.

### 4.3 Adapters

| Adapter | Location | Role |
|---------|----------|------|
| `noOpNotificationGateway` | `@edaya/core` | Tests; enqueue/cancel/sync no-op |
| `RecordingNotificationGateway` | `@edaya/core` | Test assertions; records enqueue, sync, status lookups |
| `createLoggingNotificationGateway` | `apps/api`, `apps/cron` | Pino log (fallback when `NOVU_SECRET_KEY` unset) |
| `createMessageDeliveryNotificationGateway` | `apps/api` | Wraps logging adapter when Novu not configured |
| `createNovuNotificationGateway` | `@edaya/adaptor-novu` | Enqueue, cancel, status lookup; subscriber sync **stub** |
| `NotificationDeliveryWebhookAdapter` | `@edaya/adaptor-novu` | Svix verify + normalize inbound delivery events |

### 4.4 Trigger flow

```text
                    ┌─────────────────────────────┐
                    │   NotificationGatewayPort   │
                    │  enqueue / cancel           │
                    │  upsertRecipient / remove   │
                    └──────────────▲──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼────────┐
    │ runWorkflow       │ │ postSave hook  │ │ guardian/staff  │
    │ Notifications     │ │ (registry)     │ │ save → upsert    │
    └─────────▲─────────┘ └───────▲────────┘ └────────▲────────┘
              │                    │                    │
    publishAnnouncement      Assessment.save      cron / queue
```

**Entity hooks:** `withNotificationPostSaveHook` in `createCoreEntityServices` merges registry hooks into any entity with registered triggers (currently `assessments` only).

**Workflow hooks:** `runWorkflowNotifications(baseService, eventKey, payload)` dispatches registered handlers after the command's main work completes.

### 4.5 Hook placement rules (validated in implementation)

| Source | Workflow hook | Entity postSave |
|--------|---------------|-----------------|
| Report card published | **Yes** — `publishReportCardResult` | No |
| Attendance (batch) | **Yes** — `recordSessionAttendance`, `recordClassDailyAttendance` | No |
| Attendance (single) | **Yes** — `recordAttendance`, `recordDailyAttendance` | No |
| Announcement published | **Yes** — `publishAnnouncement` | No (direct publish via entity save not used) |
| Assessment due date | No | **Yes** — `assessment.due_soon` job intent |

---

## 5. Phase tracker

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | Event catalog and trigger matrix | **Skipped** — matrix in Appendix A; formal spike doc not created |
| 1 | `NotificationGatewayPort` + test adapters | **Complete** |
| 2 | Wire gateway into `ServiceArgs` / `BaseSchoolService` | **Complete** |
| 3 | Entity trigger registry + `postSave` infrastructure | **Complete** |
| 4 | Workflow hooks + first vertical slices | **Complete** |
| 5 | Job scheduler + date-based scanners | **Complete** |
| 6 | Provider routing, subscriber sync, delivery status, webapp inbox | **In progress** — G6 remains (see § Phase 6) |

### Dependency order

```text
Phase 0 (informal) ─> Phase 1 ─> Phase 2 ─┬─> Phase 3 ─> Phase 4 ✓
                                          └─> Phase 5 ─> Phase 6
```

---

## Phase 0 — Event catalog (skipped, retrospective)

Phase 0 was not executed as a separate spike. Implementation proceeded directly from the draft matrix in Appendix A. Residual open items are captured in **§9 Known gaps** and **Appendix C**.

---

## Phase 1 — Notification gateway port ✅

- [x] `package/domain-core/src/ports/notification-gateway.ts`
- [x] Export from `ports/index.ts`
- [x] `noOpNotificationGateway`, `RecordingNotificationGateway`
- [x] Unit tests: `tests/notifications/notification-gateway-adapters.test.ts`

---

## Phase 2 — Wire gateway into school services ✅

- [x] `notificationGateway` on `ServiceArgs` and `BaseSchoolService`
- [x] All test construction sites updated (`create-test-app`, workflow contexts, integration harnesses)
- [x] API: `buildSchoolApplication` wires gateway (logging when `env` provided and `LOG_LEVEL !== 'silent'`)

---

## Phase 3 — Entity hook infrastructure ✅

- [x] `notification-trigger-registry.ts` — register `(entityKey, predicate, resolver)`
- [x] `createNotificationPostSaveHook` / `withNotificationPostSaveHook`
- [x] `EntityConfigFactoryInput.notificationGateway`
- [x] `createCoreEntityServices` applies hooks for entities with registered triggers
- [x] First trigger: `assessment.due_soon` (`triggers/assessment-due-soon.ts`)
- [x] Tests: `notification-trigger-registry.test.ts`, `assessment-notification-hook.test.ts`

---

## Phase 4 — Workflow hooks and vertical slices ✅

- [x] `workflow-notification-runner.ts` + `runWorkflowNotifications`
- [x] Handlers: `announcement-published`, `report-card-published`, `attendance-recorded`
- [x] `publishAnnouncement` → materialize App deliveries → enqueue
- [x] `publishReportCardResult` → enqueue guardians + student
- [x] `recordSessionAttendance` / `recordClassDailyAttendance` → enqueue for absent/late
- [x] API staging adapter: `createMessageDeliveryNotificationGateway` (log wrapper)
- [x] Workflow tests in `communications-workflows.test.ts`, `assessment-workflows.test.ts`, `scheduling-workflows.test.ts`

### Phase 4 caveat (4.5)

~~The checklist item "transitions `MessageDelivery` Pending → Sent" is **not implemented**.~~ **Superseded (2026-06-24):** `applyDeliveryEvent` + webhook route + `reconcilePendingDeliveries` cron now update status. Novu workflow configuration in dashboard is still required for outbound triggers.

---

## Phase 5 — Job-based scheduler ✅

**Prerequisite:** Phase 4 job **intents** exist (`assessment.due_soon` enqueues with `deliverAfter`).

Cron workflows live in `@edaya/core` (`package/domain-core/src/cron/`). `apps/cron` is a thin runtime shell (Node one-shot + Cloudflare Worker `scheduled`), mirroring `apps/api`.

**Design decision (5.1):** Job delivery uses **query-based cron scanners** over domain entities (not a separate schedule table). Entity `postSave` hooks register `deliverAfter` intent via the gateway; the daily cron re-scans and enqueues when the notification window is open. Idempotency keys prevent duplicate sends.

### 5.1 Scheduled intents

- [x] Query-based cron scanners (no separate schedule table — see design note above)
- [x] Entity hooks on `HomeworkAssignment`, `CalendarEvent`, `ExtracurricularActivity` (assessment already done)

### 5.2 Cron app (`apps/cron`)

- [x] Core cron catalog + runner (`runCronJobs`, `CRON_JOB_KEYS`)
- [x] `processDueNotifications` job — scans assessments, homework, activities, calendar events
- [x] Node entry (`bun dev` / `bun run dev:cron`) — one-shot run for local/CI; optional `CRON_JOB_KEYS` filter
- [x] Worker entry + `wrangler.toml` cron triggers (`0 6 * * *` due notifications; `*/5 * * * *` delivery reconcile)
- [x] Deploy scripts: `bun run deploy:cron`, `bun run deploy:cron:staging` (ops: set secrets + Hyperdrive before first deploy)

### 5.3 Initial job types

- [x] `assessment.due_soon` — 3-day lead, class students (`scan-assessment-due-notifications.ts`)
- [x] `homework.due_soon` — 3-day lead, class students + guardians (`scan-homework-due-notifications.ts`)
- [x] `activity.reminder` — 24h before `startDate`, enrolled students + guardians (`scan-activity-reminders.ts`)
- [x] `calendar.event_reminder` — 24h before `startDate`, scoped class/grade recipients (`scan-calendar-event-reminders.ts`)
- [x] `reconcilePendingDeliveries` — polls Novu Messages API for pending/sent rows (`reconcile-pending-deliveries.ts`)

---

## Phase 6 — Provider routing, subscriber sync, and webapp (in progress)

Phase 6 completes the **provider-centric** model: school domain decides **who** and **what**; the notifier decides **how** (channel routing).

### Phase 6 progress (2026-06-23)

| Slice | Status | Notes |
|-------|--------|-------|
| **6a** | **Mostly done** | Single/batch attendance, incident (`addStudentInvolvement`), assessment result hooks wired; **G6** (`premiumNotificationsEnabled`) open |
| **6b** | **Done** | Slim `MessageDelivery`, migration `0016`, materialize by `subjectId` |
| **6c** | **Mostly done** | Novu adapter; `context.tenant` (not top-level `tenant`) for v2 API; subscriber upsert on link/contact/staff save |
| **6d** | **Done** | Guardian/staff settings UI; notification contact separation; Novu `preferences.update` + `bulkUpdate` on `upsertRecipient` |
| **6e** | **Done** | Webhook route, `applyDeliveryEvent`, `reconcilePendingDeliveries` cron |
| **6f** | **Done** | `/account/inbox/[[id]]` — delivery list, detail drawer, `markDeliveryRead` on open |

**E2E / ops:** Novu workflow trigger id must match `eventKey` (e.g. `announcement.published`). Tenant isolation uses **`context: { tenant: schoolId }`** on trigger (Novu v2). Email delivery: configure a Novu email integration in the dashboard (e.g. Custom SMTP such as `smtp.mx.cloudflare.net`). `NOVU_SECRET_KEY` cached at API startup — restart after key changes. Status sync: webhooks (`NOVU_WEBHOOK_SECRET`) **or** `CRON_JOB_KEYS=reconcilePendingDeliveries bun run dev:cron`.

### 6.0 Target model (end state)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ School domain (EDAYA)                                                   │
│  Announcement + targets → audience resolution                           │
│  MessageDelivery: one row per recipient (no channel for routing)        │
│    • status: pending | sent | failed | read | cancelled                 │
│    • providerMessageId, failureReason (from webhook)                    │
│    • readAt (in-app inbox, user action or provider in-app read)         │
│  Recipient id: { kind: staff|guardian|student, id }                     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ enqueue / cancel / upsertRecipient / removeRecipient
                                ▼
                    ┌──────────────────────┐
                    │ NotificationGatewayPort │
                    │  (single port)         │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Adapter (Novu first) │  ← swappable: Courier, internal
                    │  one factory per pkg │
                    └──────────┬───────────┘
                               │ webhooks (delivery lifecycle)
                               ▼
                    ┌──────────────────────┐
                    │ API webhook ingress  │  → normalized event → core command
                    │ applyDeliveryEvent   │  → update MessageDelivery status
                    └──────────────────────┘
```

**Principles**

1. **No channel in school routing data** — remove `channel` from `materializeDeliveries` input and from materialized rows; deprecate multi-channel seed fixtures. Optional: keep `channel` on webhook audit payload only, or add nullable `lastChannel` for support UI (not used to enqueue).
2. **Recipient identifier to gateway** — domain resolves audience as staff/guardian/student entities; adapter maps to **auth account** (`subjectId` on `StaffMember` / `Guardian` / `Student`). Novu `subscriberId` = `subjectId` (tenant = `schoolId`). Students are treated like guardians from an auth perspective once invitation/linking lands.
3. **Inbox per account** — `MessageDelivery` is keyed by `subjectId` (Better Auth user), not `{ recipientKind, recipientId }`. Profile/inbox UI queries by session `subjectId`. Domain may still store optional `recipientKind` / `recipientId` for staff audit (“sent to guardian X about student Y”).
3. **One port per provider** — `NotificationGatewayPort` covers send and subscriber sync; each adapter package implements all methods so swapping Novu → Courier is a single DI change.
4. **Delivery status returns via webhooks or poll** — provider pushes lifecycle events (preferred); `reconcilePendingDeliveries` cron polls Novu Messages API when webhooks unavailable (local dev, non-Enterprise tier).

### 6.1 Domain and persistence changes (6b) ✅

- [x] **Slim `MessageDelivery`** — one row per `(announcementId, subjectId)` for ad-hoc; remove `channel` from schema (migration `package/adaptor-postgres/drizzle/0016_message_delivery_subject_id.sql`).
- [x] **`materializeDeliveries`** — drop `channel` parameter; resolve each audience member → `subjectId`; **skip** recipients without a linked account.
- [x] Generate stable ids: `delivery:{announcementId}:{subjectId}`.
- [x] **`publishAnnouncement`** — materialize recipient rows (status `pending`) then per-delivery `gateway.enqueue` (`idempotencyKey` = `delivery.id`).
- [x] **Remove `channels` from `NotificationEnqueueInput`** as routing hint; handlers stop passing channel lists.
- [x] **Seed cleanup** — multi-channel demo rows aligned with new model.
- [ ] **Event/job notifications** — decide per event whether to materialize inbox rows (G4); at minimum ad-hoc announcements always materialize.

**`MessageDelivery` fields (target)**

| Field | Role |
|-------|------|
| `id` | Stable delivery id; **Novu `transactionId`** per trigger |
| `announcementId` | Link to ad-hoc communication |
| `subjectId` | **Auth account** (Better Auth user id) — inbox query key |
| `recipientKind`, `recipientId` | Optional audit context (which school entity was targeted) |
| `status` | School DB truth for inbox and staff dashboards |
| `providerMessageId` | Set from webhook when provider assigns message id |
| `failureReason` | Set from webhook on failure |
| `sentAt`, `readAt` | Lifecycle timestamps |
| ~~`channel`~~ | **Removed** — routing owned by notifier |

### 6.2 Ports (6b — core interfaces) ✅

Extend `package/domain-core/src/ports/notification-gateway.ts` (implementations stay in `package/adaptor-*`).

#### `NotificationGatewayPort` (expanded)

```typescript
export interface NotificationRecipientProfile {
  schoolId: string
  recipient: NotificationRecipient
  displayName?: string
  email?: string
  phone?: string
  locale?: string
  preferences: {
    receivesAttendanceAlerts?: boolean
    receivesAcademicReports?: boolean
    allowsNotifications?: boolean
    premiumNotificationsEnabled?: boolean
    channels?: Partial<Record<'email' | 'sms' | 'push' | 'in_app', boolean>>
  }
}

export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
  upsertRecipient: (profile: NotificationRecipientProfile) => Promise<void>
  removeRecipient: (schoolId: string, recipient: NotificationRecipient) => Promise<void>
  lookupDeliveryStatuses?: (
    deliveries: ReadonlyArray<{ deliveryId: string; subjectId: string }>,
  ) => Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>>
}
```

- `NotificationEnqueueInput.recipients` remains `{ kind, id }[]`.
- Pass `metadata.deliveryId` per recipient so webhooks can correlate.
- Remove `channels` from enqueue contract when adapters no longer need it.
- **`upsertRecipient` / `removeRecipient`** — invoked when staff/guardian contact or notification settings change, and on link/provision flows (e.g. after auth seed link). Async, non-blocking from entity saves.

| Adapter | Package | Notes |
|---------|---------|-------|
| `noOpNotificationGateway` | `@edaya/core` | All methods no-op |
| `RecordingNotificationGateway` | `@edaya/core` | Records enqueue + sync calls |
| `createLoggingNotificationGateway` | `apps/api`, `apps/cron` | Logs all port methods |
| `createNovuNotificationGateway` | `@edaya/adaptor-novu` | Trigger, cancel, status lookup, subscriber upsert + preferences sync |
| `createCourierNotificationGateway` | future `package/adaptor-courier` | Same port surface |

Single instance wired on `ServiceArgs.notificationGateway` (unchanged DI key).

#### `NotificationDeliveryWebhookAdapter` (adapter-side, not core)

Each provider adapter exposes **verify + normalize** for inbound HTTP:

```typescript
export interface NormalizedDeliveryEvent {
  deliveryId: string           // MessageDelivery.id
  status: 'sent' | 'failed' | 'read' | 'cancelled'
  providerMessageId?: string
  channel?: string             // audit only — which channel succeeded/failed
  failureReason?: string
  occurredAt: Date
}

export interface NotificationDeliveryWebhookAdapter {
  verifyRequest: (request: Request) => Promise<boolean>
  parseEvents: (request: Request) => Promise<NormalizedDeliveryEvent[]>
}
```

Core stays provider-agnostic: API route calls adapter, then domain command.

### 6.3 Delivery status sync — webhook + poll (6e) ✅

**Problem:** Novu (or Courier) sends asynchronously; school DB must reflect sent/failed/read for inbox and staff visibility.

**Correlation strategy**

| Step | Detail |
|------|--------|
| 1. Materialize | Create `MessageDelivery` with `id = delivery:{announcementId}:{subjectId}`, `subjectId` set, `status = pending` |
| 2. Enqueue | **One Novu trigger per account** via `triggerBulk` (≤100/request): `to = subjectId`, `transactionId = deliveryId`, `tenant = schoolId`, payload includes `deliveryId` + announcement metadata |
| 3. Webhook | `message.sent` / `message.delivered` / `message.failed` / `message.read` → parse `transactionId` + `subscriberId` |
| 4. Domain command | `communicationsWorkflow.applyDeliveryEvent(event)` — idempotent status transition |

**`applyDeliveryEvent` rules (core)**

- Lookup `MessageDelivery` by `event.deliveryId`; ignore unknown ids (log).
- Valid transitions: `pending → sent | failed | cancelled`; `sent → read`; ignore duplicate/out-of-order with same or lower rank.
- Set `providerMessageId`, `failureReason`, `sentAt`, `readAt` from event.
- **Read path (in-app):** webapp inbox can also call `markDeliveryRead(deliveryId)` when user opens item — sets `readAt` locally; optional forward to provider if in-app channel supports read receipts.

```text
Novu workflow step completed
        │
        ▼
POST /webhooks/novu  ──► adaptor-novu.parseEvents()
        │
        ▼
applyDeliveryEvent({ deliveryId, status: 'sent', providerMessageId, channel: 'email' })
        │
        ▼
MessageDelivery.status = sent, sentAt = now
```

**Workers / security**

- Webhook route on API Worker (or dedicated `apps/notifications` later); verify HMAC/signature per adapter.
- No auth session — shared secret or provider signing key in env (`NOVU_WEBHOOK_SECRET`).
- Rate-limit and reject replay (timestamp + idempotency on `providerMessageId` + status).

**Polling fallback (implemented 2026-06-24)**

Cron job `reconcilePendingDeliveries` calls Novu Messages API via `lookupDeliveryStatuses` on the gateway — same `applyDeliveryEvent`. Runs every 5 minutes on Worker (`*/5 * * * *`); locally: `CRON_JOB_KEYS=reconcilePendingDeliveries bun run dev:cron`. Prefer webhooks in production when Novu tier supports outbound webhooks.

### 6.4 Remaining event hooks (6a)

- [x] `recordAttendance` / `recordDailyAttendance` (single-record) workflow notification hooks (G2)
- [x] `incident.recorded` on `addStudentInvolvement`, `assessment.result_recorded` on `recordAssessmentResult` (G3)
- [ ] Enforce `premiumNotificationsEnabled` in recipient resolution where applicable (G6)

### 6.5 Provider wiring (6c) — mostly done

- [x] `createNovuSubscriberClient` — Novu subscriber create (upsert) + delete.
- [x] `upsertRecipient` / `removeRecipient` wired through Novu adapter when `NOVU_SECRET_KEY` set.
- [x] Production path: `resolveNotificationGateway` → Novu adapter; per-recipient `transactionId` = `deliveryId`.
- [x] `lookupDeliveryStatuses` — Novu Messages API poll for reconcile cron.
- [x] Workflow hooks schedule subscriber sync after `linkActorSubject`, `updateGuardianContactMethods`, `updateGuardianStudentLink`, `registerStaffMember`, `updateStaffMemberStatus` (remove when deactivated).
- [ ] Novu workflows configured per `eventKey` in dashboard — **ops** task.

### 6.6 Preferences UI + sync (6d)

- [x] Webapp **notification settings** screen (guardian/staff) — per-category toggles aligned with `NotificationRecipientProfile.preferences`.
- [x] **Notification contact** — `notificationEmail` / `notificationPhone` on guardian/staff, separate from Better Auth login email; `updateNotificationContact` command; resolution order: explicit override → auth email → school contact.
- [x] Save → school entity update **and** `notificationGateway.upsertRecipient(profile)` (subscriber profile sync).
- [x] Novu **preferences** API sync — global + per-workflow channel toggles via `subscribers.preferences.update` / `bulkUpdate` with `context.tenant`.
- [ ] School DB remains source for **authorization and eligibility**; provider copy is for **routing** (document conflict rule: school save wins).

### 6.7 Webapp inbox and staff communications (6f)

- [x] Guardian/staff **notification inbox** — list `MessageDelivery` for logged-in actor by session `subjectId`.
- [x] Mark read → `markDeliveryRead` command wired in inbox detail open.
- [x] Staff **announcements** UI (list, draft, targets, publish) — shipped; aligned with 6b materialize model.

### 6.8 Phase 6 checklist (summary)

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **6a** | Remaining event hooks (attendance single, incident, assessment result) | **Mostly done** — G6 open |
| **6b** | Slim `MessageDelivery`, port contracts, materialize without channel, migration | **Done** |
| **6c** | Extend `NotificationGatewayPort` + Novu adapter (enqueue + subscriber sync) | **Mostly done** |
| **6d** | Preferences UI + sync on save | **Done** |
| **6e** | Webhook ingress + `applyDeliveryEvent` + reconcile job | **Done** |
| **6f** | Guardian/staff inbox UI | **Done** |

### 6.9 Success criteria (Phase 6 complete)

- [x] Publish announcement → one `MessageDelivery` per recipient, no channel column used for routing.
- [x] `gateway.enqueue` + `gateway.upsertRecipient` work through one port; Novu swappable via adapter package only.
- [x] Provider webhook or poll reconcile updates `MessageDelivery` to `sent` / `failed` / `read`.
- [x] User can change notification preferences in webapp; changes reflected at provider.
- [x] Core tests green; adapter tests for Novu trigger + webhook normalize + status mapping + reconcile cron (**subscriber sync tests pending**).

---

## 6. Testing strategy (current coverage)

| Layer | Covered | Tests |
|-------|---------|-------|
| Port adapters | Yes | `notification-gateway-adapters.test.ts` |
| Entity trigger registry | Yes | `notification-trigger-registry.test.ts` |
| Entity hook integration | Yes | `assessment-notification-hook.test.ts`, `homework-notification-hook.test.ts` |
| Workflow: announcement | Yes | `communications-workflows.test.ts` (incl. `applyDeliveryEvent`) |
| Workflow: report card | Yes | `assessment-workflows.test.ts` |
| Workflow: attendance | Yes | `scheduling-workflows.test.ts` |
| API runtime wiring | Yes | `apps/api` tsc; `novu-webhook.routes.ts` |
| Job processor | Yes | `tests/cron/` — due-window, runner, reconcile, resolve-cron-job-keys |
| Novu adapter | Yes | `package/adaptor-novu/tests/` — trigger, webhook, delivery-status |
| Provider HTTP (live) | Manual | `scripts/novu-e2e-smoke.ts`; requires Novu dashboard workflow |

**Smoke test:** `bun novu:smoke` (API running, seed data, `NOVU_SECRET_KEY`).

---

## 7. Risks and mitigations

| Risk | Status | Mitigation |
|------|--------|------------|
| Double send (hook + workflow) | Mitigated | One trigger per event key; idempotency keys |
| `postSave` slows writes | Mitigated | Enqueue only in hooks |
| Direct entity save bypasses workflow | Partial | Registry on `assessments`; other entities not mirrored |
| Guardian spam | Partial | Opt-out flags on wired handlers; no digest/batching |
| Cross-tenant leakage | Mitigated | Resolvers check `actor.schoolId` vs entity school |
| Job intents never delivered | **Mitigated** | Cron scanners + entity hooks; idempotency keys |
| Users see no notifications | **Partial** | Novu dispatch + status sync wired; inbox UI (6f) and dashboard workflows still required |

---

## 8. Suggested next PR sequence

1. ~~**PR 6b:** Domain — remove `channel` from `MessageDelivery` + materialize; migration.~~ **Done**
2. ~~**PR 6e:** Webhook route + `applyDeliveryEvent` + Novu delivery webhook adapter; per-recipient `transactionId`; reconcile cron.~~ **Done**
3. ~~**PR 6f:** Guardian/staff inbox UI + `markDeliveryRead`.~~ **Done**
4. ~~**PR 6d (tail):** Novu preferences API sync on guardian channel toggle save.~~ **Done**
5. **PR 6a (tail):** Enforce `premiumNotificationsEnabled` in recipient resolution (G6).

**Ops (parallel):** Create Novu workflows per `eventKey` (`bun novu:bootstrap:apply`); use `context.tenant` in workflow templates (`{{context.tenant.*}}`); configure email delivery via a Novu email integration (e.g. Custom SMTP).

---

## 9. Known gaps (updated 2026-06-23)

| ID | Gap | Impact | Status |
|----|-----|--------|--------|
| G1 | No persisted `deliverAfter` queue — cron re-scans domain | Cron may re-enqueue if idempotency expires at provider | **Mitigated** (Phase 5) |
| G2 | `recordAttendance` / `recordDailyAttendance` (single-record) lack workflow notification hooks | Direct attendance API path silent | **Closed** — wired (6a) |
| G3 | `incident.recorded`, `assessment.result_recorded` not implemented | Matrix rows remain draft | **Closed** — handlers + workflow hooks (6a) |
| G4 | Event/job notifications do not create `Announcement` rows | No unified inbox for system events unless `MessageDelivery` materialized per event | Open — 6f design |
| G5 | `MessageDelivery.channel` used for routing | Wrong model | **Closed** — column removed (6b) |
| G6 | `premiumNotificationsEnabled` not enforced in recipient resolution | Premium flag ignored | Open — 6a |
| G7 | No real delivery or status transition | Stuck at pending | **Closed** — Novu + webhook + reconcile (6e) |
| G8 | Phase 0 formal catalog never written | Onboarding/docs gap | Optional |
| G9 | Subscriber sync at provider | Prefs not pushed to Novu preferences API | **Closed** — subscriber upsert + preferences API sync (6d) |
| G10 | No inbound delivery status | Stuck at pending after send | **Closed** — webhook + poll (6e) |
| G11 | Novu preferences API not synced on channel toggle save | Provider may route channels user disabled in UI | **Closed** — preferences update + bulk update (6d) |

---

## Appendix A — Trigger matrix (implementation status)

| eventKey | Kind | Entry point | Recipients | Opt-out | Status |
|----------|------|-------------|------------|---------|--------|
| `announcement.published` | ad_hoc | `communicationsWorkflow.publishAnnouncement` | Materialized deliveries (one per `subjectId`) | `allowsNotifications` (partial) | **Live** — Novu per-delivery trigger |
| `report_card.published` | event | `assessmentsWorkflow.publishReportCardResult` | Student + guardians | `receivesAcademicReports` | **Live** |
| `attendance.recorded` | event | `recordAttendance`, `recordDailyAttendance`, `recordSessionAttendance`, `recordClassDailyAttendance` | Guardians | `receivesAttendanceAlerts`, `allowsNotifications` | **Live** |
| `assessment.due_soon` | job | Assessment `postSave` + cron scanner | Class students | — | **Live** |
| `homework.due_soon` | job | Homework `postSave` + cron scanner | Class students + guardians | `receivesAcademicReports` | **Live** |
| `activity.reminder` | job | Activity `postSave` + cron scanner | Enrolled + guardians | `allowsNotifications` | **Live** |
| `calendar.event_reminder` | job | Calendar event `postSave` + cron scanner | Scoped class/grade students + guardians | `allowsNotifications` | **Live** (school-wide scope skipped) |
| `incident.recorded` | event | `behaviorWorkflow.addStudentInvolvement` | Involved student's guardians | `allowsNotifications` on contact methods | **Live** |
| `assessment.result_recorded` | event | `assessmentsWorkflow.recordAssessmentResult` | Student + guardians | `receivesAcademicReports` | **Live** |

### Idempotency key formats (implemented)

| eventKey | Key pattern |
|----------|-------------|
| `announcement.published` | `delivery:{announcementId}:{subjectId}` (per delivery row; one Novu trigger each) |
| `report_card.published` | `report_card.published:{resultId}` |
| `attendance.recorded` | `attendance.recorded:{studentId}:{sessionId}:{status}` |
| `incident.recorded` | `incident.recorded:{incidentId}:{studentId}` |
| `assessment.result_recorded` | `assessment.result_recorded:{assessmentResultId}` |
| `assessment.due_soon` | `assessment.due_soon:{assessmentId}` |
| `homework.due_soon` | `homework.due_soon:{homeworkAssignmentId}` |
| `activity.reminder` | `activity.reminder:{activityId}` |
| `calendar.event_reminder` | `calendar.event_reminder:{calendarEventId}` |

---

## Appendix B — Key files (as implemented)

| Area | Files |
|------|-------|
| Port (enqueue + subscriber sync + status lookup) | `package/domain-core/src/ports/notification-gateway.ts` |
| Webhook normalize | `package/adaptor-novu/src/delivery-webhook.ts` |
| Status poll mapping | `package/adaptor-novu/src/delivery-status.ts`, `novu-messages-client.ts` |
| Adapters | `package/domain-core/src/notifications/no-op-notification-gateway.ts`, `recording-notification-gateway.ts` |
| Entity triggers | `notification-trigger-registry.ts`, `register-notification-triggers.ts`, `triggers/*.ts` |
| Cron jobs | `package/domain-core/src/cron/` — `processDueNotifications`, `reconcilePendingDeliveries`, `resolve-cron-job-keys.ts` |
| Novu adapter | `package/adaptor-novu/` — trigger uses `context.tenant` = `schoolId` |
| Notification contact | `package/domain-core/src/notifications/resolve-notification-contact.ts`, migration `0017_notification_contact.sql` |
| Novu bootstrap | `package/adaptor-novu/bootstrap/` — `bun novu:bootstrap:apply` |
| Workflow triggers | `workflow-notification-runner.ts`, `handlers/announcement-published.ts`, … |
| Workflows | `communications.ts` (`applyDeliveryEvent`, `markDeliveryRead`, materialize) |
| API | `apps/api/src/routes/novu-webhook.routes.ts`, `resolve-notification-gateway.ts` |
| Smoke test | `scripts/novu-e2e-smoke.ts` |
| Tests | `package/domain-core/tests/notifications/*`, `tests/cron/reconcile-pending-deliveries.test.ts`, `package/adaptor-novu/tests/` |

---

## Appendix C — Open questions (updated)

| # | Question | Decision / status |
|---|----------|-------------------|
| 1 | System actor for automated announcements | **Deferred** — event notifications enqueue without creating `Announcement` rows (G4) |
| 2 | In-app visibility before inbox UI | **6f** — inbox reads `MessageDelivery` for logged-in actor |
| 3 | Per-school assessment lead time | **Hardcoded** — `ASSESSMENT_DUE_SOON_LEAD_DAYS = 3` in `assessment-due-soon.ts` |
| 4 | Queue vs cron on Workers | **Decided** — `apps/cron` Worker with daily cron trigger |
| 5 | Who owns channel routing? | **Decided (2026-06-23)** — **Provider** (Novu workflows + subscriber prefs). School DB stores delivery outcome only; `MessageDelivery.channel` removed in 6b |
| 6 | How does delivery status return? | **Implemented (2026-06-24)** — Webhooks (`POST /webhooks/novu`) + `reconcilePendingDeliveries` cron poll; both call `applyDeliveryEvent` |
| 7 | How to swap Novu for Courier/internal? | **Decided** — single `NotificationGatewayPort` per adapter package + per-provider webhook adapter; no core provider imports |
| 8 | Separate port for subscriber sync? | **Decided (2026-06-23)** — **No** — merge `upsertRecipient` / `removeRecipient` into `NotificationGatewayPort`; one factory per provider |
| 9 | Novu subscriber id | **Decided (2026-06-23)** — `subjectId` (auth account); **`context.tenant`** = `schoolId` (Novu v2; not top-level `tenant`) |
| 10 | Inbox scope | **Decided (2026-06-23)** — per **account** (`subjectId`), query from session on profile/notifications page |
| 11 | Students without linked account | **Deferred** — invitation/linking sprint; materialize skips until `subjectId` exists; provider used for invite comms |

---

## Appendix E — Novu feasibility (2026-06-23)

**Verdict: proceed** with per-account triggers + `transactionId` = `MessageDelivery.id`. Adjust enqueue adapter (today one bulk trigger per event key).

### Trigger API (outbound)

| Capability | Novu support | Our use |
|------------|--------------|---------|
| `transactionId` on trigger | Yes — dedupes retries | Set to `MessageDelivery.id` |
| One subscriber per trigger | Yes — `to: subjectId` | One account per delivery row |
| Bulk trigger (≤100 events) | Yes — each event is full `TriggerEventRequestDto` with own `transactionId` | Announcement audiences chunked |
| `tenant` / `context.tenant` | Yes | `context: { tenant: schoolId }` on trigger (v2 API) |
| Custom payload | Yes | `deliveryId`, `announcementId`, title, body, metadata |

**Change from earlier code:** ~~`announcement-published` handler uses one `transactionId` for all recipients~~ **Done (2026-06-24)** — one Novu trigger per delivery; `transactionId` = `MessageDelivery.id`.

### Webhook / status (inbound)

| Event | Maps to `MessageDelivery` |
|-------|---------------------------|
| `message.sent` | Optional progress (provider accepted) |
| `message.delivered` | `status = sent`, `sentAt` |
| `message.failed` | `status = failed`, `failureReason` |
| `message.read` / `message.seen` | `status = read`, `readAt` (in-app channel) |

Novu message objects include **`transactionId`** and **`subscriber.subscriberId`** — sufficient to correlate webhook → `MessageDelivery.id` and verify account.

**Plan tier:** outbound webhooks require Novu **Team/Enterprise**. Confirm subscription. **Fallback implemented:** `reconcilePendingDeliveries` polls [Messages API](https://docs.novu.co/api-reference/messages) by `transactionId` every 5 minutes.

### Multi-channel caveat

One trigger can produce **multiple messages** (email + in_app + push). Define rule in 6e:

- **Recommended:** `sent` when **in_app** message delivers (inbox truth); email/SMS failures logged but do not fail the row if in-app succeeded.
- Store optional `lastChannel` on webhook for support only.

### Auth alignment (already in domain)

`StaffMember`, `Guardian`, and `Student` already have optional `subjectId` (Better Auth user id). Invitation/linking sprint will populate student `subjectId` the same way as guardians — no separate Novu identity model for students.

### Adapter changes (6c)

- [x] `buildNovuSubscriberId` → `subjectId` pass-through.
- [x] `handleAnnouncementPublished` → one Novu enqueue per delivery (`idempotencyKey` = `delivery.id`).
- [x] `lookupDeliveryStatuses` → Novu Messages API for reconcile cron.
- [ ] `upsertRecipient` → Novu subscriber CRUD keyed by `subjectId`, profile from guardian/staff/student + prefs.

---

## Appendix D — Responsibility split (reference)

| Concern | School domain (EDAYA) | Notifier (Novu / Courier / internal) |
|---------|----------------------|----------------------------------------|
| Message content | `Announcement.title`, `content` | Template rendering |
| Audience | `AnnouncementTarget` + resolvers | — |
| Recipient identity | `subjectId` (auth account) | `subscriberId` (= `subjectId`) |
| Eligibility (business rules) | Guardian flags, enrollment | — |
| Channel choice (email/SMS/push) | — | Workflows + synced preferences |
| Per-recipient delivery record | `MessageDelivery` status, readAt | Provider message ids |
| Send intent | `NotificationGatewayPort.enqueue` | Execute workflow |
| Profile/prefs push | `NotificationGatewayPort.upsertRecipient` | Subscriber store |
| Delivery lifecycle inbound | `applyDeliveryEvent` (core) | Webhook or poll → adapter normalizes |

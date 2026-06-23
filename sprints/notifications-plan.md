# Notifications Feature — Sprint Plan

> **Status:** Infrastructure complete (Phases 1–4) — job scheduler and delivery UX deferred  
> **Created:** 2026-06-22  
> **Last updated:** 2026-06-22  
> **Scope:** Notification gateway port, trigger infrastructure (entity hooks + workflow hooks), and first vertical slices for three announcement kinds  
> **Related domain:** `package/domain-core/src/domains/messaging/` (`Announcement`, `AnnouncementTarget`, `MessageDelivery`)

This plan introduced a **notification gateway** as a core port, wired **event-based triggers** through `ManagedEntityService` hooks and **workflow post-actions**, and reserved **job-based scheduling** and **provider delivery** for follow-on work.

Phases **1–4** are implemented and tested in `@edaya/core`. The infrastructure sprint goal is met: notifications can be enqueued from workflows and entity saves without coupling core to external providers. **Nothing is actually delivered to users yet** outside log output in API dev/staging — that requires Phases 5–6.

---

## 1. Notification kinds

| Kind | Trigger | Examples | Integration status |
|------|---------|----------|-------------------|
| **Ad-hoc** | Staff publishes communication to a defined audience | School-wide notice, class message | **Wired** — `publishAnnouncement` materializes App deliveries + gateway enqueue |
| **Event-based** | Domain state change after a command or save | Attendance, report card published | **Partial** — report card + batch attendance wired; incidents, marks, single-record attendance not wired |
| **Job-based** | Time / schedule (cron or deferred queue) | Assessment due in 3 days | **Intent only** — entity hook enqueues with `deliverAfter`; no processor (Phase 5) |

### Relationship to existing messaging domain

- `Announcement` + `AnnouncementTarget` + `MessageDelivery` remain the persistence model for **ad-hoc** communications.
- **Event** and **job** notifications currently enqueue through `NotificationGatewayPort` only — they do **not** yet create system-authored `Announcement` rows (see gap G4 below).
- Guardian preferences used in handlers: `receivesAttendanceAlerts`, `receivesAcademicReports`, `allowsNotifications` on contact methods.
- `premiumNotificationsEnabled` on guardians and `premiumNotification` on announcements are passed through on ad-hoc enqueue but **not** used to filter recipients yet.

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
- No HTTP/GraphQL payload changes.
- No new database migrations.
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
  ports/notification-gateway.ts          # Port interface
  notifications/
    no-op-notification-gateway.ts
    recording-notification-gateway.ts
    recipient-utils.ts
    notification-trigger-registry.ts       # Entity postSave registry
    workflow-notification-runner.ts      # Workflow dispatch
    register-notification-triggers.ts    # Entity triggers (auto-load)
    register-workflow-notification-handlers.ts
    triggers/assessment-due-soon.ts
    handlers/
      announcement-published.ts
      report-card-published.ts
      attendance-recorded.ts

apps/api/src/runtime/shared/
  notification-gateway.ts                # Pino logging adapter
  message-delivery-notification-gateway.ts  # Staging wrapper (log only)
  school-application.ts                  # Gateway DI
```

### 4.2 Notification gateway port

```typescript
export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
}
```

`NotificationEnqueueInput` supports `kind: 'ad_hoc' | 'event' | 'job'`, optional `announcementId`, `deliverAfter`, `channels`, `priority`, `premium`, and `metadata`.

### 4.3 Adapters

| Adapter | Location | Role |
|---------|----------|------|
| `noOpNotificationGateway` | `@edaya/core` | Default in tests; silent |
| `RecordingNotificationGateway` | `@edaya/core` | Test assertions; dedupes by `idempotencyKey` |
| `createLoggingNotificationGateway` | `apps/api`, `apps/cron` | Pino log of enqueue/cancel (fallback when Novu not configured) |
| `createMessageDeliveryNotificationGateway` | `apps/api` | Wraps logging adapter for staging (**does not** update `MessageDelivery` status yet) |
| `createNovuNotificationGateway` | `@edaya/adaptor-novu` | Novu Cloud trigger/cancel via `NotificationGatewayPort` |

### 4.4 Trigger flow

```text
                    ┌─────────────────────────────┐
                    │   NotificationGatewayPort   │
                    │      enqueue() / cancel()   │
                    └──────────────▲──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼────────┐
    │ runWorkflow       │ │ postSave hook  │ │ Job processor   │
    │ Notifications     │ │ (registry)     │ │ (Phase 5)       │
    └─────────▲─────────┘ └───────▲────────┘ └────────▲────────┘
              │                    │                    │
    publishAnnouncement      Assessment.save      cron / queue
    publishReportCardResult  (dueAt change)
    recordSessionAttendance
    recordClassDailyAttendance
```

**Entity hooks:** `withNotificationPostSaveHook` in `createCoreEntityServices` merges registry hooks into any entity with registered triggers (currently `assessments` only).

**Workflow hooks:** `runWorkflowNotifications(baseService, eventKey, payload)` dispatches registered handlers after the command's main work completes.

### 4.5 Hook placement rules (validated in implementation)

| Source | Workflow hook | Entity postSave |
|--------|---------------|-----------------|
| Report card published | **Yes** — `publishReportCardResult` | No |
| Attendance (batch) | **Yes** — `recordSessionAttendance`, `recordClassDailyAttendance` | No |
| Attendance (single) | **No** — `recordAttendance`, `recordDailyAttendance` not wired | Gap G2 |
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
| 6 | Provider adapters + webapp inbox | **Deferred** |

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

The checklist item "transitions `MessageDelivery` Pending → Sent" is **not implemented**. The staging adapter only logs enqueue intent. `MessageDelivery` rows are created on ad-hoc publish (App channel) but status stays `Pending` until Phase 6 provider work.

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
- [x] Node entry (`bun dev` / `bun run dev:cron`) — one-shot run for local/CI
- [x] Worker entry + `wrangler.toml` cron trigger (`0 6 * * *`)
- [x] Deploy scripts: `bun run deploy:cron`, `bun run deploy:cron:staging` (ops: set secrets + Hyperdrive before first deploy)

### 5.3 Initial job types

- [x] `assessment.due_soon` — 3-day lead, class students (`scan-assessment-due-notifications.ts`)
- [x] `homework.due_soon` — 3-day lead, class students + guardians (`scan-homework-due-notifications.ts`)
- [x] `activity.reminder` — 24h before `startDate`, enrolled students + guardians (`scan-activity-reminders.ts`)
- [x] `calendar.event_reminder` — 24h before `startDate`, scoped class/grade recipients (`scan-calendar-event-reminders.ts`)

---

## Phase 6 — Providers and webapp (deferred)

- [ ] Email/SMS/WhatsApp provider adapters behind gateway
- [ ] Transition `MessageDelivery` Pending → Sent/Failed/Read
- [ ] Webapp notification inbox (app channel); mark read via `MessageDelivery.readAt`
- [ ] Staff UI for ad-hoc announcements (align with `specs/app-shell-spec.md`)
- [ ] Multi-channel publish (ad-hoc currently materializes **App only** on publish)

---

## 6. Testing strategy (current coverage)

| Layer | Covered | Tests |
|-------|---------|-------|
| Port adapters | Yes | `notification-gateway-adapters.test.ts` (4) |
| Entity trigger registry | Yes | `notification-trigger-registry.test.ts` (9) |
| Entity hook integration | Yes | `assessment-notification-hook.test.ts` (2), `homework-notification-hook.test.ts` (2) |
| Workflow: announcement | Yes | `communications-workflows.test.ts` |
| Workflow: report card | Yes | `assessment-workflows.test.ts` |
| Workflow: attendance | Yes | `scheduling-workflows.test.ts` |
| API runtime wiring | Implicit | `apps/api` tsc passes |
| Job processor | Yes | `package/domain-core/tests/cron/` (due-window, cron-job-runner); `apps/cron` runtime |
| Provider HTTP | No | Phase 6 |

**Total notification-specific tests:** 19 in `package/domain-core/tests/notifications/` + 3 workflow assertion tests + 4 cron tests.

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
| Users see no notifications | **Open** | Phase 6 inbox + providers required |

---

## 8. Suggested next PR sequence

Infrastructure (Phases 1–4) can ship as one or more PRs. Recommended follow-on:

1. **PR A (Phase 5a):** Cron entry + process `deliverAfter` enqueue records (assessment due-soon end-to-end).
2. **PR B (Phase 5b):** Homework/activity entity triggers + scanners.
3. **PR C (Phase 6a):** Wire single-record attendance notifications; incident + assessment result handlers.
4. **PR D (Phase 6b):** Provider adapter + `MessageDelivery` status transitions.
5. **PR E (Phase 6c):** Webapp notification inbox.

---

## 9. Known gaps (post Phase 4)

| ID | Gap | Impact | Suggested phase |
|----|-----|--------|-----------------|
| G1 | No persisted `deliverAfter` queue — cron re-scans domain | Cron may re-enqueue if idempotency expires at provider | 5 ✅ (query-based) |
| G2 | `recordAttendance` / `recordDailyAttendance` (single-record) lack workflow notification hooks | Direct attendance API path silent | 6a |
| G3 | `incident.recorded`, `assessment.result_recorded` not implemented | Matrix rows remain draft | 6a |
| G4 | Event/job notifications do not create `Announcement` rows | No unified inbox/history for system events | 6 (design decision) |
| G5 | `publishAnnouncement` materializes **App channel only** | Email/SMS not auto-materialized on publish | 6 |
| G6 | `premiumNotificationsEnabled` not enforced in recipient resolution | Premium flag ignored for delivery | 6 |
| G7 | `MessageDeliveryNotificationGateway` is log-only | No real delivery or status transition | 6 |
| G8 | Phase 0 formal catalog never written | Onboarding/docs gap | Optional doc pass |

---

## Appendix A — Trigger matrix (implementation status)

| eventKey | Kind | Entry point | Recipients | Opt-out | Status |
|----------|------|-------------|------------|---------|--------|
| `announcement.published` | ad_hoc | `communicationsWorkflow.publishAnnouncement` | Materialized App deliveries | `allowsNotifications` (partial) | **Live** |
| `report_card.published` | event | `assessmentsWorkflow.publishReportCardResult` | Student + guardians | `receivesAcademicReports` | **Live** |
| `attendance.recorded` | event | `schedulingWorkflow.recordSessionAttendance`, `recordClassDailyAttendance` | Guardians | `receivesAttendanceAlerts`, `allowsNotifications` | **Live** (batch only) |
| `assessment.due_soon` | job | Assessment `postSave` + cron scanner | Class students | — | **Live** |
| `homework.due_soon` | job | Homework `postSave` + cron scanner | Class students + guardians | `receivesAcademicReports` | **Live** |
| `activity.reminder` | job | Activity `postSave` + cron scanner | Enrolled + guardians | `allowsNotifications` | **Live** |
| `calendar.event_reminder` | job | Calendar event `postSave` + cron scanner | Scoped class/grade students + guardians | `allowsNotifications` | **Live** (school-wide scope skipped) |
| `incident.recorded` | event | `behaviorWorkflow.recordIncident` | Involved guardians | TBD | Planned |
| `assessment.result_recorded` | event | `assessmentsWorkflow.recordAssessmentResult` | Student + guardians | `receivesAcademicReports` | Planned |

### Idempotency key formats (implemented)

| eventKey | Key pattern |
|----------|-------------|
| `announcement.published` | `announcement.published:{announcementId}` |
| `report_card.published` | `report_card.published:{resultId}` |
| `attendance.recorded` | `attendance.recorded:{studentId}:{sessionId}:{status}` |
| `assessment.due_soon` | `assessment.due_soon:{assessmentId}` |
| `homework.due_soon` | `homework.due_soon:{homeworkAssignmentId}` |
| `activity.reminder` | `activity.reminder:{activityId}` |
| `calendar.event_reminder` | `calendar.event_reminder:{calendarEventId}` |

---

## Appendix B — Key files (as implemented)

| Area | Files |
|------|-------|
| Port | `package/domain-core/src/ports/notification-gateway.ts` |
| Adapters | `package/domain-core/src/notifications/no-op-notification-gateway.ts`, `recording-notification-gateway.ts` |
| Entity triggers | `notification-trigger-registry.ts`, `register-notification-triggers.ts`, `triggers/*.ts` |
| Cron jobs | `package/domain-core/src/cron/` — `runCronJobs`, `processDueNotifications`, scanners |
| Novu adapter | `package/adaptor-novu/` |
| Workflow triggers | `workflow-notification-runner.ts`, `register-workflow-notification-handlers.ts`, `handlers/*.ts` |
| Service wiring | `service-args.ts`, `base-school-service.ts`, `core-entity-catalog.ts` |
| Workflows | `communications.ts`, `assessments.ts`, `scheduling.ts` |
| API runtime | `apps/api/src/runtime/shared/school-application.ts`, `message-delivery-notification-gateway.ts` |
| Tests | `package/domain-core/tests/notifications/*`, workflow test files |

---

## Appendix C — Open questions (updated)

| # | Question | Decision / status |
|---|----------|-------------------|
| 1 | System actor for automated announcements | **Deferred** — event notifications enqueue without creating `Announcement` rows (G4) |
| 2 | App-channel visibility before webapp UI | **Deferred** — `MessageDelivery` App rows materialized on publish; no inbox UI (Phase 6) |
| 3 | Per-school assessment lead time | **Hardcoded** — `ASSESSMENT_DUE_SOON_LEAD_DAYS = 3` in `assessment-due-soon.ts` |
| 4 | Queue vs cron on Workers | **Decided** — `apps/cron` Worker with daily cron trigger |
| 5 | Single vs multi-channel on publish | **Decided** — App only on `publishAnnouncement`; other channels remain explicit `materializeDeliveries` calls |

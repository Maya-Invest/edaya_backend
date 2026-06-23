# Notifications Feature — Sprint Plan

> **Status:** Planned  
> **Created:** 2026-06-22  
> **Scope:** Notification gateway port, trigger infrastructure (entity hooks + workflow hooks), and first vertical slices for three announcement kinds  
> **Related domain:** `packages/core/src/domains/messaging/` (`Announcement`, `AnnouncementTarget`, `MessageDelivery`)

This plan introduces a **notification gateway** as a core port, wires **event-based triggers** through `ManagedEntityService` hooks and **workflow post-actions**, and reserves **job-based scheduling** for a follow-on phase once the gateway and delivery pipeline exist.

The work is incremental. Each phase must be mergeable on its own. No phase requires a feature freeze.

---

## 1. Notification kinds

| Kind | Trigger | Examples | Primary integration point |
|------|---------|----------|---------------------------|
| **Ad-hoc** | Staff publishes communication to a defined audience | School-wide notice, class message, guardian alert | Existing `CommunicationsServiceWorkflow` (`createAnnouncement` → `addTarget` → `publishAnnouncement` → `materializeDeliveries`) |
| **Event-based** | Domain state change after a command or save | Attendance recorded, incident logged, marks entered, report card published | Workflow post-actions first; entity `postSave` hooks for direct-save paths |
| **Job-based** | Time / schedule (cron or deferred queue) | Upcoming assessment due in 3 days, activity tomorrow, fee overdue reminder | Scheduled processor calling gateway with `deliverAfter`; no entity mutation required |

### Relationship to existing messaging domain

The codebase already models ad-hoc communications:

- `Announcement` — content, priority, `premiumNotification`, publish lifecycle
- `AnnouncementTarget` — audience (`ClassGroup`, `AllGuardians`, `Student`, …)
- `MessageDelivery` — per-recipient, per-channel delivery state (`App`, `Email`, `Sms`, `WhatsApp`)

Guardian preferences already exist: `receivesAttendanceAlerts`, `receivesAcademicReports`, `premiumNotificationsEnabled`, `allowsNotifications` on contact methods.

**Decision for this sprint:** treat `Announcement` + `MessageDelivery` as the **persistence model for all three kinds**. Event- and job-based notifications create or update announcement records (often system-authored) and materialize deliveries through the gateway—not a parallel notification table in phase 1.

---

## 2. Outcomes

When phases 0–4 of this plan are complete:

1. `@edaya/core` exposes a `NotificationGatewayPort` with a small, testable method surface.
2. `ServiceArgs` / `SchoolApplication` / `BaseSchoolService` receive the port; tests use a no-op or in-memory recorder adapter.
3. A **trigger registry** maps domain events to gateway calls without coupling entity configs to channel providers.
4. **Workflow post-actions** are the default trigger for multi-step commands; **entity `postSave` hooks** cover direct CRUD paths that bypass workflows.
5. Ad-hoc `publishAnnouncement` flows through the gateway (materialize + enqueue), replacing silent no-ops.
6. At least one **event-based** vertical (report card published) and one **ad-hoc** path are end-to-end tested in core.

Phases 5–6 (job scheduler, external providers, webapp inbox) are scoped but deferred until the gateway pipeline is proven.

### Success metrics

| Metric | Baseline | Target (after phase 4) |
|--------|----------|-------------------------|
| Notification port in core | None | `NotificationGatewayPort` exported from `packages/core/src/ports` |
| Gateway wired in `ServiceArgs` | N/A | All `SchoolService` instances receive gateway |
| `publishAnnouncement` delivery | Saves announcement only; deliveries materialized on demand | Gateway enqueued after materialize |
| Event trigger coverage | None | ≥1 workflow trigger + registry unit tests |
| `bun run verify` | Green | Remains green |

---

## 3. Guardrails and non-goals

Hard constraints for every phase:

- Do not send real email/SMS/WhatsApp in core or unit tests; use port adapters only.
- Do not block `ManagedEntityService.save` on external provider latency—gateway `enqueue` must be fast and idempotent (outbox-style).
- Do not change public HTTP paths, GraphQL field names, or existing announcement/delivery payloads in early phases.
- Do not add database migrations until the announcement/delivery model proves insufficient (phase 1 reuses existing tables).
- Keep ports-and-adapters layout: gateway interface in `@edaya/core`, provider implementations in `apps/api` or `integrations/`.
- Preserve authorization: notification triggers run **after** `authorizeSave` / workflow `authorize`—never leak cross-tenant recipients.
- Respect guardian opt-outs: `receivesAttendanceAlerts`, `allowsNotifications`, `premiumNotificationsEnabled` filter recipients at gateway or resolver layer.

### Non-goals (this initiative)

- Webapp notification center UI (separate sprint; follow `specs/app-shell-spec.md` when started).
- Push notification device tokens.
- Provider-specific templates (SendGrid, Twilio, etc.) beyond a logging/no-op adapter.
- Replacing `CommunicationsServiceWorkflow` audience resolution—reuse `resolveRecipients` logic.

---

## 4. Architecture

### 4.1 Notification gateway port (phase 1)

Add `packages/core/src/ports/notification-gateway.ts` and export from `packages/core/src/ports/index.ts`.

Proposed surface (refine during implementation; keep minimal):

```typescript
export type NotificationKind = 'ad_hoc' | 'event' | 'job'

export interface NotificationRecipient {
  kind: MessageDeliveryRecipientKind
  id: string
}

export interface NotificationEnqueueInput {
  /** Stable key for deduplication, e.g. `report-card-published:{resultId}` */
  idempotencyKey: string
  schoolId: string
  kind: NotificationKind
  /** Links to Announcement when materialized; optional for enqueue-only paths */
  announcementId?: string
  /** Template / event identifier for logging and provider mapping */
  eventKey: string
  title: string
  body: string
  recipients: NotificationRecipient[]
  channels?: MessageDeliveryChannel[]
  priority?: AnnouncementPriority
  premium?: boolean
  deliverAfter?: Date
  expiresAt?: Date
  metadata?: Record<string, string>
}

export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
}
```

Optional later methods (phase 5+): `processDue(asOf: Date)`, `markSent`, `markFailed`—only if the outbox lives behind the gateway adapter rather than in `MessageDelivery` status transitions.

Follow the `AtomicExecutionPort` pattern: interface only in core, implementations in API runtime.

### 4.2 Wiring through school services

Extend `ServiceArgs` (`packages/core/src/shared/service-args.ts`):

```typescript
export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
}
```

Thread through:

- `SchoolApplication` → `SchoolService` → `BaseSchoolService`
- `createCoreEntityServices` / entity config factories only if hooks need gateway (via factory input, not global singleton)

Provide adapters:

| Adapter | Location | Use |
|---------|----------|-----|
| `NoOpNotificationGateway` | `packages/core` test support | Default in unit tests |
| `RecordingNotificationGateway` | `packages/core` test support | Assert enqueue calls |
| `LoggingNotificationGateway` | `apps/api` runtime | Dev/staging |
| `MessageDeliveryNotificationGateway` | `apps/api` or adaptor | Phase 2+: writes `MessageDelivery`, invokes provider |

### 4.3 Entity hooks vs workflow hooks

```text
                    ┌─────────────────────────────┐
                    │   NotificationGatewayPort   │
                    │         enqueue()           │
                    └──────────────▲──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼────────┐
    │ Workflow post-    │ │ Entity postSave │ │ Job scheduler   │
    │ action hooks      │ │ hooks (registry)│ │ (phase 5)       │
    └─────────▲─────────┘ └───────▲────────┘ └────────▲────────┘
              │                    │                    │
    publishReportCardResult   direct Assessment.save   cron / queue
    recordSessionAttendance   (bypasses workflow)      scan due dates
    publishAnnouncement
```

#### When to use workflow hooks (preferred for events)

Use **workflow post-action hooks** when:

- The command orchestrates multiple entities (`recordSessionAttendance` → many `AttendanceRecord`s).
- Business rules gate the notification (`publishReportCardResult` only when status becomes `Published`).
- Recipient resolution needs workflow context (class group, guardian links, enrollment).
- The public API exposes only the workflow, not direct entity save.

**Implementation pattern:** add optional `after*` callbacks or a small `WorkflowNotificationHooks` registry invoked at the end of workflow methods—**not** inside `ManagedEntityService` for these paths.

Candidate workflow triggers (prioritized):

| Workflow | Method | Event key | Audience |
|----------|--------|-----------|----------|
| `AssessmentsServiceWorkflow` | `publishReportCardResult` | `report_card.published` | Student + guardians (`receivesAcademicReports`) |
| `SchedulingServiceWorkflow` | `recordSessionAttendance`, `recordClassDailyAttendance` | `attendance.recorded` | Guardians (`receivesAttendanceAlerts`) for absent/late |
| `BehaviorServiceWorkflow` | `recordIncident`, `addStudentInvolvement` | `incident.recorded` | Configurable; start with guardians of involved students |
| `AssessmentsServiceWorkflow` | `recordAssessmentResult` | `assessment.result_recorded` | Student + guardians |
| `CommunicationsServiceWorkflow` | `publishAnnouncement` | `announcement.published` | Resolved targets (existing) |

#### When to use entity `postSave` hooks

Use **entity hooks** (`EntityBusinessHooks.postSave` in `ManagedEntityService`) when:

- Clients can save the entity directly via REST/GraphQL entity endpoints.
- The notification predicate is a simple state transition on one entity (`status` draft → published, `dueAt` set).
- No extra orchestration is required.

Register hooks in entity config factories (`announcementConfig`, `assessmentConfig`, …) via a shared **notification trigger registry** to avoid copy-paste.

**Caveat:** `postSave` runs inside the write transaction. The hook must only call `notificationGateway.enqueue` (fast, in-process) or write outbox rows in the same transaction—never await external APIs.

#### Decision summary

| Source | Use workflow hook | Use entity postSave |
|--------|-------------------|---------------------|
| Report card published | **Yes** — workflow-only command | No |
| Attendance recorded | **Yes** — batch + guardian resolution | Optional mirror on `AttendanceRecord` if direct save allowed |
| Announcement published | **Yes** — `publishAnnouncement` | Mirror on `Announcement` only if direct publish via save is possible |
| Assessment due date changed | No | **Yes** — schedule job notification |
| Calendar event created | No | **Yes** — schedule job notification |

### 4.4 Job-based notifications (phase 5 preview)

Job-based notifications do not belong in `postSave` long-term. Pattern:

1. Entity hook or workflow registers a **scheduled intent** (`deliverAfter`, `idempotencyKey`) via gateway.
2. Cloudflare Worker cron or queue consumer (new `apps/api` entry) calls `processDue`.
3. Processor queries domain (assessments due within N days, activities starting tomorrow) idempotently.

`wrangler.toml` has no cron triggers today—phase 5 adds `[[triggers]]` or a queue binding.

---

## 5. Phase tracker

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | Event catalog and trigger matrix | Planned |
| 1 | `NotificationGatewayPort` + test adapters | Planned |
| 2 | Wire gateway into `ServiceArgs` / `BaseSchoolService` | Planned |
| 3 | Notification trigger registry + entity `postSave` infrastructure | Planned |
| 4 | Workflow post-action hooks + first vertical slices | Planned |
| 5 | Job scheduler + date-based scanners | Deferred |
| 6 | Provider adapters + webapp inbox | Deferred |

### Dependency order

```text
Phase 0 ─> Phase 1 ─> Phase 2 ─┬─> Phase 3 ─> Phase 4
                                └─> Phase 5 (after 4)
                                         └─> Phase 6
```

---

## Phase 0 — Event catalog and design spike

**Goal:** Agree on event keys, idempotency rules, and hook placement before writing code.

### 0.1 Inventory triggers

- [ ] List all notification-worthy domain transitions (attendance, incidents, marks, report cards, homework, fees, activities, assessments).
- [ ] For each, record: public entry point (workflow command vs entity save), recipient resolver, opt-out flags, channels.
- [ ] Map each to `NotificationKind` and proposed `eventKey`.

### 0.2 Reuse vs extend messaging model

- [ ] Confirm system-authored announcements (event/job) use `createdBy: null` or a dedicated system actor id.
- [ ] Decide whether event notifications create a new `Announcement` per event or per batch (recommend: per logical event with `eventKey` in metadata).
- [ ] Document idempotency key format: `{eventKey}:{entityId}:{transition}`.

### 0.3 Spike: hook placement proof

- [ ] Trace `publishReportCardResult` and `recordSessionAttendance` call graphs; confirm workflow hook insertion points.
- [ ] Trace direct entity save paths in OpenAPI `allowDirectSave` metadata; note which entities need `postSave` mirrors.

### Exit criteria

- [ ] Trigger matrix reviewed and stored in this doc (appendix) or `docs/notifications-triggers.md`.
- [ ] No open questions on gateway method surface.

---

## Phase 1 — Notification gateway port

**Goal:** Define the port and test doubles without changing runtime behavior.

### 1.1 Port definition

- [ ] Add `packages/core/src/ports/notification-gateway.ts` with `NotificationEnqueueInput`, `NotificationGatewayPort`.
- [ ] Export from `packages/core/src/ports/index.ts`.
- [ ] Add domain re-exports for `MessageDeliveryChannel`, `MessageDeliveryRecipientKind`, `AnnouncementPriority` in port types (import from domains, do not duplicate enums).

### 1.2 Test adapters

- [ ] `NoOpNotificationGateway` — resolves immediately.
- [ ] `RecordingNotificationGateway` — stores inputs for assertions.
- [ ] Unit tests for idempotency key handling (adapter may dedupe; document contract).

### Exit criteria

- [ ] Port and adapters live in `@edaya/core`.
- [ ] `bun run verify` passes (no runtime wiring yet).

---

## Phase 2 — Wire gateway into school services

**Goal:** Every `SchoolService` instance can call the gateway; tests updated.

### 2.1 Extend `ServiceArgs`

- [ ] Add `notificationGateway: NotificationGatewayPort` to `ServiceArgs`.
- [ ] Add `readonly notificationGateway` on `BaseSchoolService`.
- [ ] Update `create-test-app.ts` and all `ServiceArgs` construction sites to pass `NoOpNotificationGateway` or `RecordingNotificationGateway`.

### 2.2 API runtime

- [ ] Instantiate `LoggingNotificationGateway` (or no-op) in `apps/api` school application bootstrap.
- [ ] Ensure worker and node entrypoints share the same factory.

### Exit criteria

- [ ] All core tests pass with gateway in args.
- [ ] No product behavior change yet (no-op adapter in production until phase 4).

---

## Phase 3 — Entity hook infrastructure

**Goal:** Pluggable `postSave` notification triggers without per-entity boilerplate.

### 3.1 Trigger registry

- [ ] Add `packages/core/src/notifications/notification-trigger-registry.ts`:
  - Register `(entityKey, predicate, resolver)` tuples.
  - `predicate(entity, existing)` → boolean (state transition detected).
  - `resolver(entity, existing, context)` → `NotificationEnqueueInput | null`.
- [ ] Add `createNotificationPostSaveHook(entityKey)` returning `EntityBusinessHooks.postSave` that consults the registry.

### 3.2 Entity config integration

- [ ] Extend `EntityConfigFactoryInput` to accept `notificationGateway` (or full trigger context).
- [ ] Wire registry hook into `createCoreEntityServices` for entities in the trigger matrix (start with `assessments` for due-date job intents only in phase 3—enqueue with `deliverAfter`, no scheduler yet).

### 3.3 Tests

- [ ] Unit test: predicate fires only on transition, not on no-op save.
- [ ] Unit test: registry respects school tenant from entity.

### Exit criteria

- [ ] At least one entity uses the registry hook in tests.
- [ ] `ManagedEntityService` tests still pass; hook runs after repository save.

---

## Phase 4 — Workflow hooks and first vertical slices

**Goal:** Event-based and ad-hoc notifications enqueue through the gateway in real commands.

### 4.1 Workflow notification runner

- [ ] Add `packages/core/src/notifications/workflow-notification-runner.ts`:
  - Accepts `notificationGateway`, `repositories`, `actor`.
  - `runWorkflowTriggers(eventKey, context)` dispatches registered workflow handlers.
- [ ] Keep handlers colocated by domain: `notifications/handlers/report-card.ts`, `attendance.ts`, `communications.ts`.

### 4.2 Ad-hoc: `publishAnnouncement`

- [ ] After `materializeDeliveries` (or inside `publishAnnouncement`), call gateway with `kind: 'ad_hoc'`, recipients from materialized deliveries.
- [ ] Reuse existing `CommunicationsServiceWorkflow.resolveRecipients` / delivery materialization.
- [ ] Extend `communications-workflows.test.ts` with `RecordingNotificationGateway` assertion.

### 4.3 Event-based: report card published

- [ ] Add workflow trigger on `AssessmentsServiceWorkflow.publishReportCardResult`.
- [ ] Resolve guardians via `guardianLinks` + `receivesAcademicReports`.
- [ ] Idempotency key: `report_card.published:{resultId}`.
- [ ] Test in assessments workflow tests.

### 4.4 Event-based: attendance (stretch)

- [ ] Add workflow trigger on `recordSessionAttendance` / `recordClassDailyAttendance` for absent/late statuses.
- [ ] Filter guardians with `receivesAttendanceAlerts` and `allowsNotifications` on preferred contact method.
- [ ] Idempotency key per `(studentId, sessionId, status)`.

### 4.5 Production adapter

- [ ] Replace no-op with `MessageDeliveryNotificationGateway` that transitions `MessageDelivery` from `Pending` → `Sent`/`Failed` (in-process log stub acceptable for staging).

### Exit criteria

- [ ] `publishAnnouncement` enqueues notifications in tests.
- [ ] `publishReportCardResult` enqueues notifications in tests.
- [ ] `bun run verify` green.
- [ ] No regression in communications workflow tests.

---

## Phase 5 — Job-based scheduler (deferred)

**Goal:** Date-based notifications without manual staff action.

### 5.1 Scheduled intents

- [ ] Gateway stores or marks deliveries with `deliverAfter` (may use `MessageDelivery` + metadata or a thin `notification_schedule` table if needed).
- [ ] Entity hooks on `Assessment`, `HomeworkAssignment`, `CalendarEvent`, `ExtracurricularActivity` register schedules when dates are set/changed; `cancel` on delete or date change.

### 5.2 Worker cron / queue

- [ ] Add cron trigger to `apps/api/wrangler.toml` (e.g. every 15 minutes).
- [ ] Implement `scheduled` handler: school-scoped scan or process due enqueue records.
- [ ] Idempotent processing per `idempotencyKey`.

### 5.3 Initial job types

- [ ] Assessment due in N days (configurable per school later; hardcode N=3 initially).
- [ ] Extracurricular activity reminder 24h before start.

### Exit criteria

- [ ] Staging cron runs; due notifications enqueue without duplicate sends.
- [ ] Integration test with frozen clock.

---

## Phase 6 — Providers and webapp (deferred)

- [ ] Email/SMS provider adapters behind gateway.
- [ ] Webapp notification inbox (app channel); mark read via `MessageDelivery.readAt`.
- [ ] Staff UI for ad-hoc announcements (may already exist partially—align with `specs/app-shell-spec.md`).

---

## 6. Testing strategy

| Layer | What to test |
|-------|----------------|
| Port adapters | Enqueue, cancel, deduplication |
| Trigger registry | Predicate transitions, tenant isolation |
| Workflow handlers | Recipient resolution, opt-out flags |
| Communications integration | Publish → materialize → enqueue |
| API runtime | Gateway wired for actor-scoped service |
| Job processor (phase 5) | Time-based idempotency |

Avoid testing provider HTTP in core; use recording gateway and delivery status assertions.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Double send (hook + workflow) | One trigger per event key; document entry points; idempotency keys |
| `postSave` slows writes | Enqueue only; no external I/O in core |
| Direct entity save bypasses workflow | Registry hooks on entities with `allowDirectSave` |
| Guardian spam | Opt-out flags + per-event debounce keys |
| Cross-tenant leakage | Gateway validates `recipient.schoolId` via repository lookups |

---

## 8. Suggested PR sequence

1. **PR 1 (phase 0–1):** Port + test adapters only.  
2. **PR 2 (phase 2):** Wire `ServiceArgs`; no-op in production.  
3. **PR 3 (phase 3):** Trigger registry + one entity hook (assessment due-date intent).  
4. **PR 4 (phase 4a):** Workflow runner + `publishAnnouncement` integration.  
5. **PR 5 (phase 4b):** Report card + attendance workflow triggers.  
6. **PR 6 (phase 5):** Cron + job scanners (separate sprint if needed).

Each PR should keep `bun run verify` green.

---

## Appendix A — Initial trigger matrix (draft)

| eventKey | Kind | Entry point | Recipients | Opt-out |
|----------|------|-------------|------------|---------|
| `announcement.published` | ad_hoc | `communicationsWorkflow.publishAnnouncement` | Resolved targets | `allowsNotifications`, premium flags |
| `report_card.published` | event | `assessmentsWorkflow.publishReportCardResult` | Student, linked guardians | `receivesAcademicReports` |
| `attendance.recorded` | event | `schedulingWorkflow.recordSessionAttendance` | Linked guardians | `receivesAttendanceAlerts` |
| `incident.recorded` | event | `behaviorWorkflow.recordIncident` | Involved students' guardians | TBD |
| `assessment.result_recorded` | event | `assessmentsWorkflow.recordAssessmentResult` | Student, guardians | `receivesAcademicReports` |
| `assessment.due_soon` | job | Assessment `postSave` + scheduler | Class students + guardians | Same as academic |
| `activity.reminder` | job | Activity `postSave` + scheduler | Enrolled students + guardians | TBD |
| `homework.due_soon` | job | Homework `postSave` + scheduler | Class students + guardians | TBD |

---

## Appendix B — Key files to touch

| Area | Files |
|------|-------|
| Port | `packages/core/src/ports/notification-gateway.ts`, `ports/index.ts` |
| Service wiring | `packages/core/src/shared/service-args.ts`, `base-school-service.ts`, `school-application.ts` |
| Entity hooks | `packages/core/src/services/core-entity-catalog.ts`, domain `*Config` factories |
| Workflows | `packages/core/src/services/service-workflows/{communications,assessments,scheduling,behavior}.ts` |
| Notifications module | `packages/core/src/notifications/*` (new) |
| API runtime | `apps/api/src/lib/school-api/application.ts`, runtime bootstrap |
| Tests | `packages/core/tests/support/create-test-app.ts`, workflow test files |

---

## Appendix C — Open questions (resolve in phase 0)

1. System actor id for automated announcements (`createdBy` sentinel vs nullable).
2. Whether app-channel deliveries appear in webapp before phase 6 UI.
3. Per-school notification lead times (assessment due days) — config entity or hardcode.
4. Queue vs cron-only for job processing on Cloudflare Workers.

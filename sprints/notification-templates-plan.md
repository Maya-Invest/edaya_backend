# School Notification Templates — Sprint Plan

> **Status:** Not started  
> **Created:** 2026-06-24  
> **Scope:** Per-school notification templates (email + in-app), including **account invitations**; platform defaults seeded as **one document per school** at **school creation**; render on Edaya side **before** Novu enqueue  
> **Depends on:** Notifications Phases 1–6 (`NotificationGatewayPort`, workflow handlers, Novu bootstrap), account invitation flow  
> **Related:** [notifications-plan.md](./notifications-plan.md), [account-invitation-plan.md](./account-invitation-plan.md), `package/adaptor-novu/bootstrap/`

---

## 1. Problem and goal

Today notification **content** is assembled in code (hardcoded strings in handlers/cron) or copied from announcement entities. Novu workflows are **shared passthrough** steps (`{{payload.title}}`, `{{payload.body}}`). Schools cannot customize wording, branding, or layout.

**Goal:**

1. Each school owns one **notification template document** — a fixed catalog of templates keyed by `eventKey` (same id as Novu workflow trigger).
2. **Platform defaults** (from repo HTML/text) are **copied into that document** when the school is created (**one insert**).
3. At send time, Edaya **renders** the school’s template slice with event variables, then enqueues **final** `title` / `body` to Novu (and invitation delivery).
4. Novu bootstrap stays generic — no per-school Novu workflows.

**Non-goal (this sprint):** WYSIWYG editor, MJML pipeline, SMS templates, per-recipient template overrides, A/B testing.

---

## 2. Architecture (locked)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Platform default document (domain-core, HTML/text → JSON shape)          │
│   → copied once at registerSchool → ONE row per school (JSONB)         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Send path (handler / cron / invitation workflow)                         │
│   1. Load school template document (cached per request)                  │
│   2. Pick templates[templateKey][channel]                                │
│   3. render(slice, variables) → subject + body                           │
│   4. enqueue({ title, body }) OR invitationDelivery.deliver({ … })       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Novu (unchanged) — workflow steps echo payload.title / payload.body      │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Responsibility |
|-------|----------------|
| **domain-core** | Entity (one row/school), Zod document schema, defaults, render, seed on school create |
| **adaptor-novu bootstrap** | Platform Novu passthrough workflows only |
| **webapp** | Admin UI to view/edit the school document (later phase) |
| **Novu dashboard** | Not used for per-school copy |

### Why one row per school

The notification catalog is **fixed and known upfront** (~10 keys). A single JSON document per school is simpler to seed, load, reset, and edit than 19 normalized rows. Partial updates use read–modify–write on the document (one command, optimistic concurrency via `updatedAt`).

---

## 3. Domain model

### 3.1 `SchoolNotificationTemplates`

New table `school_notification_templates` — **at most one row per school**.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | string | **PK** (or unique; no separate surrogate id required) |
| `templates` | JSONB | Full catalog — see §3.2 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Optimistic concurrency on save |

**Entity name:** `schoolNotificationTemplates` (singular resource per school).

**Entity config:** read via entity API (`get` by schoolId / list one for actor’s school); writes via **commands** only; permission **`SCHOOL_CONFIGURATION_MANAGE`**.

### 3.2 Document shape (Zod-validated)

```typescript
type NotificationChannelTemplate = {
  subject?: string   // email subject / in-app title
  body: string       // HTML (email) or plain text (in_app)
}

type NotificationTemplateKey = typeof NOTIFICATION_TEMPLATE_KEYS[number]

type SchoolNotificationTemplateDocument = {
  [K in NotificationTemplateKey]: {
    email?: NotificationChannelTemplate
    in_app?: NotificationChannelTemplate
  }
}
```

**Example (abbreviated):**

```json
{
  "announcement.published": {
    "email": { "subject": "{{announcementTitle}}", "body": "<p>{{announcementBody}}</p>" },
    "in_app": { "subject": "{{announcementTitle}}", "body": "{{announcementBody}}" }
  },
  "account_invitation": {
    "email": {
      "subject": "You're invited to join {{schoolName}} on Edaya",
      "body": "<p>Hello {{inviteeName}},</p><p><a href=\"{{inviteUrl}}\">Accept invitation</a></p>"
    }
  }
}
```

Keys are **required** in the schema — every school document must contain the full catalog. Optional channels per key (`account_invitation` has `email` only; no `in_app`).

Export `NOTIFICATION_TEMPLATE_KEYS` and `schoolNotificationTemplateDocumentSchema` from domain-core (keep in sync with `NOVU_NOTIFICATION_WORKFLOW_IDS` + `account_invitation`).

### 3.3 Template catalog (`templateKey`)

| `templateKey` | Channels | Source today |
|---------------|----------|--------------|
| `announcement.published` | email, in_app | Handler uses announcement title/content |
| `report_card.published` | email, in_app | Workflow handler |
| `attendance.recorded` | email, in_app | Workflow handler |
| `assessment.result_recorded` | email, in_app | Workflow handler |
| `incident.recorded` | email, in_app | Workflow handler |
| `assessment.due_soon` | email, in_app | Cron trigger |
| `homework.due_soon` | email, in_app | Cron trigger |
| `activity.reminder` | email, in_app | Cron trigger |
| `calendar.event_reminder` | email, in_app | Cron trigger |
| `account_invitation` | **email only** | Invitation delivery (pre-account) |

### 3.4 Default document (platform)

**Single source of truth:** `package/domain-core/src/notifications/templates/defaults/`

```
defaults/
  manifest.ts              # builds full default document
  emails/
    announcement.published.html
    account-invitation.html
    …
  subjects/
    account-invitation.txt
    attendance.recorded.txt
    …
  in-app/
    announcement.published.txt
    …
```

- Migrate content from `package/adaptor-novu/bootstrap/templates/` into domain-core (bootstrap **syncs** with a parity test — **domain-core owns** defaults).
- `buildDefaultNotificationTemplateDocument(): SchoolNotificationTemplateDocument` — pure function, no DB.

### 3.5 Variable contracts

Per `templateKey`, document allowed placeholders in `templates/variables.ts`:

| `templateKey` | Example variables |
|---------------|-------------------|
| `announcement.published` | `{{schoolName}}`, `{{announcementTitle}}`, `{{announcementBody}}` |
| `attendance.recorded` | `{{schoolName}}`, `{{studentName}}`, `{{status}}`, `{{sessionTitle}}` |
| `account_invitation` | `{{schoolName}}`, `{{inviteeName}}`, `{{inviteUrl}}`, `{{expiresAt}}`, `{{actorKind}}` |
| … | Full list in code |

**Render engine:** minimal `{{key}}` string replace on `subject` and `body`. Unknown keys **left as-is** (visible in preview).

**Locale (deferred):** Phase 1 uses a single document per school (implicit default locale). Later: `templatesByLocale: { en: Document, fr: Document }` on the same row, or school-level locale picker — without splitting into many rows.

---

## 4. Seeding at school creation

### 4.1 Hook

After successful `SetupServiceWorkflow.registerSchool`:

```typescript
await seedSchoolNotificationTemplates(repositories, school.id)
// → one insert: { schoolId, templates: buildDefaultNotificationTemplateDocument() }
```

Also runs for:

- `POST /core/onboarding/register-school` (via `registerSchool`)
- Platform `registerSchool` command

**Idempotent:** if a row already exists for `schoolId`, skip (do not overwrite customizations).

### 4.2 Existing schools

One-time backfill:

```bash
bun run scripts/backfill-notification-templates.ts
```

For each school without a row → insert default document.

---

## 5. Integration points

### 5.1 `NotificationTemplateService`

```typescript
interface NotificationTemplateService {
  render(input: {
    schoolId: string
    templateKey: NotificationTemplateKey
    channel: 'email' | 'in_app'
    variables: Record<string, string>
  }): Promise<{ subject?: string; body: string }>
}
```

Implementation: load school row → `document.templates[templateKey][channel]` → substitute variables.

### 5.2 Workflow notification handlers

Replace hardcoded `title` / `body` in all workflow handlers. Render **per channel** when email and in-app differ (two slices from same document).

### 5.3 Cron / job triggers

Wire template service into assessment/homework/activity/calendar triggers.

### 5.4 Account invitations

Render `templates.account_invitation.email` in `AccountInvitationServiceWorkflow` before `invitationDelivery.deliver`. Extend `InvitationDeliveryInput` with rendered `emailSubject` + `emailBody`.

### 5.5 Context

Add `templateService` to `WorkflowNotificationContext` / `BaseSchoolService`.

---

## 6. API & webapp

### 6.1 Commands

| Command | Permission | Purpose |
|---------|------------|---------|
| `updateSchoolNotificationTemplates` | `SCHOOL_CONFIGURATION_MANAGE` | Patch one or more keys/channels in the document |
| `resetSchoolNotificationTemplates` | same | Reset entire document, or one `templateKey`, to platform defaults |

Commands validate the **merged document** against `schoolNotificationTemplateDocumentSchema` before save.

### 6.2 Entity API

| Entity | Notes |
|--------|-------|
| `schoolNotificationTemplates` | `get` / `list` (one row per school); `allowDirectSave: false` |

Query filter: `schoolId` (tenant-scoped). Response is the full document.

### 6.3 Webapp (Phase 4)

- **Settings → Notifications → Templates**
- Load single document; UI groups by category (Communications, Academic, Attendance, Invitations)
- Edit modal per `templateKey` + channel; save sends patch command
- Preview with sample variables; reset one key or all

---

## 7. Novu bootstrap role (unchanged)

Passthrough workflows only. After render, email body may be full HTML from the school document — bootstrap can simplify to a thin wrapper around `{{payload.body}}`.

---

## 8. Outcomes

| # | Outcome | Acceptance |
|---|---------|------------|
| O1 | One row per school with JSONB document | Migration + store + Zod tests |
| O2 | Default document seeded on `registerSchool` | Single insert with full catalog |
| O3 | Render service | Unit tests per templateKey × channel |
| O4 | All send paths use render | No hardcoded enqueue strings |
| O5 | Invitation uses school email slice | Custom invite body in delivery |
| O6 | Admin can edit document | Commands + webapp |
| O7 | Backfill existing schools | Script + docs |

---

## 9. Phased delivery

**Total ~6–7 days.**

### Phase 1 — Domain + defaults + seed (1.5 days)

- [ ] Entity + Zod document schema + migration `0019_school_notification_templates.sql` (`schoolId` PK, `templates` JSONB)
- [ ] Default HTML/text → `buildDefaultNotificationTemplateDocument()`
- [ ] `NotificationTemplateService.render`
- [ ] `seedSchoolNotificationTemplates` + hook in `registerSchool`
- [ ] Unit tests: schema, render, seed idempotency

**Done when:** new school has **one row** whose `templates` object contains all catalog keys.

### Phase 2 — Wire send paths (2 days)

- [ ] Handlers + cron triggers + invitation delivery
- [ ] Integration tests: patched document → custom enqueue body

### Phase 3 — API (1 day)

- [ ] Commands (patch + reset) + entity registry + OpenAPI
- [ ] Backfill script

### Phase 4 — Webapp (1.5 days)

- [ ] Settings editor (document load, per-key patch save)

### Phase 5 — Hardening (0.5 day)

- [ ] Parity test: default document ↔ bootstrap HTML
- [ ] `docs/local-dev.md`

---

## 10. Test plan

| Layer | Cases |
|-------|-------|
| Schema | Valid/invalid documents; missing keys rejected |
| Render | Variable substitution; missing channel throws clear error |
| Seed | One row created; second registerSchool skipped |
| Commands | Patch one key; reset one key; reset all |
| Handlers | Custom body in enqueue payload |
| Backfill | Schools without row get default document |

---

## 11. Decisions (locked)

| # | Decision |
|---|----------|
| 1 | **One row per school** with JSONB `templates` document |
| 2 | **Fixed catalog** — all keys required in every document |
| 3 | **Fragment** HTML in `body`; no full `<html>` wrapper required |
| 4 | **Permission** — `SCHOOL_CONFIGURATION_MANAGE` |
| 5 | **Defaults** — domain-core owns files; bootstrap syncs |
| 6 | **Existing schools** — backfill script only |
| 7 | **Locale** — deferred; single document until product needs `fr` |

---

## 12. File touch list (reference)

| Area | Files |
|------|-------|
| Domain entity | `domains/messaging/school-notification-templates.ts` (new) |
| Schema | `notifications/templates/document-schema.ts`, `defaults/`, `variables.ts` |
| Service | `notifications/notification-template-service.ts`, `seed-school-notification-templates.ts` |
| Hook | `services/service-workflows/setup.ts` |
| Handlers / triggers / invitations | as before |
| Postgres | `drizzle/0019_school_notification_templates.sql` |
| API | commands, entity registry |
| Script | `scripts/backfill-notification-templates.ts` |

---

## 13. Relationship to other sprints

- **notifications-plan:** Content moves from handlers to school document; Novu unchanged.
- **account-invitation-plan:** `account_invitation.email` slice in the same document.
- **Novu bootstrap:** Platform passthrough only.

---

## Appendix — Catalog size (per school document)

| | Count |
|---|-------|
| Template keys | 10 |
| Channel slices | 19 (9 keys × 2 channels + 1 invitation email) |
| DB rows | **1** |

All 19 slices live inside the single `templates` JSON object.

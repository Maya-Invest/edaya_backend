# Novu bootstrap (infrastructure as code)

Declarative Novu setup for Edaya: **workflows** live in TypeScript and are applied idempotently via the Novu API.

This replaces manual dashboard setup for the primitives we control from code. Outbound delivery webhooks (status sync to `POST /webhooks/notification-delivery`) and email delivery (SMTP or other Novu integration) still require a Novu dashboard or API step — see [Manual follow-up](#manual-follow-up).

## Layout

```
bootstrap/
  cli.ts                 # apply | plan | validate
  catalog/
    workflows.ts         # all eventKey-aligned workflows
  lib/
    apply-workflows.ts   # create / update via novu.workflows.*
    env.ts               # loads apps/api/.env
    fingerprint.ts       # drift detection
    load-templates.ts    # reads templates/ at apply time
    templates.ts         # step builders (in-app stays inline)
  templates/
    emails/*.html        # Novu handlebars bodies ({{payload.*}}, {{context.*}})
    subjects/*.txt       # email subjects
```

## Commands

From repo root:

```sh
# Dry-run (default)
bun repo novu bootstrap

# Push to Novu Cloud
bun repo novu bootstrap apply

# Validate local catalog only
bun repo novu bootstrap validate
```

## Environment

Reads `apps/api/.env` when variables are not already exported.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NOVU_SECRET_KEY` | yes | Novu API auth |
| `NOVU_API_URL` | no | EU: `https://eu.api.novu.co` |

## Workflows

Trigger ids match core `eventKey` values (see `bootstrap/catalog/workflows.ts`):

- `announcement.published`, `report_card.published`, `attendance.recorded`, …
- `account_invitation` (email-only invite flow)
- `auth.otp`, `auth.email_verification` (Better Auth OTP + signup verification — no school tenant)

Standard notifications use **in-app + email** steps with `{{payload.title}}` / `{{payload.body}}`.

Email bodies live in `templates/emails/*.html`; subjects in `templates/subjects/*.txt`. Use Novu handlebars syntax — the bootstrap reads files at apply time and pushes the HTML string to Novu.

## Adding a workflow

1. Export the `eventKey` constant from `@edaya/core` (if new).
2. Add an entry to `catalog/workflows.ts`.
3. Add the id to `NOVU_NOTIFICATION_WORKFLOW_IDS` in `package/adaptor-novu/src/map-subscriber-preferences.ts` when subscribers should sync prefs.
4. Run `bun repo novu bootstrap validate` then `bun repo novu bootstrap apply`.

## Manual follow-up

Not yet managed by this bootstrap:

- **Email delivery** — configure a Novu email integration (e.g. Custom SMTP) in the Novu dashboard.
- **Outbound webhook** → `https://<api>/webhooks/notification-delivery` with `NOVU_WEBHOOK_SECRET` (Svix signing secret from Novu dashboard).
- **Production sync** — apply bootstrap against each Novu environment (dev/staging/prod API keys).

## Related

- Runtime adapter: `package/adaptor-novu/README.md`
- Smoke test: `bun repo smoke-test novu`

# Novu bootstrap (infrastructure as code)

Declarative Novu setup for Edaya: **workflows** and **email integrations** live in TypeScript and are applied idempotently via the Novu API.

This replaces manual dashboard setup for the primitives we control from code. Outbound delivery webhooks (status sync to `POST /webhooks/novu`) still require a Novu dashboard or API step — see [Manual follow-up](#manual-follow-up).

## Layout

```
bootstrap/
  cli.ts                 # apply | plan | validate
  catalog/
    workflows.ts         # all eventKey-aligned workflows
    integrations.ts      # email-webhook integration spec
  lib/
    apply-workflows.ts   # create / update via novu.workflows.*
    apply-integrations.ts
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
bun novu:bootstrap

# Push to Novu Cloud
bun novu:bootstrap:apply

# Validate local catalog only
bun novu:bootstrap:validate
```

## Environment

Reads `apps/api/.env` when variables are not already exported.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NOVU_SECRET_KEY` | yes | Novu API auth |
| `NOVU_API_URL` | no | EU: `https://eu.api.novu.co` |
| `NOVU_EMAIL_WEBHOOK_URL` | for email | `apps/novu-email-bridge` public URL |
| `NOVU_EMAIL_WEBHOOK_SECRET` | for email | HMAC secret (same as bridge) |
| `NOVU_EMAIL_FROM` | for email | Onboarded sender address |
| `NOVU_EMAIL_SENDER_NAME` | no | Default `Edaya` |

When email webhook env vars are omitted, workflows are still applied; the email integration step is skipped.

## Workflows

Trigger ids match core `eventKey` values (see `bootstrap/catalog/workflows.ts`):

- `announcement.published`, `report_card.published`, `attendance.recorded`, …
- `account_invitation` (email-only invite flow)

Standard notifications use **in-app + email** steps with `{{payload.title}}` / `{{payload.body}}`.

Email bodies live in `templates/emails/*.html`; subjects in `templates/subjects/*.txt`. Use Novu handlebars syntax — the bootstrap reads files at apply time and pushes the HTML string to Novu.

## Adding a workflow

1. Export the `eventKey` constant from `@edaya/core` (if new).
2. Add an entry to `catalog/workflows.ts`.
3. Add the id to `NOVU_NOTIFICATION_WORKFLOW_IDS` in `src/map-subscriber-preferences.ts` when subscribers should sync prefs.
4. Run `bun novu:bootstrap:validate` then `bun novu:bootstrap:apply`.

## Manual follow-up

Not yet managed by this bootstrap:

- **Outbound webhook** → `https://<api>/webhooks/novu` with `NOVU_WEBHOOK_SECRET` (Svix signing secret from Novu dashboard).
- **Production sync** — apply bootstrap against each Novu environment (dev/staging/prod API keys).

## Related

- Runtime adapter: `package/adaptor-novu/README.md`
- Email bridge: `apps/novu-email-bridge/README.md`
- Smoke test: `bun novu:smoke`

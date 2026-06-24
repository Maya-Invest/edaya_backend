# Novu Email Webhook → Cloudflare Email Service

Receives Novu's **Email Webhook** provider POSTs, verifies `X-Novu-Signature`, and sends mail via the Cloudflare `send_email` binding.

## Prerequisites

1. Cloudflare domain onboarded for Email Sending:

   ```sh
   npx wrangler email sending enable edaya.softilab.dev
   ```

2. Novu workflow with an **Email** step using the **Email Webhook** integration (Development env).

## Local dev

```sh
cp apps/novu-email-bridge/.dev.vars.example apps/novu-email-bridge/.dev.vars
# set NOVU_EMAIL_WEBHOOK_SECRET to match Novu integration

cd apps/novu-email-bridge
bun dev
```

Expose the worker publicly (Novu Cloud cannot reach localhost):

```sh
npx wrangler dev --env-file .dev.vars --remote
# or deploy to staging and use https://novu-email-staging.edaya.softilab.dev
```

## Novu dashboard

Integrations → Add provider → **Email Webhook**:

| Field | Value |
|-------|-------|
| Webhook URL | `https://novu-email-staging.edaya.softilab.dev` (or tunnel URL in local dev) |
| Secret Hmac Key | same as `NOVU_EMAIL_WEBHOOK_SECRET` |
| From email | `announcements@edaya.softilab.dev` (must use onboarded domain) |
| Sender name | `Edaya` |

Mark integration **Active**, then set the workflow email step to use **Email Webhook**.

## Alternative: SMTP (no Worker)

Novu → Integrations → **Custom SMTP**:

| Field | Value |
|-------|-------|
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` |
| Username | `api_token` |
| Password | Cloudflare API token with Email Sending permission |
| From | address on your onboarded domain |

SMTP is the fastest way to test email delivery without deploying this worker.

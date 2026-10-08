# Phone verification operations

Phone login and contact linking use the same Account policy in web, guardian and teacher. Launch accepts only Côte d’Ivoire mobile numbers: +225 followed by ten digits starting with 01, 05 or 07. Formatting spaces, parentheses, periods and hyphens are normalized. A destination without a configured SMS prefix returns `phone_country_unsupported` before preparing an OTP. The longest configured prefix wins; v1 supports the `africas_talking` provider only. North America/Twilio is deferred.

The first send uses Meta Cloud API in `whatsapp_first` mode or Africa’s Talking in `sms_only` mode. The user can resend the current channel or switch WhatsApp to SMS after cooldown. No status callback, timeout, poll, background job or process restart sends a message. There is no Cloudflare Workflow, queue or delivery outbox.

Each accepted phone request atomically prepares a fresh six-digit hashed OTP, supersedes earlier challenges for that recipient, reserves recipient/IP quotas, records an idempotency request and advances cooldown. Network delivery runs after commit with a ten-second timeout. A short transaction stores acceptance, failure or uncertainty. Provider acceptance does not prove handset delivery. OTP plaintext exists only in request memory. A crash before delivery leaves a pending challenge; after ten seconds status reports uncertainty. Explicit resend remains the recovery path.

Cooldown is 60 seconds after the first accepted request, 120 after the second and 300 thereafter. Login and linking share recipient state. Progression resets after an hour without an accepted request; cooldown rejections consume neither send quota nor progression. Limits remain five accepted requests per recipient/hour and twenty per IP/ten minutes. Failed guesses carry across superseded unexpired challenges; there are at most five guesses. OTP verification expires after five minutes. Pending unsuperseded metadata is retained for another hour so an expired code can still be replaced. Completed, superseded and exhausted challenges cannot be resent. Linking requires the same recently authenticated session on start, status, resend and verification.

## API contract

- `GET /auth/edaya/methods` advertises phone availability and countries; transports are not selectable login methods.
- `POST /auth/edaya/otp/start` and `identifiers/start`: `{kind,value,locale?,requestId?,recoveryEligible?}`. Locale defaults to `fr`; clients send `fr` or `en`. New clients generate a UUID `requestId`. Legacy initial `channel:"whatsapp"` remains an alias; Telegram returns `unsupported_channel`.
- `POST /auth/edaya/otp/resend`: `{challenge,action:"resend"|"sms",requestId}`. Destination, purpose, linking identity and recovery settings are retained by the server. A deliberate new action uses a fresh UUID; an uncertain HTTP retry uses the original UUID. Matching phone replays return the recorded challenge without another send; reuse for different input returns `idempotency_conflict`.
- `POST /auth/edaya/otp/status`: `{challenge}`. The response includes lifecycle, current channel, delivery status, expiry, `serverNow`, `nextResendAt` and permitted actions. It never returns the OTP, provider credentials or destination. Clients poll every three seconds only while the code screen is visible and the app is active.
- Delivery rejection or uncertainty still returns a usable `primary_required` challenge. The client keeps the verification screen open. Every accepted replacement clears the code field and instructs the user to use the latest code.
- Email, MFA, recovery, Account continuity, renewal sessions and resource tokens retain their existing behavior.

## Deployment setup

Apply `package/adaptor-account/drizzle/0001_phone_delivery.sql` through the existing Identity migration process before deploying. The new tables store cooldowns, idempotency requests and sanitized webhook receipts. The hourly cleanup removes expired metadata; challenge cleanup retains the additional hour. Keep existing Account encryption keys and provider generation stable.

Both Worker environments default to `PHONE_AUTH_MODE=disabled`. Configure an approved Africa’s Talking CI sender, `AFRICAS_TALKING_USERNAME`, the secret `AFRICAS_TALKING_API_KEY`, and `AFRICAS_TALKING_SENDER_ID`. Set `PHONE_SMS_ROUTES` to `[{"prefix":"+225","provider":"africas_talking"}]`. `AFRICAS_TALKING_SANDBOX` is for local testing only and is rejected in production. Enable `sms_only` while Meta approval is pending. An enabled mode rejects incomplete configuration at startup.

### Local Africa's Talking setup

Edit the existing gitignored `apps/api/.env`, preserving its database and Account settings. Set the following values (replace placeholders before enabling):

```dotenv
PHONE_AUTH_MODE=sms_only
PHONE_SMS_ROUTES='[{"prefix":"+225","provider":"africas_talking"}]'
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_API_KEY=YOUR_SANDBOX_API_KEY
AFRICAS_TALKING_SENDER_ID=YOUR_SANDBOX_SENDER_ID
AFRICAS_TALKING_SANDBOX=true
```

Use the key and sender configured in your [sandbox application](https://account.africastalking.com/apps/sandbox). Africa's Talking's [username guidance](https://help.africastalking.com/en/articles/2249244-what-is-my-username-and-api-key) specifies `sandbox` as the sandbox username; live authentication uses the application username, which can differ from its display name. Register a supported Côte d'Ivoire number in the [simulator](https://simulator.africastalking.com:1517/) and use that same number in EDAYA. Sandbox messages arrive in the simulator, as explained in the [provider's sandbox guide](https://help.africastalking.com/en/articles/1170660-how-do-i-get-started-on-the-africa-s-talking-sandbox).

Restart `bun dev` from the backend root, check `http://localhost:9999/auth/edaya/methods` for phone availability, and request an OTP through the normal login form. `bun run dev:test` captures SMS locally and does not call Africa's Talking, even when provider credentials are present. `SMS_TRANSPORT` controls school notifications, not this phone OTP integration.

For delivery to real phones during local development, replace the sandbox username/key/sender with the live application's values and set `AFRICAS_TALKING_SANDBOX=false`. A live key cannot be used with the sandbox endpoint. This application currently accepts only CI mobile numbers (`+225` followed by ten digits starting with `01`, `05`, or `07`).

### Staging Africa's Talking setup

Staging runs with `NODE_ENV=production`, so its current validation also rejects sandbox mode. Use a live application, a sender approved for Côte d'Ivoire, and sufficient SMS credit for real handset qualification. Keep `NODE_ENV=production`.

Merge these three fields into the existing gitignored `apps/api/secrets.staging.json`, preserving all existing secrets:

```json
{
  "AFRICAS_TALKING_USERNAME": "YOUR_LIVE_APPLICATION_USERNAME",
  "AFRICAS_TALKING_API_KEY": "YOUR_LIVE_API_KEY",
  "AFRICAS_TALKING_SENDER_ID": "YOUR_APPROVED_CI_SENDER_ID"
}
```

For coordinated GitHub releases, merge the same fields into the existing `STAGING_IDENTITY_SECRETS` JSON secret. The release merges it with `STAGING_API_SECRETS`; duplicate fields must agree. Keep phone mode in Wrangler configuration because staging preflight rejects `PHONE_AUTH_MODE` in secret payloads. Cloudflare documents [environment-specific secret storage](https://developers.cloudflare.com/workers/configuration/secrets/).

Once the credentials are complete and the Identity migrations have been applied, set only `env.staging.vars.PHONE_AUTH_MODE` to `sms_only` in `apps/api/wrangler.jsonc`. Retain its existing `PHONE_SMS_ROUTES` and `AFRICAS_TALKING_SANDBOX=false`. Upload secrets before enabling the mode (from `apps/api`, `bunx wrangler secret bulk secrets.staging.json --env staging`), or use the coordinated staging release's secret upload. Deploy the updated staging Worker through the existing release process; editing a local secret file alone does not configure the deployed Worker. Production has a separate configuration.

After deployment, inspect `https://staging.api.edayaplus.com/auth/edaya/methods`, then request a code through staging with a controlled CI test phone. Verify receipt and successful login, and test an explicit resend after cooldown. A provider `accepted` result alone does not establish handset delivery. Do not enable the deployed test-code reveal endpoint.

### WhatsApp setup

For WhatsApp, configure `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, a pinned supported `WHATSAPP_API_VERSION`, and `WHATSAPP_AUTH_TEMPLATES`:

```json
{"fr":{"name":"edaya_auth_fr","language":"fr"},"en":{"name":"edaya_auth_en","language":"en_US"}}
```

Use approved authentication templates with the body and copy-code button using the same OTP, five-minute expiration text and `message_send_ttl_seconds=60` configured on the templates. Store `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as secrets, then enable `whatsapp_first`. No deployment tool creates business accounts, registers senders or approves templates.

Subscribe Meta’s `messages` status webhook to `/auth/edaya/whatsapp/webhook`. GET verifies the configured verification token. POST verifies the raw-body HMAC in `X-Hub-Signature-256`, validates the business account and sender, deduplicates statuses and correlates the opaque attempt ID or provider message ID. Early unmatched receipts are retained for correlation after the send response. Older attempts cannot change the current challenge. Delivered/read statuses do not regress to sent/failed. Callbacks never authenticate an Account or initiate SMS.

Qualify staging with real CI phones before enabling production: French and English WhatsApp templates, offline/non-WhatsApp rejection, delayed delivery, resend, explicit SMS switching, SMS recipient acceptance and handset receipt, duplicate/out-of-order callbacks, linking recency and costs. Unit and captured-transport integration tests do not qualify real provider delivery. AT status 101 means accepted by the telco, not confirmed handset delivery; SMS delivery reports are outside v1. See [Africa’s Talking error-code guidance](https://help.africastalking.com/en/articles/16150386-messaging-error-codes) and [Meta’s official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

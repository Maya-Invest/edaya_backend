# Phone verification operations

See [API configuration and secrets](api-configuration.md) for JSONC settings, secrets-only files, and the `bun run repo maintenance vars` commands.

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

Both Worker environments default to `PHONE_AUTH_MODE=disabled`. Configure `AFRICAS_TALKING_USERNAME` and the secret `AFRICAS_TALKING_API_KEY`. The legacy SMS API uses the provider default sender when `AFRICAS_TALKING_SENDER_ID` is absent or blank; set that optional field only to a registered sender ID. Set native `sms_routes` in the environment config to `[{"prefix":"+225","provider":"africas_talking"}]`. `AFRICAS_TALKING_SANDBOX` is for local testing only and is rejected in production. Enable `sms_only` while Meta approval is pending. An enabled mode rejects incomplete configuration at startup.

### Local Africa's Talking setup

Set phone settings in `apps/api/config.local.jsonc` and only `AFRICAS_TALKING_API_KEY` in `.env`. Omit the sender ID to use the sandbox default sender:

```json
{
  "PHONE_AUTH_MODE": "sms_only",
  "sms_routes": [{ "prefix": "+225", "provider": "africas_talking" }],
  "AFRICAS_TALKING_USERNAME": "sandbox",
  "AFRICAS_TALKING_SANDBOX": "true"
}
```

The array is native JSON; do not encode it as a string. The loader produces the internal `SMS_ROUTES` binding. The old `PHONE_SMS_ROUTES` setting is rejected. Missing routes mean no destinations are supported. Local phone mode is `sms_only` with the sandbox username and endpoint; supply its API key in `.env`. Staging and production phone modes remain disabled until explicitly activated.

Use the key configured in your [sandbox application](https://account.africastalking.com/apps/sandbox). Africa's Talking's [username guidance](https://help.africastalking.com/en/articles/2249244-what-is-my-username-and-api-key) specifies `sandbox` as the sandbox username; live authentication uses the application username, which can differ from its display name. Register a supported Côte d'Ivoire number in the [simulator](https://simulator.africastalking.com:1517/) and use that same number in EDAYA. Sandbox messages arrive in the simulator, as explained in the [provider's sandbox guide](https://help.africastalking.com/en/articles/1170660-how-do-i-get-started-on-the-africa-s-talking-sandbox).

Restart `bun dev` from the backend root, check `http://localhost:9999/auth/edaya/methods` for phone availability, and request an OTP through the normal login form. `bun run repo dev` captures OTPs and delivers through configured providers once; phone mode remains explicitly configured. `SMS_TRANSPORT` controls school notifications, not this phone OTP integration.

For delivery to real phones during local development, replace the sandbox username/key with the live application's values and set `AFRICAS_TALKING_SANDBOX=false`. A live key cannot be used with the sandbox endpoint. This application currently accepts only CI mobile numbers (`+225` followed by ten digits starting with `01`, `05`, or `07`).

### Staging Africa's Talking setup

Staging runs with `NODE_ENV=production`, so its current validation also rejects sandbox mode. Use a live application and sufficient SMS credit for real handset qualification. Before using the default sender for Côte d'Ivoire, obtain provider confirmation for your application and route; otherwise supply an approved sender ID. Keep `NODE_ENV=production`.

Put `AFRICAS_TALKING_USERNAME` and, if using a registered custom sender, `AFRICAS_TALKING_SENDER_ID` in `config.staging.jsonc`. Omit or leave the sender ID blank to use the legacy default sender. Merge only `AFRICAS_TALKING_API_KEY` into `secrets.staging.json`. The combined settings are:

```json
{
  "AFRICAS_TALKING_USERNAME": "YOUR_LIVE_APPLICATION_USERNAME",
  "AFRICAS_TALKING_API_KEY": "YOUR_LIVE_API_KEY"
}
```

For coordinated GitHub releases, merge only the API key into the existing `STAGING_IDENTITY_SECRETS` JSON secret. The release merges it with `STAGING_API_SECRETS`; duplicate fields must agree. Keep phone mode in `config.staging.jsonc` because staging preflight rejects `PHONE_AUTH_MODE` in secret payloads. Cloudflare documents [environment-specific secret storage](https://developers.cloudflare.com/workers/configuration/secrets/).

Once the credentials are complete and the Identity migrations have been applied, set `PHONE_AUTH_MODE` to `sms_only` in `apps/api/config.staging.jsonc`. Retain its existing `sms_routes` and `AFRICAS_TALKING_SANDBOX=false`. Upload secrets before enabling the mode (from `apps/api`, `bunx wrangler secret bulk secrets.staging.json --env staging`), or use the coordinated staging release's secret upload. Apply the settings with `bun run repo maintenance vars push staging`; editing a local file alone does not configure the deployed Worker. Code releases preserve the deployed phone mode. Production has a separate configuration.

After deployment, inspect `https://staging.api.edayaplus.com/auth/edaya/methods`, then request a code through staging with a controlled CI test phone. Verify receipt and successful login, and test an explicit resend after cooldown. A provider `accepted` result alone does not establish handset delivery. Do not enable the deployed test-code reveal endpoint.

### WhatsApp setup

For WhatsApp, configure `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, a pinned supported `WHATSAPP_API_VERSION`, and `WHATSAPP_AUTH_TEMPLATES`:

```json
{"fr":{"name":"edaya_auth_fr","language":"fr"},"en":{"name":"edaya_auth_en","language":"en_US"}}
```

Use approved authentication templates with the body and copy-code button using the same OTP, five-minute expiration text and `message_send_ttl_seconds=60` configured on the templates. Store `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as secrets, then enable `whatsapp_first`. No deployment tool creates business accounts, registers senders or approves templates.

Subscribe Meta’s `messages` status webhook to `/auth/edaya/whatsapp/webhook`. GET verifies the configured verification token. POST verifies the raw-body HMAC in `X-Hub-Signature-256`, validates the business account and sender, deduplicates statuses and correlates the opaque attempt ID or provider message ID. Early unmatched receipts are retained for correlation after the send response. Older attempts cannot change the current challenge. Delivered/read statuses do not regress to sent/failed. Callbacks never authenticate an Account or initiate SMS.

Qualify staging with real CI phones before enabling production: French and English WhatsApp templates, offline/non-WhatsApp rejection, delayed delivery, resend, explicit SMS switching, SMS recipient acceptance and handset receipt, duplicate/out-of-order callbacks, linking recency and costs. Unit and captured-transport integration tests do not qualify real provider delivery. AT statuses 100, 101 and 102 are accepted only with an exact recipient and nonempty message ID; none proves handset delivery; SMS delivery reports are outside v1. See [Africa’s Talking error-code guidance](https://help.africastalking.com/en/articles/16150386-messaging-error-codes) and [Meta’s official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

## Shared SMS router

OTP and school notifications share the in-process router and environment routes. Longest-prefix selection dispatches one provider attempt. Unsupported destinations fail without sending, and there is no automatic provider failover. Only Africa's Talking is registered in this release. Authentication remains restricted to Côte d'Ivoire mobile numbers even if transport routes cover a broader prefix.

`PHONE_AUTH_MODE` enables phone OTP; `SMS_TRANSPORT=router` independently enables the school transport. School template flags, recipient preferences and invitation SMS gates still apply. Username and API key are required when either consumer enables provider delivery. A custom sender ID is optional for the legacy API; omitted or whitespace-only values omit `from` entirely. Configured IDs are trimmed. Rejected requests never fall back to the default sender or retry automatically. Local `SMS_TRANSPORT=log` remains available. API keys, message bodies and OTPs are never logged by the SMS adapter.

Accepted SMS message references use `sms:v1:` followed by JSON `[providerId,messageId]`. Existing IDs and WhatsApp IDs are unchanged. Risk holds, transport failures, malformed responses and unknown provider codes remain uncertain; known rejections are nonretryable in the Africa's Talking adapter. OTP resend remains an explicit user action.

School SMS dispatch commits a `sending` marker before network access. Interrupted markers become `uncertain` after their lease expires, including on exhausted jobs. Uncertain and permanently rejected SMS channels are skipped during later job retries; email/push may continue. Public notification status uses `failed` with `SMS_DELIVERY_UNCERTAIN` for a held SMS, indicating an unknown outcome rather than confirmed provider rejection. A crash between marker commit and network access may hold a message that was never sent. There is no automatic replay or delivery-report reconciliation in this release; investigate held records before any separately authorized resend.

## Router rollout and rollback

No database migration is required for the router: existing text status and message-ID columns are used. Pause API, scheduler and jobs with the existing operational controls, pause queue delivery, and let active work finish before switching code/configuration. Deploy the new code while paused, upload credentials, publish the selected config (`bun run repo maintenance vars push staging`), then explicitly delete the obsolete binding (`bun run repo maintenance vars delete staging PHONE_SMS_ROUTES`). Verify `SMS_ROUTES` and disabled/enabled consumer settings before resuming. Repeat with target `production` only for an authorized production release. Code deployment alone preserves variables and does not perform this configuration migration.

For rollback, keep work paused, disable phone authentication and school SMS, restore the previous code's required route/configuration bindings, then restore the older code. Older workers must not process held SMS attempts: their retry behavior does not recognize the new terminal states. Do not blanket-reset jobs to pending. Activation and real handset qualification are separate from this code change.

## Later migration to the bulk API

The current adapter uses the legacy `/version1/messaging` endpoint. Its optional `from` parameter defaults to the provider sender (`AFRICASTKNG`, subject to route availability). The newer `/version1/messaging/bulk` API requires a registered `senderId` and uses a `phoneNumbers` list. See the [legacy API](https://developers.africastalking.com/docs/sms/sending/bulk_%28legacy%29) and [new bulk API](https://developers.africastalking.com/docs/sms/sending/bulk) documentation.

Sender approval does not automatically switch endpoints. Implement and qualify the newer API separately after approval; recheck sandbox availability because its documentation currently marks that endpoint as coming soon. Until then, keep the legacy API and qualify default-sender live delivery with a controlled Côte d'Ivoire handset through staging before broader activation. Sandbox success alone does not qualify live delivery.

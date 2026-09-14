# Notification delivery

All school messages use the durable school queue and the same authorization policy before every channel attempt. The API owns templates, scheduling, recipient identity, preferences, retries and inbox state. Providers only deliver the authorized channel payload.

## Runtime and transports

`@edaya/adaptor-notify` implements `NotificationGatewayPort` and `InvitationDeliveryPort`. Sign-in / verify / reset OTP mail is Better Auth in the identity service — not a school notify job. Local and Worker school runtimes require an initialized dispatcher; missing runtime configuration fails rather than silently logging or switching gateways. The in-memory test runtime uses the no-op port.

`apps/api` injects `EmailTransportPort` and `SmsTransportPort` into notify (local log; Worker Cloudflare email and unimplemented SMS). SMTP and real SMS providers register only in the API resolver. FCM uses `FCM_SERVICE_ACCOUNT_JSON`. Transport selection never changes the school queue, policy, profile resolution or push path.

School notifications and account invitations enqueue in the business transaction; background dispatch sends after commit. Invitation command success acknowledges durable queue acceptance. Provider failures are retried without rolling back the already committed invitation. Phone invitations fail closed before enqueue when SMS invitations are off or the SMS transport is unimplemented. Cron owns delays; transports receive immediate channel attempts.

## Copy types and channels

Schools edit typed copy, not per-channel blobs. A code catalog maps channel → type:

| Type | Fields | Used by |
| --- | --- | --- |
| `base_message` | `title`, `body` | in-app, push |
| `rich_message` | `subject`, `body` (HTML) | email |
| `simple_message` | `body` | SMS |

In-app is not gated: a recipient with a `subjectId` always gets an inbox row. Email, push and SMS require the school flag **and** the recipient preference. Unimplemented SMS on school jobs is skipped (the job can still send email/push). All three flags off still writes in-app.

Account invitations are school-global: email is always on; SMS requires `invitationSmsEnabled` (default false). Invitation copy is `rich_message` + `simple_message` only — no in-app or push.

## Authorization and facts

`access.notifications.recipient` admits the school-bound `notify-adapter` system actor and binds it to the persisted delivery's school, source, subject and recipient profile. It then checks current source visibility. Unknown sources, revoked links, inactive profiles, corrected attendance, changed calendar scope and unpublished academic content deny dispatch. Guardian report and attendance preferences are checked on the exact student relationship. Academic sources use the same native student/year/publication predicates as reads.

Contacts and preferences come from the exact current profile, enriched with current central-identity contacts. There is no subscriber upsert, removal or session backfill. Native `notify.recipients` holds only explicit authentication/invitation destinations. `notify.devices` keys push credentials by school, login and provider; it confers no access. Each channel attempt re-resolves the delivery. Denials cancel terminally; missing resolvers and infrastructure failures fail closed and use bounded retries. Successful channel receipts survive retries.

Invitation dispatch uses a read-only `invitation-dispatch` system identity and the persisted school/invitation reference. Its resolver requires a current pending, unexpired email or phone invitation; the transport compares the current school, invitation ID and contact with its command-owned destination. Revoked, accepted, expired, missing or mismatched invitations cannot send. A missing resolver fails closed with bounded retries. Automatic registration skips an invitation before mutation when contact or caller authority is absent; once invitation creation is admitted, enqueue failure propagates and rolls back registration and invitation together. Auto-invite stays email-only.

Generated deliveries have one source key and a unique school/source/subject/profile identity. Application delivery IDs remain opaque provider correlation keys. Transport job keys separately namespace the job kind, school and logical delivery ID. Retries reuse the persisted ID; cancellation finds persisted deliveries even after account unlinking or enrollment removal. Announcement dispatch reloads the persisted publication and audience.

## Email, SMS and receipts

The API runtime selects email (local log, Worker Cloudflare) and SMS (local log, Worker unimplemented). Staging and production use Cloudflare Email via the Worker `EMAIL` binding. Delivery status is written in-process from `onDeliveryEvent` after each channel attempt. Cron `reconcilePendingDeliveries` polls remaining pending rows. There is no external notification-provider webhook.

## Deployment

Run school migrations in journal order using deployment tooling. Migration `0013_notification_schema` installs or adopts notification tables and retry indexes; runtime notification adapters no longer run schema DDL. Migration `0020_notification_copy_types` splits school template JSON into per-key copy-type columns, adds `invitation_sms_enabled`, and adds `notify.recipients.phone` / `channel_sms` plus `notify.jobs.sms_body`. Migration `0011_notification_delivery_sources` preserves delivery/provider IDs and rejects ambiguous source history. Migration `0012_notification_contact_authority` removes native school-contact snapshots while retaining command destinations, jobs and receipts.

Inject email and SMS transports from `apps/api` and configure FCM on the school runtime. Mobile clients re-register push tokens into the school device store. Follow the [coordinated cutover procedure](authorization-cutover.md). No provider subscriber synchronization remains.

## Tenant-bound storage and recovery

Migration `0016_notification_tenants` separates the application `delivery_id` from the transport key, encoded as `notify:` plus a JSON tuple of job kind, tenant and delivery ID. Recipient/channel history moves with the job key, including successful channels and provider message IDs. Orphan history aborts migration before any change. Command-owned destinations use `(tenant, subject_id)`; removing an invitation destination cannot remove another school's destination. Device lookup, registration and removal all require the authoritative school. Cancellation and reconciliation also carry school scope through the domain gateway.

School delivery resolves the current source/profile using the original application ID. Email correlation, push links and delivery events keep that original ID. Historical `auth_otp` job rows may still exist; the school API no longer enqueues them. Provider and storage failures expose stable codes rather than exception text or device tokens. Storage failures propagate so transactional callers can roll back and cron can retry.

Each notification job has payload version 1 and at most five claims. An unsupported version or exhausted attempt budget becomes `dead`, including a worker interrupted during its final lease. Renewal, channel receipt updates and final completion require the current unexpired lease. Completed channels are skipped on retry. A provider may already have accepted a send before lease expiry or a lost response; retry cannot guarantee exactly-once network delivery.

Existing device tokens have no reliable school provenance. Migration preserves them in `notify.devices_unscoped_legacy` but the dispatcher never reads that table. Mobile clients re-register on authenticated session restoration/sign-in, even if Firebase returns the same token. Tokens are no longer printed in mobile logs. During paused cutover, confirm registration and actual push delivery in each required school before declaring the device migration qualified. The legacy table is cutover recovery data only: keep it under the same restricted access as credentials, and remove it after the verified cutover recovery window is closed by the release operator. No automatic reassignment or legal retention period is inferred.

Pause sends before changing key formats and reconcile pending/uncertain provider attempts against provider history. Resume only with the matching migrated backend and updated clients. Sent channel receipts prevent ordinary resends, but migration cannot determine whether an unacknowledged external attempt succeeded. Deployment and real-device/provider evidence remain Plan 06 requirements.

Provider channel identities are SHA-256 digests of the transport job, subject and channel tuple. Email correlation carries the original delivery ID, subject and school. Provider bounce text is reduced to a stable failure code before returning a domain delivery event.

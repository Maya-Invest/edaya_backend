# Notification delivery

All school messages use the durable school queue and the same authorization policy before every channel attempt. The API owns templates, scheduling, recipient identity, preferences, retries and inbox state. Providers only deliver the authorized channel payload.

## Runtime and transports

`@edaya/adaptor-notify` implements `NotificationGatewayPort`, `InvitationDeliveryPort` and `AuthEmailDeliveryPort`. Local and Worker runtimes require an initialized dispatcher; missing runtime configuration fails rather than silently logging or switching gateways. The in-memory test runtime uses the no-op port.

`EMAIL_TRANSPORT` selects `log`, `cloudflare` or `novu`. Novu additionally requires `NOVU_SECRET_KEY`; `NOVU_API_URL` is optional. SMTP is not implemented and fails explicitly. FCM uses `FCM_SERVICE_ACCOUNT_JSON`. Provider selection never changes the school queue, policy, profile resolution or push transport.

Authentication commands retain their awaited email attempt. School notifications and account invitations enqueue in the business transaction; background dispatch sends after commit. Invitation command success acknowledges durable queue acceptance. Provider failures are retried without rolling back the already committed invitation. Unsupported invitation channels are rejected before enqueue. Cron owns delays; providers receive immediate channel attempts.

## Authorization and facts

`access.notifications.recipient` admits the school-bound `notify-adapter` system actor and binds it to the persisted delivery's school, source, subject and recipient profile. It then checks current source visibility. Unknown sources, revoked links, inactive profiles, corrected attendance, changed calendar scope and unpublished academic content deny dispatch. Guardian report and attendance preferences are checked on the exact student relationship. Academic sources use the same native student/year/publication predicates as reads.

Contacts and preferences come from the exact current profile, enriched with current central-identity contacts. There is no subscriber upsert, removal or session backfill. Native `notify.recipients` holds only explicit authentication/invitation destinations. `notify.devices` keys push credentials by school, login and provider; it confers no access. Each channel attempt re-resolves the delivery. Denials cancel terminally; missing resolvers and infrastructure failures fail closed and use bounded retries. Successful channel receipts survive retries.

Invitation dispatch uses a read-only `invitation-dispatch` system identity and the persisted school/invitation reference. Its resolver requires a current pending, unexpired email invitation; the transport compares the current school, invitation ID and email with its command-owned destination. Revoked, accepted, expired, missing or mismatched invitations cannot send. A missing resolver fails closed with bounded retries. Automatic registration skips an invitation before mutation when contact or caller authority is absent; once invitation creation is admitted, enqueue failure propagates and rolls back registration and invitation together.

Generated deliveries have one source key and a unique school/source/subject/profile identity. Application delivery IDs remain opaque provider correlation keys. Transport job keys separately namespace the job kind, school and logical delivery ID. Retries reuse the persisted ID; cancellation finds persisted deliveries even after account unlinking or enrollment removal. Announcement dispatch reloads the persisted publication and audience.

## Novu email

Novu runs one immediate email step, `transactional.email`. There are no business-event workflows, delay steps, provider inboxes, push steps or copied profile preferences. A synthetic per-message subscriber contains no business contact; each trigger uses the current email override with `replaceToRecipient: true`, following the [Novu email integration contract](https://docs.novu.co/platform/integrations/email). The transport carries explicit delivery/subject correlation for signed email receipts, without parsing legacy delivery IDs.

## Deployment

Run school migrations in journal order using deployment tooling. Migration `0013_notification_schema` installs or adopts notification tables and retry indexes; runtime notification adapters no longer run schema DDL. Migration `0011_notification_delivery_sources` preserves delivery/provider IDs and rejects ambiguous source history. Migration `0012_notification_contact_authority` removes native school-contact snapshots while retaining command destinations, jobs and receipts.

For Novu, bootstrap the `transactional.email` workflow, retire the old event/auth/invitation workflows and delete their reviewed subscriber records during the paused cutover. Export provider history before cleanup; drain or cancel outstanding old workflow executions before resuming. Configure `EMAIL_TRANSPORT=novu` instead of the removed `NOTIFICATION_PROVIDER` setting. Mobile clients re-register push tokens into the school device store. Follow the [coordinated cutover procedure](authorization-cutover.md). No runtime compatibility gateway or subscriber synchronization remains.

## Tenant-bound storage and recovery

Migration `0016_notification_tenants` separates the application `delivery_id` from the transport key, encoded as `notify:` plus a JSON tuple of job kind, tenant and delivery ID. Recipient/channel history moves with the job key, including successful channels and provider message IDs. Orphan history aborts migration before any change. Command-owned destinations use `(tenant, subject_id)`; removing an invitation destination cannot remove another school's destination. Device lookup, registration and removal all require the authoritative school. Cancellation and reconciliation also carry school scope through the domain gateway.

School delivery resolves the current source/profile using the original application ID. Email correlation, push links and delivery events keep that original ID. Authentication transport IDs use random identifiers; OTPs and addresses are not embedded in job keys. Provider and storage failures expose stable codes rather than exception text or device tokens. Storage failures propagate so transactional callers can roll back and cron can retry.

Each notification job has payload version 1 and at most five claims. An unsupported version or exhausted attempt budget becomes `dead`, including a worker interrupted during its final lease. Renewal, channel receipt updates and final completion require the current unexpired lease. Completed channels are skipped on retry. A provider may already have accepted a send before lease expiry or a lost response; retry cannot guarantee exactly-once network delivery.

Existing device tokens have no reliable school provenance. Migration preserves them in `notify.devices_unscoped_legacy` but the dispatcher never reads that table. Mobile clients re-register on authenticated session restoration/sign-in, even if Firebase returns the same token. Tokens are no longer printed in mobile logs. During paused cutover, confirm registration and actual push delivery in each required school before declaring the device migration qualified. The legacy table is cutover recovery data only: keep it under the same restricted access as credentials, and remove it after the verified cutover recovery window is closed by the release operator. No automatic reassignment or legal retention period is inferred.

Pause sends before changing key formats and reconcile pending/uncertain provider attempts against provider history. Resume only with the matching migrated backend and updated clients. Sent channel receipts prevent ordinary resends, but migration cannot determine whether an unacknowledged external attempt succeeded. Deployment and real-device/provider evidence remain Plan 06 requirements.

Provider channel identities are SHA-256 digests of the transport job, subject and channel tuple. Novu receives correlation protocol version `2` with the original delivery ID, subject and school; its signed-receipt parser validates the same digest. Explicitly versioned receipts cannot fall back to legacy validation. Unversioned signed receipts retain the previous exact delivery/subject transaction check for late pre-cutover events. Provider bounce text is reduced to a stable failure code before returning a domain delivery event.
